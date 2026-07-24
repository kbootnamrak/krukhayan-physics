"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type Enrollment = { id: string; profiles: { full_name: string; student_code: string | null } | null };

export default function StudentsPanel({
  courseId,
  enrollments,
  onChanged,
}: {
  courseId: string;
  enrollments: Enrollment[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

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
        email: r["อีเมล"] ?? r["email"] ? String(r["อีเมล"] ?? r["email"]).trim() : undefined,
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
        setLog((data.results as { student_code: string; status: string }[]).map((r) => `${r.student_code}: ${r.status}`));
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
          อัปโหลดไฟล์ Excel (.xlsx) คอลัมน์ที่ต้องมี: <b>รหัสนักเรียน</b>, <b>ชื่อ-สกุล</b>, และ <b>อีเมล</b> (ถ้ามี — ถ้าไม่มีระบบจะสร้างอีเมลจำลองให้อัตโนมัติ)
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

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {enrollments.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่มีนักเรียนในวิชานี้</p>}
        {enrollments.map((en) => (
          <div key={en.id} className="p-3 text-sm flex justify-between">
            <span>{en.profiles?.full_name}</span>
            <span className="text-slate-400">{en.profiles?.student_code}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
