"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school";
import { parseRoster } from "@/lib/students/parse-roster";
import { compareRoster, placeLabel } from "@/lib/students/order";
import { describeDevice, type DeviceEvent } from "@/lib/device";

export type RosterRow = {
  id: string;
  student_code: string;
  full_name: string;
  classroom: string | null;
  class_number: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
};

export default function StudentsPanel({
  courseId,
  roster,
  onChanged,
}: {
  courseId: string;
  roster: RosterRow[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ตัวกรองห้อง ("" = ทุกห้อง)
  const [room, setRoom] = useState("");
  const th = new Intl.Collator("th", { numeric: true });
  const rooms = [...new Set(roster.map((r) => r.classroom).filter((c): c is string => !!c))].sort(th.compare);
  const activeRoom = rooms.includes(room) ? room : "";
  const shown = activeRoom ? roster.filter((r) => r.classroom === activeRoom) : roster;
  const signedIn = shown.filter((r) => r.claimed_by !== null).length;

  // เครื่องที่นักเรียนแต่ละคนใช้ + เครื่องที่ถูกใช้หลายบัญชี (สัญญาณล็อกอินทำแทนเพื่อน)
  const [devices, setDevices] = useState<DeviceEvent[]>([]);
  const [openDevices, setOpenDevices] = useState<string | null>(null);
  const loadDevices = useCallback(async () => {
    const ids = roster.map((r) => r.claimed_by).filter((x): x is string => !!x);
    if (!ids.length) return setDevices([]);
    const { data } = await supabase
      .from("device_events")
      .select("user_id, device_id, user_agent, ip, kind, quiz_id, at, device_model")
      .in("user_id", ids)
      .order("at", { ascending: false })
      .limit(5000);
    setDevices((data as DeviceEvent[]) ?? []);
  }, [roster, supabase]);
  useEffect(() => {
    const timer = setTimeout(loadDevices, 0);
    return () => clearTimeout(timer);
  }, [loadDevices]);

  const nameOfUser = new Map(roster.filter((r) => r.claimed_by).map((r) => [r.claimed_by as string, r.full_name]));
  // device_id → ผู้ใช้ทั้งหมดที่เคยใช้เครื่องนี้
  const usersOfDevice = new Map<string, Set<string>>();
  for (const d of devices) {
    if (!usersOfDevice.has(d.device_id)) usersOfDevice.set(d.device_id, new Set());
    usersOfDevice.get(d.device_id)!.add(d.user_id);
  }
  const sharedDevices = [...usersOfDevice.entries()].filter(([, users]) => users.size > 1);
  function devicesOf(userId: string) {
    const byDevice = new Map<string, { device_id: string; label: string; last: string; ip: string | null; count: number }>();
    for (const d of devices) {
      if (d.user_id !== userId) continue;
      const cur = byDevice.get(d.device_id);
      if (cur) {
        cur.count++;
        // รุ่นอาจมาทีหลัง (บางแถวบันทึกก่อนมีรุ่น) — ใช้ป้ายที่ละเอียดกว่า
        if (d.device_model && !cur.label.includes(d.device_model)) cur.label = describeDevice(d.user_agent, d.device_model);
      } else byDevice.set(d.device_id, { device_id: d.device_id, label: describeDevice(d.user_agent, d.device_model), last: d.at, ip: d.ip, count: 1 });
    }
    return [...byDevice.values()];
  }
  function sharedWith(userId: string) {
    const others = new Set<string>();
    for (const [, users] of sharedDevices) if (users.has(userId)) users.forEach((u) => u !== userId && others.add(u));
    return [...others].map((u) => nameOfUser.get(u) ?? "บัญชีนอกวิชานี้");
  }

  // PIN สำหรับนักเรียนที่เข้าอีเมลโรงเรียนไม่ได้
  const [pinRosterIds, setPinRosterIds] = useState<Set<string>>(new Set());
  // PIN ที่เพิ่งสร้าง แสดงใต้แถวของนักเรียนคนนั้น (เดิมแสดงบนสุดของรายชื่อ ครูที่เลื่อนลงมากดไม่เห็น)
  const [issued, setIssued] = useState<{ rosterId: string; name: string; studentCode: string; pin: string } | null>(null);
  const [pinError, setPinError] = useState<{ rosterId: string; message: string } | null>(null);
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  const loadPins = useCallback(async () => {
    const res = await fetch(`/api/students/pin?courseId=${encodeURIComponent(courseId)}`);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.rosterIds) setPinRosterIds(new Set(json.rosterIds as string[]));
  }, [courseId]);

  useEffect(() => {
    const timer = setTimeout(loadPins, 0);
    return () => clearTimeout(timer);
  }, [loadPins, roster]);

  async function pinAction(r: RosterRow, action: "issue" | "revoke") {
    if (action === "issue" && pinRosterIds.has(r.id) && !window.confirm(`สร้าง PIN ใหม่ให้ ${r.full_name}?\nPIN เดิมจะใช้ไม่ได้ทันที`)) return;
    if (action === "revoke" && !window.confirm(`ยกเลิก PIN ของ ${r.full_name}?\nนักเรียนจะเข้าด้วย PIN ไม่ได้อีก (คะแนนยังอยู่ครบ)`)) return;
    setPinBusy(r.id);
    setPinError(null);
    const res = await fetch("/api/students/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rosterId: r.id, action }),
    });
    const json = await res.json().catch(() => null);
    setPinBusy(null);
    if (!res.ok) return setPinError({ rosterId: r.id, message: json?.error ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง" });
    if (action === "issue") setIssued({ rosterId: r.id, name: json.name, studentCode: json.studentCode, pin: json.pin });
    else setIssued(null);
    await loadPins();
    onChanged();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLog([]);
    setError(null);
    try {
      let table: unknown[][];
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        // raw: false = อ่านค่าตามที่เห็นใน Excel — รหัสที่จัดรูปแบบให้มีเลข 0 นำหน้าจะไม่หาย
        table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      } catch {
        setError("เปิดไฟล์นี้ไม่ได้ — ต้องเป็นไฟล์ Excel (.xlsx หรือ .xls)");
        return;
      }

      const parsed = parseRoster(table);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      const skippedLines = parsed.skipped.map((s) => `${s.student_code} ${s.full_name} — ข้าม: ${s.reason}`);
      if (parsed.rows.length === 0) {
        setLog(["ไม่มีนักเรียนที่นำเข้าได้", ...skippedLines]);
        return;
      }

      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, rows: parsed.rows }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;

      if (!res || !data) {
        setError("เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
      } else if (res.status === 401 || res.status === 403) {
        setError("ไม่มีสิทธิ์นำเข้ารายชื่อ — ลองออกจากระบบแล้วเข้าใหม่ด้วยบัญชีครู");
      } else if (data.error) {
        setError(`นำเข้าไม่สำเร็จ: ${data.error}`);
      } else {
        const results = data.results as { student_code: string; status: string }[];
        const failed = results.filter((r) => /^ไม่สำเร็จ|^ข้าม/.test(r.status));
        const imported = results.length - failed.length;
        const notImported = failed.length + parsed.skipped.length;
        // แสดงเฉพาะคนที่มีปัญหา — รายชื่อที่นำเข้าสำเร็จดูได้ในรายการด้านล่างอยู่แล้ว
        setLog([
          `นำเข้าแล้ว ${imported} คน${notImported ? ` · ไม่ได้นำเข้า ${notImported} คน (ดูด้านล่าง)` : ""}`,
          ...skippedLines,
          ...failed.map((r) => `${r.student_code} — ${r.status}`),
        ]);
      }
      onChanged();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  /**
   * เอานักเรียนออกจากวิชา — ลบแถวรายชื่อ แล้วฐานข้อมูลลบการลงทะเบียนและคะแนนตามให้ (cascade ผ่าน roster_id)
   * ต้องลบรายชื่อด้วย ถ้าลบแค่การลงทะเบียน นักเรียนจะถูกจับคู่กลับเข้ามาเองตอนล็อกอินครั้งถัดไป
   */
  async function removeStudent(r: RosterRow) {
    setError(null);
    let scoreCount = 0;

    const { data: enrollment } = await supabase.from("enrollments").select("id").eq("roster_id", r.id).maybeSingle();
    if (enrollment) {
      const { count } = await supabase
        .from("student_scores")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollment.id)
        .not("score", "is", null);
      scoreCount = count ?? 0;
    }

    const warning = scoreCount ? `\n\nคะแนนที่กรอกไว้แล้ว ${scoreCount} ช่องจะถูกลบไปด้วย และกู้คืนไม่ได้` : "";
    if (!window.confirm(`เอา ${r.full_name} (${r.student_code}) ออกจากวิชานี้?${warning}`)) return;

    setBusy(true);
    const { error: rosterError } = await supabase.from("class_roster").delete().eq("id", r.id);
    setBusy(false);
    if (rosterError) return setError(dbErrorMessage(rosterError));
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm text-slate-600">
          อัปโหลดไฟล์ Excel รายชื่อนักเรียนที่ส่งออกจากระบบทะเบียนได้เลย ไม่ต้องแก้ไฟล์
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          disabled={busy}
          aria-label="เลือกไฟล์ Excel รายชื่อนักเรียน"
          className="block w-full text-sm text-slate-500 file:mr-3 file:min-h-11 file:rounded-sm file:border-2 file:border-porcelain file:bg-transparent file:px-4 file:font-display file:font-semibold file:text-slate-800 hover:file:bg-slate-100 disabled:opacity-50 sm:file:min-h-9"
        />
        {busy && <p className="text-sm text-slate-400">กำลังทำงาน...</p>}
        {log.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-slate-700">{log[0]}</p>
            <ul className="text-xs text-slate-500 space-y-0.5 max-h-40 overflow-y-auto">
              {log.slice(1).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {/* คำอธิบายรูปแบบไฟล์ยาว — พับไว้เมื่อมีรายชื่อแล้ว มือถือจะได้เห็นรายชื่อเร็วขึ้น */}
        <details open={roster.length === 0} className="group text-xs text-slate-500">
          <summary className="cursor-pointer select-none py-2 text-sm text-slate-600 hover:text-slate-800">
            ไฟล์แบบไหนใช้ได้
          </summary>
          <div className="space-y-2 pt-1">
        <ul className="list-disc pl-5 space-y-0.5">
          <li>
            ต้องมี <b>รหัสนักเรียน</b> และชื่อ — จะเป็น <b>คำนำหน้า / ชื่อ / นามสกุล</b> แยกคอลัมน์ หรือ <b>ชื่อ-สกุล</b> คอลัมน์เดียวก็ได้
          </li>
          <li>
            ถ้ามี <b>ระดับชั้น / ห้อง / เลขที่</b> ระบบจะเรียงรายชื่อตามห้องและเลขที่ให้เหมือนสมุดคะแนน
          </li>
          <li>
            ถ้ามี <b>สถานะนักเรียน</b> จะนำเข้าเฉพาะคนที่สถานะ &quot;เรียน&quot; (ลาออก ย้าย ฯลฯ จะถูกข้าม)
          </li>
        </ul>
        <p>
          ไม่ต้องใส่อีเมล — ระบบจับคู่จากรหัสนักเรียนกับบัญชี Google ของโรงเรียน
          (<code className="break-all">รหัสนักเรียน@{SCHOOL_EMAIL_DOMAIN}</code>) ให้อัตโนมัติตอนนักเรียนเข้าระบบครั้งแรก
        </p>
        <p>ชื่อในไฟล์สะกดผิด? แก้ในไฟล์แล้วนำเข้าซ้ำได้เลย ระบบจะอัปเดตชื่อให้ ไม่เพิ่มนักเรียนซ้ำ</p>
          </div>
        </details>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {rooms.length > 1 && (
        <div role="group" aria-label="เลือกห้อง" className="flex flex-wrap gap-1.5">
          {[{ name: "", count: roster.length }, ...rooms.map((name) => ({ name, count: roster.filter((r) => r.classroom === name).length }))].map((r) => {
            const on = activeRoom === r.name;
            return (
              <button
                key={r.name || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setRoom(r.name)}
                className={`min-h-11 rounded-sm border-2 px-3 py-1.5 text-sm font-display font-semibold sm:min-h-0 ${
                  on ? "border-porcelain bg-porcelain text-[var(--c-slate-50)]" : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                }`}
              >
                {r.name || "ทุกห้อง"} <span className={`font-num tnum font-medium ${on ? "" : "text-slate-400"}`}>{r.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length > 0 && (
        <p className="text-sm text-slate-600">
          {activeRoom && <>{activeRoom} · </>}เข้าระบบแล้ว <b className="text-slate-800">{signedIn}</b> จาก{" "}
          <b className="text-slate-800">{shown.length}</b> คน
          {signedIn < shown.length && (
            <span className="text-slate-400">
              {" "}
              — คนที่ยังไม่เข้ายังไม่เห็นคะแนนของตัวเอง
            </span>
          )}
        </p>
      )}

      {sharedDevices.length > 0 && (
        <div className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2 space-y-1">
          <p className="font-semibold">พบเครื่องที่ถูกใช้โดยบัญชีนักเรียนหลายคน {sharedDevices.length} เครื่อง</p>
          <ul className="list-disc pl-5">
            {sharedDevices.map(([id, users]) => (
              <li key={id}>{[...users].map((u) => nameOfUser.get(u) ?? "บัญชีนอกวิชานี้").join(" · ")}</li>
            ))}
          </ul>
          <p className="text-xs">อาจเป็นการล็อกอินแทนกัน หรือใช้เครื่องร่วมกันจริง (เช่น พี่น้อง / คอมห้องเรียน) — ควรสอบถามก่อนสรุป</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {roster.length === 0 && (
          <p className="p-4 text-sm text-slate-400">ยังไม่มีรายชื่อนักเรียนในวิชานี้</p>
        )}
        {[...shown].sort(compareRoster).map((r) => (
          <div key={r.id}>
          {/* มือถือ: ข้อมูลอยู่บน ปุ่มเรียงแถวล่างเต็มกว้าง (กดง่าย) · จอกว้าง: ปุ่มชิดขวาแถวเดียวกัน */}
          <div className="p-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="text-base text-slate-700 sm:text-sm">{r.full_name}</p>
              <p className="text-xs text-slate-400">
                <span className="font-num tnum">{r.student_code}</span>
                {placeLabel(r) && <span> · {placeLabel(r)}</span>}
              </p>
              {r.claimed_by && devicesOf(r.claimed_by).length > 0 && (
                <button
                  type="button"
                  aria-expanded={openDevices === r.id}
                  onClick={() => setOpenDevices(openDevices === r.id ? null : r.id)}
                  className="-my-1 py-2 text-left text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 sm:my-0 sm:py-0 sm:no-underline sm:hover:underline"
                >
                  {devicesOf(r.claimed_by)[0].label}
                  {devicesOf(r.claimed_by).length > 1 && ` + อีก ${devicesOf(r.claimed_by).length - 1} เครื่อง`}
                </button>
              )}
              {r.claimed_by && sharedWith(r.claimed_by).length > 0 && (
                <p className="text-xs font-semibold text-amber-700">เครื่องเดียวกับ: {sharedWith(r.claimed_by).join(", ")}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap sm:gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full whitespace-nowrap border ${
                  r.claimed_by ? "bg-green-50 text-green-800 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${r.claimed_by ? "bg-green-600" : "border border-slate-400"}`}
                />
                {pinRosterIds.has(r.id) ? "เข้าด้วย PIN" : r.claimed_by ? "เข้าระบบแล้ว" : "ยังไม่เคยเข้า"}
              </span>
              {/* PIN: สร้างให้คนที่ยังไม่เคยเข้า หรือเปลี่ยน/ยกเลิกของคนที่ใช้ PIN อยู่ (คนที่เข้าด้วย Google แล้วไม่ต้องใช้) */}
              {(!r.claimed_by || pinRosterIds.has(r.id)) && (
                <button
                  onClick={() => pinAction(r, "issue")}
                  disabled={busy || pinBusy === r.id}
                  className="min-h-11 whitespace-nowrap rounded-sm border border-slate-300 px-3 text-sm text-slate-700 hover:border-slate-500 hover:text-slate-800 disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1 sm:text-xs sm:text-slate-600"
                >
                  {pinBusy === r.id ? "..." : pinRosterIds.has(r.id) ? "PIN ใหม่" : "สร้าง PIN"}
                </button>
              )}
              {pinRosterIds.has(r.id) && (
                <button
                  onClick={() => pinAction(r, "revoke")}
                  disabled={busy || pinBusy === r.id}
                  className="min-h-11 whitespace-nowrap px-2 text-sm text-slate-500 hover:text-red-700 hover:underline disabled:opacity-50 sm:min-h-0 sm:px-0 sm:text-xs"
                >
                  ยกเลิก PIN
                </button>
              )}
              {/* มือถือ: แยกไปชิดขวาสุด ห่างจากปุ่ม PIN กันกดพลาด */}
              <button
                onClick={() => removeStudent(r)}
                disabled={busy}
                aria-label={`เอา ${r.full_name} ออกจากวิชา`}
                className="ml-auto min-h-11 px-2 text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 sm:ml-0 sm:min-h-0 sm:px-0 sm:text-xs"
              >
                เอาออก
              </button>
            </div>
          </div>
          {openDevices === r.id && r.claimed_by && (
            <ul className="mx-3 mb-3 rounded-sm border border-slate-200 divide-y divide-slate-100 text-xs">
              {devicesOf(r.claimed_by).map((d) => {
                const others = [...(usersOfDevice.get(d.device_id) ?? [])].filter((u) => u !== r.claimed_by);
                return (
                  <li key={d.device_id} className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="font-semibold text-slate-700">{d.label}</span>
                    <span className="text-slate-500">
                      ล่าสุด {new Date(d.last).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {d.ip && <span className="text-slate-400">IP {d.ip}</span>}
                    {others.length > 0 && (
                      <span className="text-amber-700 font-semibold">
                        ใช้โดย: {others.map((u) => nameOfUser.get(u) ?? "บัญชีนอกวิชานี้").join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pinError?.rosterId === r.id && (
            <p role="alert" className="mx-3 mb-3 text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
              {pinError.message}
            </p>
          )}
          {/* PIN ที่เพิ่งสร้าง — แสดงครั้งเดียว ระบบไม่เก็บตัว PIN ไว้ */}
          {issued?.rosterId === r.id && (
            <div
              role="status"
              ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
              className="mx-3 mb-3 rounded-sm border-2 border-porcelain bg-white p-4 space-y-2"
            >
              <p className="text-sm text-slate-600">
                บอก <b className="text-slate-800">{issued.name}</b> ให้เข้าหน้าเข้าสู่ระบบ → &quot;เข้าด้วยรหัสนักเรียน + PIN&quot;
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <p>
                  <span className="block text-xs text-slate-500">รหัสนักเรียน</span>
                  <span className="font-num tnum text-2xl font-semibold text-slate-800">{issued.studentCode}</span>
                </p>
                <p>
                  <span className="block text-xs text-slate-500">PIN</span>
                  <span className="font-num tnum text-4xl font-bold tracking-[0.2em] text-slate-800 select-all">{issued.pin}</span>
                </p>
              </div>
              <p className="text-xs text-amber-800">จด PIN นี้ให้นักเรียนตอนนี้ — ปิดกล่องนี้แล้วดูซ้ำไม่ได้ (ถ้าลืม กด &quot;PIN ใหม่&quot; ได้)</p>
              <button
                type="button"
                onClick={() => setIssued(null)}
                className="min-h-11 w-full rounded-sm border border-slate-300 text-sm text-slate-700 hover:border-slate-500 sm:min-h-0 sm:w-auto sm:border-0 sm:text-slate-600 sm:underline sm:underline-offset-2"
              >
                จดแล้ว ปิดกล่องนี้
              </button>
            </div>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}
