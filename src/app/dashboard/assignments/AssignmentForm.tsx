"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { fromLocalInput, toLocalInput, type Assignment, type ComponentOption } from "@/lib/assignments";

/**
 * ฟอร์มสร้าง/แก้ไขงาน (ครู) — ใช้ทั้งแท็บ "งาน" ในหน้ารายวิชาและหน้างาน
 */
export default function AssignmentForm({
  courseId,
  initial,
  componentOptions,
  rooms,
  onSaved,
  onCancel,
}: {
  courseId: string;
  initial?: Assignment;
  componentOptions: ComponentOption[];
  rooms: string[];
  onSaved: (a: Assignment) => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [due, setDue] = useState(() => toLocalInput(initial?.due_at ?? null) || defaultDue());
  const [maxScore, setMaxScore] = useState(initial ? String(Number(initial.max_score)) : "10");
  const [componentId, setComponentId] = useState(initial?.component_id ?? "");
  const [allRooms, setAllRooms] = useState(!initial?.rooms);
  const [picked, setPicked] = useState<string[]>(initial?.rooms ?? []);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const max = Number(maxScore.replace(",", "."));
    if (!title.trim()) return setError("ใส่ชื่องาน");
    if (!Number.isFinite(max) || max <= 0) return setError("คะแนนเต็มต้องมากกว่า 0");
    if (!allRooms && picked.length === 0) return setError("เลือกห้องอย่างน้อย 1 ห้อง หรือเลือกทุกห้อง");
    setBusy(true);
    setError(null);
    const row = {
      course_id: courseId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      due_at: fromLocalInput(due),
      max_score: max,
      component_id: componentId || null,
      rooms: allRooms ? null : picked,
      published,
    };
    const res = initial
      ? await supabase.from("assignments").update(row).eq("id", initial.id).select().single()
      : await supabase.from("assignments").insert(row).select().single();
    setBusy(false);
    if (res.error) return setError(dbErrorMessage(res.error));
    onSaved(res.data as Assignment);
  }

  const field = "w-full rounded-sm border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 sm:text-sm";
  const label = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={save} className="space-y-4 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-slate-800">{initial ? "แก้ไขงาน" : "สร้างงานใหม่"}</h2>

      <div className="space-y-1">
        <label htmlFor="as-title" className={label}>ชื่องาน</label>
        <input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ใบงานที่ 1 สเปกตรัมคลื่นแม่เหล็กไฟฟ้า" className={field} />
      </div>

      <div className="space-y-1">
        <label htmlFor="as-inst" className={label}>
          คำชี้แจง <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
        </label>
        <textarea
          id="as-inst"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="เช่น ทำใบงานหน้า 1–2 ถ่ายรูปให้เห็นชื่อ-เลขที่ชัดเจน"
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="as-due" className={label}>กำหนดส่ง</label>
          <input id="as-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          <p className="text-xs text-slate-500">ส่งเลยกำหนดได้ ระบบติดป้าย &quot;ส่งช้า&quot; ให้ · เว้นว่าง = ไม่กำหนด</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="as-max" className={label}>คะแนนเต็มของงาน</label>
          <input id="as-max" inputMode="decimal" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className={field} />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="as-comp" className={label}>คะแนนเข้าช่อง</label>
        <select id="as-comp" value={componentId} onChange={(e) => setComponentId(e.target.value)} className={field}>
          <option value="">ไม่ผูก — ดูคะแนนในหน้างานอย่างเดียว</option>
          {componentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          ตรวจแล้วคะแนนเข้าช่องนี้อัตโนมัติ (ปรับสัดส่วนตามคะแนนเต็มของช่อง ปัดเป็นจำนวนเต็ม) ถ้าผูกหลายงานกับช่องเดียว
          ระบบรวมคะแนนทุกงานแล้วเทียบสัดส่วน · คะแนนเดิมในช่องนี้จะถูกแทนที่เมื่อเริ่มตรวจ
          {componentOptions.length === 0 && " — วิชานี้ยังไม่มีหน่วยการเรียนรู้ เพิ่มได้ที่แท็บ หน่วยการเรียนรู้"}
        </p>
      </div>

      {rooms.length > 0 && (
        <fieldset className="space-y-2">
          <legend className={label}>มอบหมายให้</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={allRooms} onClick={() => setAllRooms(true)}>ทุกห้อง</Chip>
            {rooms.map((r) => {
              const on = !allRooms && picked.includes(r);
              return (
                <Chip
                  key={r}
                  on={on}
                  onClick={() => {
                    setAllRooms(false);
                    setPicked((p) => (allRooms ? [r] : on ? p.filter((x) => x !== r) : [...p, r]));
                  }}
                >
                  {r}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:min-h-0">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5 accent-[var(--trace-magenta)]" />
        เผยแพร่ให้นักเรียนเห็นและส่งได้ทันที
      </label>

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-sm border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-9">
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-sm bg-[oklch(50%_0.24_345)] px-5 text-sm font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50 sm:min-h-9"
        >
          {busy ? "กำลังบันทึก..." : initial ? "บันทึก" : "สร้างงาน"}
        </button>
      </div>
    </form>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-sm border-2 px-3 text-sm sm:min-h-9 ${on ? "border-trace-magenta bg-[color-mix(in_oklch,var(--trace-magenta)_12%,transparent)] font-semibold text-slate-800" : "border-slate-300 text-slate-600 hover:border-slate-500"}`}
    >
      {children}
    </button>
  );
}

/** ค่าเริ่มต้น: อีก 7 วัน เวลา 23:59 */
function defaultDue(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d.toISOString());
}
