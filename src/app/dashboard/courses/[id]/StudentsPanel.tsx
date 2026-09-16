"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
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
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const signedIn = roster.filter((r) => r.claimed_by !== null).length;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLog([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const payload = rows.map((r) => ({
        student_code: String(r["รหัสนักเรียน"] ?? r["student_code"] ?? "").trim(),
        full_name: String(r["ชื่อ-สกุล"] ?? r["full_name"] ?? "").trim(),
      }));

      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, rows: payload }),
      });
      const data = await res.json();
      if (data.error) {
        setLog([`เกิดข้อผิดพลาด: ${data.error}`]);
      } else {
        setLog(
          (data.results as { student_code: string; status: string }[]).map(
            (r) => `${r.student_code}: ${r.status}`
          )
        );
      }
      onChanged();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
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
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="text-sm" />
        {busy && <p className="text-sm text-slate-400">กำลังนำเข้า...</p>}
        {log.length > 0 && (
          <ul className="text-xs text-slate-500 mt-2 space-y-0.5 max-h-40 overflow-y-auto">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>

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
            <span
              className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                r.claimed_by
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-slate-50 text-slate-500 border border-slate-200"
              }`}
            >
              {r.claimed_by ? "● เข้าระบบแล้ว" : "○ ยังไม่เคยเข้า"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
