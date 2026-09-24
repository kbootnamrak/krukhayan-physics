"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_GRADE_SCALE, type GradeScale } from "@/lib/grade";
import { dbErrorMessage } from "@/lib/db-error";

/** ระดับผลการเรียน 8 ระดับตามหลักสูตรแกนกลาง — ครูปรับได้เฉพาะเกณฑ์ขั้นต่ำ ไม่เปลี่ยนตัวเกรด */
const GRADES = DEFAULT_GRADE_SCALE.map((s) => s.grade);

function minFor(scales: GradeScale[], grade: string) {
  const source = scales.length ? scales : DEFAULT_GRADE_SCALE;
  return source.find((s) => s.grade === grade)?.min_percent ?? DEFAULT_GRADE_SCALE.find((s) => s.grade === grade)!.min_percent;
}

/**
 * เกณฑ์ตัดเกรดของวิชานี้ — ตาราง grade_scales มีมาตั้งแต่แรกแต่ไม่เคยถูกใช้
 * เดิมทุกวิชาใช้เกณฑ์ที่เขียนตายตัวในโค้ด (80 ขึ้นไป = 4 ลดทีละ 5%)
 */
export default function GradeScalePanel({
  courseId,
  scales,
  onChanged,
}: {
  courseId: string;
  scales: GradeScale[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const isCustom = scales.length > 0;
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setError(null);
    setEditing(Object.fromEntries(GRADES.map((g) => [g, String(minFor(scales, g))])));
  }

  function validate(values: Record<string, string>): GradeScale[] | string {
    const rows = GRADES.map((grade) => ({ grade, min_percent: Number(values[grade]) }));
    for (const r of rows) {
      if (!Number.isFinite(r.min_percent) || r.min_percent < 0 || r.min_percent > 100) {
        return `เกณฑ์ของเกรด ${r.grade} ต้องอยู่ระหว่าง 0 ถึง 100`;
      }
    }
    if (rows[rows.length - 1].min_percent !== 0) return "เกรด 0 ต้องเริ่มที่ 0% (ไม่งั้นคะแนนต่ำ ๆ จะไม่มีเกรด)";
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].min_percent >= rows[i - 1].min_percent) {
        return `เกณฑ์ของเกรด ${rows[i].grade} ต้องน้อยกว่าเกรด ${rows[i - 1].grade}`;
      }
    }
    return rows;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const result = validate(editing);
    if (typeof result === "string") return setError(result);

    setBusy(true);
    setError(null);
    // เพิ่มชุดใหม่ก่อนแล้วค่อยลบชุดเก่า — ถ้าพลาดกลางทาง อย่างน้อยวิชานี้ยังมีเกณฑ์อยู่
    // (ถ้าลบก่อนแล้วเพิ่มไม่สำเร็จ ทั้งวิชาจะเด้งกลับไปใช้เกณฑ์มาตรฐานโดยครูไม่รู้ตัว)
    const { data: old } = await supabase.from("grade_scales").select("id").eq("course_id", courseId);
    const { error: insertError } = await supabase
      .from("grade_scales")
      .insert(result.map((r, i) => ({ course_id: courseId, grade: r.grade, min_percent: r.min_percent, sort_order: i })));
    if (insertError) {
      setBusy(false);
      return setError(dbErrorMessage(insertError));
    }
    const oldIds = (old ?? []).map((o) => o.id);
    if (oldIds.length) await supabase.from("grade_scales").delete().in("id", oldIds);
    setBusy(false);
    setEditing(null);
    onChanged();
  }

  async function resetToDefault() {
    if (!window.confirm("กลับไปใช้เกณฑ์มาตรฐาน (80% = 4 ลดทีละ 5%) ?")) return;
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.from("grade_scales").delete().eq("course_id", courseId);
    setBusy(false);
    if (deleteError) return setError(dbErrorMessage(deleteError));
    setEditing(null);
    onChanged();
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-slate-700 text-sm">เกณฑ์ตัดเกรด</p>
          <p className="text-xs text-slate-500">
            {isCustom ? "ใช้เกณฑ์ที่ตั้งเองสำหรับวิชานี้" : "ใช้เกณฑ์มาตรฐาน — 80% ขึ้นไปได้ 4 ลดลงทีละ 5%"}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-3 text-sm">
            <button onClick={startEdit} className="text-slate-600 hover:text-slate-800 hover:underline">
              ปรับเกณฑ์
            </button>
            {isCustom && (
              <button onClick={resetToDefault} disabled={busy} className="text-slate-500 hover:text-slate-800 hover:underline">
                ใช้เกณฑ์มาตรฐาน
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {GRADES.map((g) => (
              <label key={g} className="text-xs text-slate-500 space-y-1">
                <span className="block">เกรด {g}</span>
                <span className="flex items-center gap-1">
                  <span aria-hidden>≥</span>
                  <input
                    value={editing[g]}
                    onChange={(e) => setEditing({ ...editing, [g]: e.target.value })}
                    inputMode="decimal"
                    disabled={g === "0"}
                    aria-label={`เกรด ${g} ตั้งแต่กี่เปอร์เซ็นต์`}
                    className="w-full border border-slate-300 rounded px-1.5 py-1 text-sm text-slate-800 disabled:bg-slate-50"
                  />
                  <span aria-hidden>%</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            เปลี่ยนแล้วเกรดของนักเรียนทุกคนในวิชานี้จะคำนวณใหม่ทันที ทั้งในตารางครูและหน้าของนักเรียน
          </p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} className="bg-slate-800 text-white rounded-md px-4 py-1.5 text-sm disabled:opacity-50">
              {busy ? "กำลังบันทึก..." : "บันทึกเกณฑ์"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-500 hover:underline">
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <>
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {GRADES.map((g) => (
              <li key={g}>
                <b className="text-slate-800">{g}</b> ≥ {minFor(scales, g)}%
              </li>
            ))}
          </ol>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}
