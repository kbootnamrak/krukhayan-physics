"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { fmt } from "@/lib/scores";
import { EXAM_TRACE, unitTrace } from "@/lib/traces";
import { UnitGlyph } from "@/components/PhysicsArt";

type Category = "K" | "P" | "A";
type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: Category; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };

const CATEGORIES: Category[] = ["K", "P", "A"];
const EXAM_LABEL = { midterm: "กลางภาค", final: "ปลายภาค" } as const;

// ตัวอักษร 16px บนมือถือ — เล็กกว่านี้ iPhone จะซูมหน้าเองตอนแตะช่อง
const TEXT_INPUT = "border border-slate-300 rounded-md px-3 py-2.5 text-base bg-white sm:py-2 sm:text-sm";
const PRIMARY = "min-h-11 bg-slate-800 text-white rounded-md px-4 text-sm font-semibold disabled:opacity-50 sm:min-h-9";
// ปุ่มจัดการหน่วย: มือถือสูง 44px กดง่าย · จอกว้างเป็นตัวหนังสือเล็กเหมือนเดิม
const UNIT_ACTION =
  "grid min-h-11 min-w-11 place-items-center rounded-md border border-slate-200 px-3 text-slate-500 hover:border-slate-400 hover:text-slate-800 disabled:opacity-30 sm:min-h-0 sm:min-w-0 sm:border-0 sm:px-0";

type CommitResult = { error?: string; revert?: boolean };

