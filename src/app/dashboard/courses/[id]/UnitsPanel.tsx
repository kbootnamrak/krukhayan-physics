"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { fmt } from "@/lib/scores";

type Category = "K" | "P" | "A";
type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: Category; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };

const CATEGORIES: Category[] = ["K", "P", "A"];
const EXAM_LABEL = { midterm: "กลางภาค", final: "ปลายภาค" } as const;

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
      .insert({ course_id: courseId, title: title.trim(), sort_order: units.length })
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

  const missing = units
    .map((u) => ({ unit: u, cats: CATEGORIES.filter((cat) => !compFor(u.id, cat)) }))
    .filter((m) => m.cats.length > 0);
  const missingExams = (["midterm", "final"] as const).filter((t) => !exams.some((e) => e.exam_type === t));

  const totalMax =
    components.reduce((s, c) => s + Number(c.max_score), 0) + exams.reduce((s, e) => s + Number(e.max_score), 0);

  return (
    <div className="space-y-6">
      <form onSubmit={addUnit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">เพิ่มหน่วยการเรียนรู้</p>
        <div className="flex gap-2 flex-wrap items-end">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อหน่วย เช่น หน่วยที่ 1 การเคลื่อนที่"
            className="flex-1 min-w-[220px] border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {CATEGORIES.map((cat) => (
            <label key={cat} className="text-sm text-slate-600 flex items-center gap-1">
              {cat}
              <input
                type="number"
                min="0"
                step="any"
                value={newMax[cat]}
                onChange={(e) => setNewMax((m) => ({ ...m, [cat]: e.target.value }))}
                className="w-16 border border-slate-300 rounded-md px-2 py-2 text-sm"
              />
            </label>
          ))}
          <button disabled={adding} className="bg-slate-800 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
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

      <div className="space-y-3">
        {units.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="font-medium text-slate-700 text-sm mb-2">{u.title}</p>
            <div className="flex gap-4 flex-wrap">
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

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <p className="font-medium text-slate-700 text-sm mb-2">คะแนนสอบ</p>
        <div className="flex gap-4 flex-wrap">
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
      <label className="text-sm text-slate-600 flex items-center gap-1">
        {label}
        <input
          ref={ref}
          // key ผูกกับค่าในฐานข้อมูล ให้ช่องรีเซ็ตเป็นค่าจริงทุกครั้งที่โหลดใหม่
          key={String(value)}
          type="number"
          min="0"
          step="any"
          defaultValue={value ?? ""}
          placeholder="—"
          disabled={status === "saving"}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`${wide ? "w-20" : "w-16"} border rounded-md px-2 py-1 text-sm ${border}`}
        />
      </label>
      {error && <p className="text-xs text-red-600 max-w-[16rem]">{error}</p>}
    </div>
  );
}
