"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { downloadBlob } from "@/lib/download";
import { fmt } from "@/lib/scores";
import {
  columnHeader,
  parseScoreSheet,
  type ExcelGroup,
  type ExcelStudent,
  type ParsedCell,
} from "@/lib/scores-excel";
import type { ScoreRow } from "./ScoresPanel";

type Preview = {
  fileName: string;
  cells: ParsedCell[];
  changed: number;
  matchedColumns: string[];
  unknownCodes: string[];
  problems: string[];
  blank: number;
};

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:border-slate-500 hover:bg-slate-100 disabled:opacity-50 sm:min-h-9";

/**
 * นำเข้าคะแนนจาก Excel
 * 1. ดาวน์โหลดแบบฟอร์ม (เลือกได้ทั้งวิชาหรือทีละหน่วย) — มีรายชื่อและคะแนนที่กรอกไว้แล้ว
 * 2. กรอกใน Excel แล้วอัปโหลดกลับ → ดูสรุปก่อนว่าจะเปลี่ยนกี่ช่อง → กดยืนยันถึงบันทึก
 * ช่องว่างในไฟล์ = ไม่แตะคะแนนเดิม (ไม่ลบ)
 */
export default function ScoreImport({
  groups,
  students,
  templateStudents,
  scores,
  activeRoom,
  fileName,
  onImported,
}: {
  groups: ExcelGroup[];
  /** นักเรียนทั้งวิชา ใช้จับคู่รหัสตอนนำเข้า */
  students: ExcelStudent[];
  /** นักเรียนที่ใส่ในแบบฟอร์ม (ตามห้องที่เลือกอยู่) */
  templateStudents: ExcelStudent[];
  scores: ScoreRow[];
  activeRoom: string;
  fileName: string;
  onImported: (rows: ScoreRow[]) => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const existing = (enrollmentId: string, sourceId: string) =>
    scores.find((s) => s.enrollment_id === enrollmentId && s.source_id === sourceId)?.score ?? null;

  async function downloadTemplate() {
    setError(null);
    const XLSX = await import("xlsx");
    const chosen = unit === "all" ? groups : groups.filter((g) => g.title === unit);
    const columns = chosen.flatMap((g) => g.columns.map((c) => ({ g, c })));
    const header = ["ห้อง", "เลขที่", "รหัสนักเรียน", "ชื่อ-สกุล", ...columns.map(({ g, c }) => columnHeader(g, c))];
    const rows = templateStudents.map((s) => [
      s.classroom ?? "",
      s.class_number ?? "",
      s.student_code ?? "",
      s.full_name,
      ...columns.map(({ c }) => existing(s.id, c.sourceId) ?? ""),
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheet["!cols"] = header.map((h, i) => ({ wch: i === 3 ? 28 : Math.max(8, Math.min(30, h.length + 2)) }));
    // ตรึงหัวตารางและคอลัมน์ชื่อไว้ เลื่อนดูแล้วยังรู้ว่าช่องไหนของใคร
    sheet["!views"] = [{ state: "frozen", xSplit: 4, ySplit: 1 }];

    const help = XLSX.utils.aoa_to_sheet([
      ["วิธีใช้แบบฟอร์มนำเข้าคะแนน"],
      [""],
      ["1. กรอกคะแนนในชีต \"คะแนน\" ใต้หัวคอลัมน์ของหน่วยนั้น ๆ (ตัวเลขในวงเล็บคือคะแนนเต็ม)"],
      ["2. ช่องที่เว้นว่าง = ไม่เปลี่ยนคะแนนเดิม (ไม่ลบ) · ช่องที่มีคะแนนอยู่แล้วแก้ทับได้เลย"],
      ["3. ห้ามแก้หัวคอลัมน์และคอลัมน์ \"รหัสนักเรียน\" — ระบบใช้จับคู่ว่าคะแนนเป็นของใคร"],
      ["4. บันทึกไฟล์ แล้วกด \"นำเข้าคะแนนจาก Excel\" ในหน้ากรอกคะแนน ระบบจะสรุปให้ดูก่อนบันทึกจริง"],
      ["5. ลบคอลัมน์หน่วยที่ไม่ได้กรอกออกได้ หรือเพิ่มคอลัมน์จากไฟล์ \"ดาวน์โหลด Excel\" ได้ ถ้าหัวคอลัมน์ตรงกัน"],
    ]);
    help["!cols"] = [{ wch: 100 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "คะแนน");
    XLSX.utils.book_append_sheet(book, help, "วิธีใช้");
    const data = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const part = unit === "all" ? "ทุกหน่วย" : unit;
    downloadBlob(
      new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `แบบฟอร์มคะแนน ${fileName} ${part}${activeRoom ? ` ${activeRoom.replace("/", "-")}` : ""}.xlsx`
    );
  }

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setDone(null);
    setPreview(null);
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      let table: unknown[][];
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        // ชีตชื่อ "คะแนน" ก่อน (แบบฟอร์ม) ถ้าไม่มีใช้ชีตแรก
        const name = wb.SheetNames.includes("คะแนน") ? "คะแนน" : wb.SheetNames[0];
        table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" });
      } catch {
        return setError("เปิดไฟล์นี้ไม่ได้ — ต้องเป็นไฟล์ Excel (.xlsx หรือ .xls)");
      }
      const parsed = parseScoreSheet(table, groups, students);
      if (!parsed.ok) return setError(parsed.error);
      const changed = parsed.cells.filter((c) => existing(c.enrollmentId, c.sourceId) !== c.score).length;
      setPreview({ fileName: file.name, ...parsed, changed });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    const toSave = preview.cells.filter((c) => existing(c.enrollmentId, c.sourceId) !== c.score);
    setBusy(true);
    setError(null);
    const saved: ScoreRow[] = [];
    for (let i = 0; i < toSave.length; i += 400) {
      const chunk = toSave.slice(i, i + 400);
      const { data, error: saveError } = await supabase
        .from("student_scores")
        .upsert(
          chunk.map((c) => ({ enrollment_id: c.enrollmentId, source_type: c.sourceType, source_id: c.sourceId, score: c.score })),
          { onConflict: "enrollment_id,source_type,source_id" }
        )
        .select("enrollment_id, source_type, source_id, score");
      if (saveError) {
        setBusy(false);
        if (saved.length) onImported(saved);
        return setError(`บันทึกไปได้ ${saved.length} ช่อง แล้วเกิดปัญหา: ${dbErrorMessage(saveError)} — ลองนำเข้าไฟล์เดิมอีกครั้ง (ช่องที่บันทึกแล้วจะไม่ซ้ำ)`);
      }
      saved.push(...((data as ScoreRow[]) ?? []).map((r) => ({ ...r, score: r.score === null ? null : Number(r.score) })));
    }
    setBusy(false);
    onImported(saved);
    setPreview(null);
    setDone(`บันทึกคะแนนจาก ${preview.fileName} แล้ว ${saved.length} ช่อง`);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800"
      >
        <span className="flex items-center gap-2">
          <SheetIcon />
          นำเข้าคะแนนจาก Excel
        </span>
        <svg viewBox="0 0 24 24" className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4">
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="space-y-2">
              <p>
                <b className="text-slate-800">1. ดาวน์โหลดแบบฟอร์ม</b> — มีรายชื่อ{activeRoom ? ` ${activeRoom}` : "ทุกห้อง"}และคะแนนที่กรอกไว้แล้ว
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  aria-label="เลือกหน่วยในแบบฟอร์ม"
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base sm:min-h-9 sm:text-sm"
                >
                  <option value="all">ทุกหน่วย + สอบ</option>
                  {groups.map((g) => (
                    <option key={g.title} value={g.title}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={downloadTemplate} className={BUTTON}>
                  <DownloadIcon />
                  ดาวน์โหลดแบบฟอร์ม
                </button>
              </div>
            </li>
            <li>
              <b className="text-slate-800">2. กรอกคะแนนใน Excel</b> — ช่องที่เว้นว่างจะไม่เปลี่ยนคะแนนเดิม · ห้ามแก้หัวคอลัมน์และรหัสนักเรียน
            </li>
            <li className="space-y-2">
              <p>
                <b className="text-slate-800">3. อัปโหลดกลับ</b> — ระบบสรุปให้ดูก่อน ยังไม่บันทึกจนกว่าจะกดยืนยัน
              </p>
              <label className={`${BUTTON} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
                <UploadIcon />
                {busy && !preview ? "กำลังอ่านไฟล์..." : "เลือกไฟล์ Excel"}
                <input type="file" accept=".xlsx,.xls" onChange={readFile} disabled={busy} className="sr-only" />
              </label>
            </li>
          </ol>

          {error && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {done}
            </p>
          )}

          {preview && (
            <section aria-label="สรุปก่อนบันทึก" className="space-y-3 rounded-md border-2 border-porcelain p-4">
              <p className="font-display font-semibold text-slate-800">{preview.fileName}</p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>
                  คอลัมน์ที่พบ: <span className="text-slate-800">{preview.matchedColumns.join(" · ")}</span>
                </li>
                <li>
                  จะบันทึก <b className="font-num tnum text-lg text-slate-800">{preview.changed}</b> ช่อง
                  {preview.cells.length > preview.changed && (
                    <span className="text-slate-500"> (อีก {preview.cells.length - preview.changed} ช่องเท่าเดิม ไม่ต้องบันทึก)</span>
                  )}
                </li>
                {preview.blank > 0 && <li className="text-slate-500">ช่องว่าง {preview.blank} ช่อง — ข้าม ไม่ลบคะแนนเดิม</li>}
              </ul>
              {preview.unknownCodes.length > 0 && (
                <p className="text-sm text-amber-800">
                  ไม่พบรหัสในวิชานี้ {preview.unknownCodes.length} คน (ข้าม): {preview.unknownCodes.slice(0, 10).join(", ")}
                  {preview.unknownCodes.length > 10 && " …"}
                </p>
              )}
              {preview.problems.length > 0 && (
                <div className="space-y-1 text-sm text-red-800">
                  <p className="font-semibold">ช่องที่ใส่ค่าผิด {preview.problems.length} ช่อง — จะไม่บันทึกช่องเหล่านี้ แก้ในไฟล์แล้วนำเข้าใหม่ได้</p>
                  <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                    {preview.problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || preview.changed === 0}
                  className="min-h-11 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:min-h-9"
                >
                  {busy ? "กำลังบันทึก..." : preview.changed === 0 ? "ไม่มีคะแนนที่เปลี่ยน" : `ยืนยันบันทึก ${fmt(preview.changed)} ช่อง`}
                </button>
                <button type="button" onClick={() => setPreview(null)} disabled={busy} className={BUTTON}>
                  ยกเลิก
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-trace-lime" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14" />
    </svg>
  );
}