export default function UnitsPanel({
  courseId,
  units,
  components,
  exams,
  onChanged,
}: {
  courseId: string;
  units: Unit[];
  components: Component[];
  exams: Exam[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [newMax, setNewMax] = useState<Record<Category, string>>({ K: "10", P: "10", A: "10" });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [unitBusy, setUnitBusy] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  function compFor(unitId: string, category: Category) {
    return components.find((c) => c.unit_id === unitId && c.category === category);
  }

  /** ถ้ามีคะแนนนักเรียนในรายการนี้แล้ว ต้องถามก่อนลบ เพราะคะแนนจะหายตามไปด้วย */
  async function confirmRemove(sourceType: "unit_component" | "exam", sourceId: string, label: string) {
    const { count, error } = await supabase
      .from("student_scores")
      .select("id", { count: "exact", head: true })
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .not("score", "is", null);
    if (error) return { ok: false as const, error: dbErrorMessage(error) };
    if (!count) return { ok: true as const };
    const yes = window.confirm(
      `${label} มีคะแนนของนักเรียนแล้ว ${count} คน\nถ้าเอาช่องนี้ออก คะแนนเหล่านั้นจะถูกลบไปด้วย\n\nยืนยันจะเอาออกไหม?`
    );
    return yes ? { ok: true as const } : { ok: false as const, cancelled: true };
  }

  async function commitComponent(unit: Unit, category: Category, next: number | null): Promise<CommitResult> {
    const comp = compFor(unit.id, category);

    if (next === null) {
      if (!comp) return {};
      const check = await confirmRemove("unit_component", comp.id, `${unit.title} ช่อง ${category}`);
      if (!check.ok) return check.error ? { error: check.error } : { revert: true };
      const { error } = await supabase.from("unit_components").delete().eq("id", comp.id);
      if (error) return { error: dbErrorMessage(error) };
    } else {
      const { error } = await supabase
        .from("unit_components")
        .upsert({ unit_id: unit.id, category, max_score: next }, { onConflict: "unit_id,category" });
      if (error) return { error: dbErrorMessage(error) };
    }

    onChanged();
    return {};
  }

  async function commitExam(examType: "midterm" | "final", next: number | null): Promise<CommitResult> {
    const exam = exams.find((e) => e.exam_type === examType);

    if (next === null) {
      if (!exam) return {};
      const check = await confirmRemove("exam", exam.id, `สอบ${EXAM_LABEL[examType]}`);
      if (!check.ok) return check.error ? { error: check.error } : { revert: true };
      const { error } = await supabase.from("exams").delete().eq("id", exam.id);
      if (error) return { error: dbErrorMessage(error) };
    } else {
      const { error } = await supabase
        .from("exams")
        .upsert({ course_id: courseId, exam_type: examType, max_score: next }, { onConflict: "course_id,exam_type" });
      if (error) return { error: dbErrorMessage(error) };
    }

    onChanged();
    return {};
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!title.trim()) return;

    const maxes: { category: Category; max_score: number }[] = [];
    for (const cat of CATEGORIES) {
      const text = newMax[cat].trim();
      if (text === "") continue;
      const value = Number(text);
      if (!Number.isFinite(value) || value <= 0) {
        setAddError(`คะแนนเต็ม ${cat} ต้องเป็นตัวเลขมากกว่า 0 (หรือเว้นว่างถ้าหน่วยนี้ไม่มี ${cat})`);
        return;
      }
      maxes.push({ category: cat, max_score: value });
    }

    setAdding(true);
    const { data: unit, error } = await supabase
      .from("course_units")
      .insert({ course_id: courseId, title: title.trim(), sort_order: Math.max(-1, ...units.map((u) => u.sort_order)) + 1 })
      .select("id")
      .single();

    if (error || !unit) {
      setAdding(false);
      setAddError(dbErrorMessage(error));
      return;
    }

    // บันทึกคะแนนเต็มพร้อมกับหน่วยเลย เดิมค่า 10 ที่เห็นบนจอเป็นแค่ค่าตั้งต้น
    // ถ้าครูไม่ได้คลิกเข้า-ออกช่อง ค่าจะไม่ถูกบันทึก แล้วหน้ากรอกคะแนนจะไม่มีช่องนั้น
    if (maxes.length > 0) {
      const { error: compError } = await supabase
        .from("unit_components")
        .insert(maxes.map((m) => ({ unit_id: unit.id, ...m })));
      if (compError) {
        setAddError(`เพิ่มหน่วยแล้ว แต่บันทึกคะแนนเต็มไม่สำเร็จ: ${dbErrorMessage(compError)} — กรอกคะแนนเต็มในหน่วยด้านล่างอีกครั้ง`);
      }
    }

    setAdding(false);
    setTitle("");
    setNewMax({ K: "10", P: "10", A: "10" });
    onChanged();
  }

  // ---------- แก้ชื่อ / เรียงลำดับ / ลบหน่วย ----------
  const sortedUnits = [...units].sort((a, b) => a.sort_order - b.sort_order);

  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming || !renaming.title.trim()) return;
    setUnitBusy(true);
    setUnitError(null);
    const { error } = await supabase.from("course_units").update({ title: renaming.title.trim() }).eq("id", renaming.id);
    setUnitBusy(false);
    if (error) return setUnitError(dbErrorMessage(error));
    setRenaming(null);
    onChanged();
  }

  async function moveUnit(index: number, direction: -1 | 1) {
    const order = [...sortedUnits];
    const [moved] = order.splice(index, 1);
    order.splice(index + direction, 0, moved);
    // เขียนลำดับใหม่ทุกหน่วยเป็น 0,1,2,... — ค่าเดิมอาจซ้ำกันได้ ถ้าสลับแค่สองตัวลำดับอาจไม่เปลี่ยน
    setUnitBusy(true);
    setUnitError(null);
    const results = await Promise.all(
      order.map((u, i) =>
        u.sort_order === i ? null : supabase.from("course_units").update({ sort_order: i }).eq("id", u.id)
      )
    );
    setUnitBusy(false);
    const failed = results.find((r) => r?.error);
    if (failed?.error) setUnitError(dbErrorMessage(failed.error));
    onChanged();
  }

  async function deleteUnit(unit: Unit) {
    const compIds = components.filter((c) => c.unit_id === unit.id).map((c) => c.id);
    setUnitBusy(true);
    setUnitError(null);
    const { count, error: countError } = compIds.length
      ? await supabase
          .from("student_scores")
          .select("id", { count: "exact", head: true })
          .eq("source_type", "unit_component")
          .in("source_id", compIds)
          .not("score", "is", null)
      : { count: 0, error: null };
    setUnitBusy(false);
    if (countError) return setUnitError(dbErrorMessage(countError));

    const warning = count
      ? `\n\nคะแนนนักเรียนที่กรอกในหน่วยนี้แล้ว ${count} ช่อง จะถูกลบไปด้วย และกู้คืนไม่ได้`
      : "";
    if (!window.confirm(`ลบ "${unit.title}" ?${warning}`)) return;

    setUnitBusy(true);
    const { error } = await supabase.from("course_units").delete().eq("id", unit.id);
    setUnitBusy(false);
    if (error) return setUnitError(dbErrorMessage(error));
    onChanged();
  }

  const missing = sortedUnits
    .map((u) => ({ unit: u, cats: CATEGORIES.filter((cat) => !compFor(u.id, cat)) }))
    .filter((m) => m.cats.length > 0);
  const missingExams = (["midterm", "final"] as const).filter((t) => !exams.some((e) => e.exam_type === t));

  const totalMax =
    components.reduce((s, c) => s + Number(c.max_score), 0) + exams.reduce((s, e) => s + Number(e.max_score), 0);

  return (
    <div className="space-y-6">
      <form onSubmit={addUnit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">เพิ่มหน่วยการเรียนรู้</p>
        {/* มือถือ: ชื่อหน่วยเต็มแถว → K P A สามช่องเท่ากัน → ปุ่มเต็มกว้าง */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อหน่วย เช่น หน่วยที่ 1 การเคลื่อนที่"
            aria-label="ชื่อหน่วย"
            className={`${TEXT_INPUT} sm:flex-1 sm:min-w-[220px]`}
          />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="text-sm text-slate-600 flex items-center gap-1.5">
                <span className="font-display font-semibold">{cat}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newMax[cat]}
                  onChange={(e) => setNewMax((m) => ({ ...m, [cat]: e.target.value }))}
                  aria-label={`คะแนนเต็ม ${cat}`}
                  className="w-full min-w-0 border border-slate-300 rounded-md px-2 py-2.5 text-base text-center bg-white sm:w-16 sm:py-2 sm:text-sm"
                />
              </label>
            ))}
          </div>
          <button disabled={adding} className={PRIMARY}>
            {adding ? "กำลังเพิ่ม..." : "เพิ่มหน่วย"}
          </button>
        </div>
        <p className="text-xs text-slate-400">ช่อง K / P / A คือคะแนนเต็ม — ถ้าหน่วยนี้ไม่มีคะแนนส่วนไหน เว้นว่างไว้ได้</p>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </form>

      {(missing.length > 0 || missingExams.length > 0) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 space-y-1">
          <p className="font-medium">ยังไม่ได้ตั้งคะแนนเต็ม</p>
          <ul className="list-disc pl-5">
            {missing.map((m) => (
              <li key={m.unit.id}>
                {m.unit.title}: {m.cats.join(", ")}
              </li>
            ))}
            {missingExams.map((t) => (
              <li key={t}>สอบ{EXAM_LABEL[t]}</li>
            ))}
          </ul>
          <p className="text-amber-800">
            ช่องที่ว่างจะไม่มีให้กรอกคะแนน และไม่นับในคะแนนรวม — ถ้าตั้งใจไม่ใช้ส่วนนั้นจริง ๆ ปล่อยว่างไว้ได้
          </p>
        </div>
      )}

      {unitError && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-md px-3 py-2">
          {unitError}
        </p>
      )}

      <div className="space-y-3">
        {sortedUnits.map((u, i) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-lg p-4" style={{ borderTop: `3px solid ${unitTrace(i)}` }}>
            {renaming?.id === u.id ? (
              <form onSubmit={saveRename} className="flex flex-col gap-2 mb-3 sm:flex-row sm:flex-wrap">
                <input
                  value={renaming.title}
                  onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                  aria-label="ชื่อหน่วย"
                  className={`${TEXT_INPUT} sm:flex-1 sm:min-w-[200px]`}
                  autoFocus
                  required
                />
                <div className="flex gap-2">
                  <button disabled={unitBusy} className={`${PRIMARY} flex-1 sm:flex-none`}>
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(null)}
                    className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-600 sm:min-h-0 sm:flex-none sm:border-0 sm:hover:underline"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              // มือถือ: ชื่อหน่วยอยู่บน ปุ่มจัดการเรียงแถวล่าง · จอกว้าง: ปุ่มชิดขวาแถวเดียวกัน
              <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <p className="flex items-center gap-2 font-display font-semibold text-slate-800">
                  <span className="shrink-0" style={{ color: unitTrace(i) }}>
                    <UnitGlyph title={u.title} className="size-5" />
                  </span>
                  <span className="min-w-0 break-words">{u.title}</span>
                </p>
                <div className="flex gap-2 shrink-0 text-sm sm:gap-3">
                  <button onClick={() => moveUnit(i, -1)} disabled={unitBusy || i === 0} aria-label={`เลื่อน ${u.title} ขึ้น`} className={UNIT_ACTION}>
                    <Chevron up />
                  </button>
                  <button
                    onClick={() => moveUnit(i, 1)}
                    disabled={unitBusy || i === sortedUnits.length - 1}
                    aria-label={`เลื่อน ${u.title} ลง`}
                    className={UNIT_ACTION}
                  >
                    <Chevron />
                  </button>
                  <button onClick={() => setRenaming({ id: u.id, title: u.title })} className={`${UNIT_ACTION} sm:hover:underline`}>
                    แก้ชื่อ
                  </button>
                  {/* มือถือ: แยกไปชิดขวาสุด ห่างจากปุ่มอื่น กันกดพลาด */}
                  <button
                    onClick={() => deleteUnit(u)}
                    disabled={unitBusy}
                    className={`${UNIT_ACTION} ml-auto text-red-600 hover:text-red-800 sm:ml-0 sm:hover:underline`}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4">
              {CATEGORIES.map((cat) => (
                <MaxInput
                  key={cat}
                  label={cat}
                  value={compFor(u.id, cat)?.max_score ?? null}
                  onCommit={(next) => commitComponent(u, cat, next)}
                />
              ))}
            </div>
          </div>
        ))}
        {units.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีหน่วยการเรียนรู้</p>}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4" style={{ borderTop: `3px solid ${EXAM_TRACE}` }}>
        <p className="font-display font-semibold text-slate-800 mb-3">คะแนนสอบ</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4">
          {(["midterm", "final"] as const).map((t) => (
            <MaxInput
              key={t}
              label={EXAM_LABEL[t]}
              wide
              value={exams.find((e) => e.exam_type === t)?.max_score ?? null}
              onCommit={(next) => commitExam(t, next)}
            />
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-600">
        คะแนนเต็มรวมทั้งวิชา <b className="text-slate-800">{fmt(totalMax)}</b> คะแนน
      </p>
    </div>
  );
}

/**
 * ช่องคะแนนเต็ม — แสดงเฉพาะค่าที่บันทึกในฐานข้อมูลจริง ถ้ายังไม่ได้ตั้งจะเป็นช่องว่างสีเหลือง
 * บันทึกเมื่อออกจากช่อง (หรือกด Enter) และบอกผลให้เห็นทุกครั้ง
 */
function MaxInput({
  label,
  value,
  wide,
  onCommit,
}: {
  label: string;
  value: number | null;
  wide?: boolean;
  onCommit: (next: number | null) => Promise<CommitResult>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const input = ref.current;
    if (!input) return;
    const text = input.value.trim();
    const next = text === "" ? null : Number(text);

    if (next !== null && (!Number.isFinite(next) || next <= 0)) {
      setStatus("error");
      setError("ต้องเป็นตัวเลขมากกว่า 0");
      return;
    }
    if (next === (value === null ? null : Number(value))) {
      setStatus("idle");
      setError(null);
      return;
    }

    setStatus("saving");
    const result = await onCommit(next);
    if (result.revert) {
      input.value = value === null ? "" : String(value);
      setStatus("idle");
      setError(null);
    } else if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      setStatus("saved");
      setError(null);
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    }
  }

  const missing = value === null;
  const border =
    status === "error"
      ? "border-red-500 bg-red-50"
      : status === "saved"
        ? "border-green-600"
        : missing
          ? "border-amber-400 bg-amber-50"
          : "border-slate-300";

  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-600 flex items-center gap-1.5">
        <span className={wide ? "whitespace-nowrap" : "font-display font-semibold"}>{label}</span>
        <input
          ref={ref}
          // key ผูกกับค่าในฐานข้อมูล ให้ช่องรีเซ็ตเป็นค่าจริงทุกครั้งที่โหลดใหม่
          key={String(value)}
          // text + แป้นตัวเลข แทน type="number" — ช่อง number เปลี่ยนค่าเองเวลาหมุนลูกกลิ้งเมาส์ผ่าน
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={`คะแนนเต็ม ${label}`}
          defaultValue={value ?? ""}
          placeholder="—"
          disabled={status === "saving"}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`w-full min-w-0 border rounded-md px-2 py-2.5 text-base text-center sm:py-1 sm:text-sm ${wide ? "sm:w-20" : "sm:w-16"} ${border}`}
        />
      </label>
      {error && <p className="text-xs text-red-600 max-w-[16rem]">{error}</p>}
    </div>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-4 ${up ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
