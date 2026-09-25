"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school";
import { parseRoster } from "@/lib/students/parse-roster";
import { compareRoster, placeLabel } from "@/lib/students/order";

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

  // PIN สำหรับนักเรียนที่เข้าอีเมลโรงเรียนไม่ได้
  const [pinRosterIds, setPinRosterIds] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<{ name: string; studentCode: string; pin: string } | null>(null);
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
    setError(null);
    const res = await fetch("/api/students/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rosterId: r.id, action }),
    });
    const json = await res.json().catch(() => null);
    setPinBusy(null);
    if (!res.ok) return setError(json?.error ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
    if (action === "issue") setIssued({ name: json.name, studentCode: json.studentCode, pin: json.pin });
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
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <p className="text-sm text-slate-600">
          อัปโหลดไฟล์ Excel รายชื่อนักเรียนที่ส่งออกจากระบบทะเบียนได้เลย ไม่ต้องแก้ไฟล์
        </p>
        <ul className="text-xs text-slate-500 list-disc pl-5 space-y-0.5">
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
        <p className="text-xs text-slate-500">
          ไม่ต้องใส่อีเมล — ระบบจับคู่จากรหัสนักเรียนกับบัญชี Google ของโรงเรียน
          (<code>รหัสนักเรียน@{SCHOOL_EMAIL_DOMAIN}</code>) ให้อัตโนมัติตอนนักเรียนเข้าระบบครั้งแรก
        </p>
        <p className="text-xs text-slate-500">
          ชื่อในไฟล์สะกดผิด? แก้ในไฟล์แล้วนำเข้าซ้ำได้เลย ระบบจะอัปเดตชื่อให้ ไม่เพิ่มนักเรียนซ้ำ
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="text-sm" />
        {busy && <p className="text-sm text-slate-400">กำลังทำงาน...</p>}
        {log.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-slate-700">{log[0]}</p>
            <ul className="text-xs text-slate-500 space-y-0.5 max-h-40 overflow-y-auto">
              {log.slice(1).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {rooms.length > 1 && (
        <div role="group" aria-label="เลือกห้อง" className="flex flex-wrap gap-1">
          {[{ name: "", count: roster.length }, ...rooms.map((name) => ({ name, count: roster.filter((r) => r.classroom === name).length }))].map((r) => {
            const on = activeRoom === r.name;
            return (
              <button
                key={r.name || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setRoom(r.name)}
                className={`rounded-sm border-2 px-3 py-1.5 text-sm font-display font-semibold ${
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

      {/* PIN ที่เพิ่งสร้าง — แสดงครั้งเดียว ระบบไม่เก็บตัว PIN ไว้ */}
      {issued && (
        <div role="status" className="rounded-sm border-2 border-porcelain bg-white p-4 space-y-2">
          <p className="text-sm text-slate-600">
            บอกนักเรียน <b className="text-slate-800">{issued.name}</b> ให้เข้าหน้าเข้าสู่ระบบ → &quot;เข้าด้วยรหัสนักเรียน + PIN&quot;
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
          <p className="text-xs text-amber-800">
            จด PIN นี้ให้นักเรียนตอนนี้ — ปิดกล่องนี้แล้วดูซ้ำไม่ได้ (ถ้าลืม กดสร้าง PIN ใหม่ได้)
          </p>
          <button type="button" onClick={() => setIssued(null)} className="text-sm text-slate-600 underline underline-offset-2">
            ปิด
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {roster.length === 0 && (
          <p className="p-4 text-sm text-slate-400">ยังไม่มีรายชื่อนักเรียนในวิชานี้</p>
        )}
        {[...shown].sort(compareRoster).map((r) => (
          <div key={r.id} className="p-3 text-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-slate-700">{r.full_name}</p>
              <p className="text-xs text-slate-400">
                {r.student_code}
                {placeLabel(r) && <span> · {placeLabel(r)}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  r.claimed_by
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-slate-50 text-slate-500 border border-slate-200"
                }`}
              >
                {pinRosterIds.has(r.id) ? "● เข้าด้วย PIN" : r.claimed_by ? "● เข้าระบบแล้ว" : "○ ยังไม่เคยเข้า"}
              </span>
              {/* PIN: สร้างให้คนที่ยังไม่เคยเข้า หรือเปลี่ยน/ยกเลิกของคนที่ใช้ PIN อยู่ (คนที่เข้าด้วย Google แล้วไม่ต้องใช้) */}
              {(!r.claimed_by || pinRosterIds.has(r.id)) && (
                <button
                  onClick={() => pinAction(r, "issue")}
                  disabled={busy || pinBusy === r.id}
                  className="text-xs text-slate-600 border border-slate-300 rounded-sm px-2 py-1 hover:border-slate-500 hover:text-slate-800 disabled:opacity-50 whitespace-nowrap"
                >
                  {pinBusy === r.id ? "..." : pinRosterIds.has(r.id) ? "PIN ใหม่" : "สร้าง PIN"}
                </button>
              )}
              {pinRosterIds.has(r.id) && (
                <button
                  onClick={() => pinAction(r, "revoke")}
                  disabled={busy || pinBusy === r.id}
                  className="text-xs text-slate-500 hover:text-red-700 hover:underline disabled:opacity-50 whitespace-nowrap"
                >
                  ยกเลิก PIN
                </button>
              )}
              <button
                onClick={() => removeStudent(r)}
                disabled={busy}
                aria-label={`เอา ${r.full_name} ออกจากวิชา`}
                className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
              >
                เอาออก
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
