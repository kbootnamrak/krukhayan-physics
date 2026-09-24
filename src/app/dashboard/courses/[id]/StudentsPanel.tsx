"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school";

export type RosterRow = {
  id: string;
  student_code: string;
  full_name: string;
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

  const signedIn = roster.filter((r) => r.claimed_by !== null).length;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLog([]);
    setError(null);
    try {
      let rows: Record<string, unknown>[];
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      } catch {
        setError("เปิดไฟล์นี้ไม่ได้ — ต้องเป็นไฟล์ Excel (.xlsx หรือ .xls)");
        return;
      }

      const payload = rows.map((r) => ({
        student_code: String(r["รหัสนักเรียน"] ?? r["student_code"] ?? "").trim(),
        full_name: String(r["ชื่อ-สกุล"] ?? r["full_name"] ?? "").trim(),
      }));

      // ไฟล์ที่หัวคอลัมน์ไม่ตรง จะได้ทุกแถวว่าง — บอกให้ชัดแทนการขึ้น "ข้าม" ทุกบรรทัด
      if (payload.length === 0 || payload.every((r) => !r.student_code && !r.full_name)) {
        setError('ไม่พบข้อมูล — แถวแรกของชีตแรกต้องมีหัวคอลัมน์ "รหัสนักเรียน" และ "ชื่อ-สกุล" สะกดตรงตามนี้');
        return;
      }

      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, rows: payload }),
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
        setLog([
          `นำเข้า ${results.length - failed.length} จาก ${results.length} คน${failed.length ? ` — มีปัญหา ${failed.length} คน (ดูด้านล่าง)` : ""}`,
          ...results.map((r) => `${r.student_code}: ${r.status}`),
        ]);
      }
      onChanged();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  /**
   * เอานักเรียนออกจากวิชา — ลบทั้งรายชื่อที่นำเข้าและการลงทะเบียน
   * ถ้าลบแค่การลงทะเบียน นักเรียนจะถูกจับคู่กลับเข้ามาใหม่เองตอนล็อกอินครั้งถัดไป
   */
  async function removeStudent(r: RosterRow) {
    setError(null);
    let enrollmentId: string | null = null;
    let scoreCount = 0;

    if (r.claimed_by) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", courseId)
        .eq("student_id", r.claimed_by)
        .maybeSingle();
      enrollmentId = enrollment?.id ?? null;
      if (enrollmentId) {
        const { count } = await supabase
          .from("student_scores")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_id", enrollmentId)
          .not("score", "is", null);
        scoreCount = count ?? 0;
      }
    }

    const warning = scoreCount ? `\n\nคะแนนที่กรอกไว้แล้ว ${scoreCount} ช่องจะถูกลบไปด้วย และกู้คืนไม่ได้` : "";
    if (!window.confirm(`เอา ${r.full_name} (${r.student_code}) ออกจากวิชานี้?${warning}`)) return;

    setBusy(true);
    if (enrollmentId) {
      const { error: enrollError } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (enrollError) {
        setBusy(false);
        return setError(dbErrorMessage(enrollError));
      }
    }
    const { error: rosterError } = await supabase.from("class_roster").delete().eq("id", r.id);
    setBusy(false);
    if (rosterError) return setError(dbErrorMessage(rosterError));
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <p className="text-sm text-slate-600">
          อัปโหลดไฟล์ Excel (.xlsx) คอลัมน์ที่ต้องมี: <b>รหัสนักเรียน</b> และ <b>ชื่อ-สกุล</b>
        </p>
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

      {roster.length > 0 && (
        <p className="text-sm text-slate-600">
          เข้าระบบแล้ว <b className="text-slate-800">{signedIn}</b> จาก{" "}
          <b className="text-slate-800">{roster.length}</b> คน
          {signedIn < roster.length && (
            <span className="text-slate-400">
              {" "}
              — คนที่ยังไม่เข้ายังไม่เห็นคะแนนของตัวเอง
            </span>
          )}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {roster.length === 0 && (
          <p className="p-4 text-sm text-slate-400">ยังไม่มีรายชื่อนักเรียนในวิชานี้</p>
        )}
        {roster.map((r) => (
          <div key={r.id} className="p-3 text-sm flex items-center justify-between gap-3">
            <div>
              <p className="text-slate-700">{r.full_name}</p>
              <p className="text-xs text-slate-400">{r.student_code}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  r.claimed_by
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-slate-50 text-slate-500 border border-slate-200"
                }`}
              >
                {r.claimed_by ? "● เข้าระบบแล้ว" : "○ ยังไม่เคยเข้า"}
              </span>
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
