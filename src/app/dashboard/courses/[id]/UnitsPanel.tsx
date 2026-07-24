"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "K" | "P" | "A";
type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: Category; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };

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

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from("course_units").insert({ course_id: courseId, title, sort_order: units.length });
    setTitle("");
    onChanged();
  }

  async function setMax(unitId: string, category: Category, value: number) {
    await supabase
      .from("unit_components")
      .upsert({ unit_id: unitId, category, max_score: value }, { onConflict: "unit_id,category" });
    onChanged();
  }

  async function setExamMax(examType: "midterm" | "final", value: number) {
    await supabase
      .from("exams")
      .upsert({ course_id: courseId, exam_type: examType, max_score: value }, { onConflict: "course_id,exam_type" });
    onChanged();
  }

  function compFor(unitId: string, category: Category) {
    return components.find((c) => c.unit_id === unitId && c.category === category);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addUnit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อหน่วยการเรียนรู้ เช่น หน่วยที่ 1 การเคลื่อนที่"
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เพิ่มหน่วย</button>
      </form>

      <div className="space-y-3">
        {units.map((u) => (
          <div key={u.id} className="border border-slate-200 rounded-lg p-4">
            <p className="font-medium text-slate-700 text-sm mb-2">{u.title}</p>
            <div className="flex gap-4">
              {(["K", "P", "A"] as Category[]).map((cat) => (
                <label key={cat} className="text-sm text-slate-600 flex items-center gap-1">
                  {cat}
                  <input
                    type="number"
                    defaultValue={compFor(u.id, cat)?.max_score ?? 10}
                    onBlur={(e) => setMax(u.id, cat, Number(e.target.value))}
                    className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        {units.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีหน่วยการเรียนรู้</p>}
      </div>

      <div className="border border-slate-200 rounded-lg p-4">
        <p className="font-medium text-slate-700 text-sm mb-2">คะแนนสอบ</p>
        <div className="flex gap-4">
          <label className="text-sm text-slate-600 flex items-center gap-1">
            กลางภาค
            <input
              type="number"
              defaultValue={exams.find((e) => e.exam_type === "midterm")?.max_score ?? 100}
              onBlur={(e) => setExamMax("midterm", Number(e.target.value))}
              className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600 flex items-center gap-1">
            ปลายภาค
            <input
              type="number"
              defaultValue={exams.find((e) => e.exam_type === "final")?.max_score ?? 100}
              onBlur={(e) => setExamMax("final", Number(e.target.value))}
              className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
