"use client";

import { Fragment, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcGrade, DEFAULT_GRADE_SCALE, type GradeScale } from "@/lib/grade";

type Category = "K" | "P" | "A";
type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: Category; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };
type Enrollment = { id: string; student_id: string; profiles: { full_name: string; student_code: string | null } | null };
type ScoreRow = { enrollment_id: string; source_type: "unit_component" | "exam"; source_id: string; score: number | null };

export default function ScoresPanel({
  units,
  components,
  exams,
  enrollments,
  scores,
  gradeScales,
  onChanged,
}: {
  units: Unit[];
  components: Component[];
  exams: Exam[];
  enrollments: Enrollment[];
  scores: ScoreRow[];
  gradeScales: GradeScale[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState<string | null>(null);

  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.sort_order - b.sort_order), [units]);
  const maxTotal = useMemo(() => {
    const compTotal = components.reduce((sum, c) => sum + c.max_score, 0);
    const examTotal = exams.reduce((sum, e) => sum + e.max_score, 0);
    return compTotal + examTotal;
  }, [components, exams]);

  function getScore(enrollmentId: string, sourceType: ScoreRow["source_type"], sourceId: string) {
    return scores.find(
      (s) => s.enrollment_id === enrollmentId && s.source_type === sourceType && s.source_id === sourceId
    )?.score ?? "";
  }

  async function saveScore(
    enrollmentId: string,
    sourceType: ScoreRow["source_type"],
    sourceId: string,
    value: string
  ) {
    const key = `${enrollmentId}-${sourceType}-${sourceId}`;
    setSaving(key);
    const score = value === "" ? null : Number(value);
    await supabase
      .from("student_scores")
      .upsert(
        { enrollment_id: enrollmentId, source_type: sourceType, source_id: sourceId, score },
        { onConflict: "enrollment_id,source_type,source_id" }
      );
    setSaving(null);
    onChanged();
  }

  function totalFor(enrollmentId: string) {
    let total = 0;
    for (const c of components) {
      total += Number(getScore(enrollmentId, "unit_component", c.id)) || 0;
    }
    for (const e of exams) {
      total += Number(getScore(enrollmentId, "exam", e.id)) || 0;
    }
    return total;
  }

  const scales = gradeScales.length ? gradeScales : DEFAULT_GRADE_SCALE;

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="p-2 sticky left-0 bg-slate-50 min-w-[160px]">นักเรียน</th>
            {sortedUnits.map((u) => (
              <th key={u.id} colSpan={3} className="p-2 text-center border-l border-slate-200">
                {u.title}
              </th>
            ))}
            <th className="p-2 text-center border-l border-slate-200">กลางภาค</th>
            <th className="p-2 text-center border-l border-slate-200">ปลายภาค</th>
            <th className="p-2 text-center border-l border-slate-200">รวม</th>
            <th className="p-2 text-center">เกรด</th>
          </tr>
          <tr className="text-left text-slate-400 text-xs">
            <th className="p-1 sticky left-0 bg-slate-50"></th>
            {sortedUnits.map((u) => (
              <Fragment key={u.id}>
                <th className="p-1 text-center border-l border-slate-200">K</th>
                <th className="p-1 text-center">P</th>
                <th className="p-1 text-center">A</th>
              </Fragment>
            ))}
            <th className="border-l border-slate-200"></th>
            <th className="border-l border-slate-200"></th>
            <th className="border-l border-slate-200"></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((en) => {
            const total = totalFor(en.id);
            const percent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            return (
              <tr key={en.id} className="border-t border-slate-100">
                <td className="p-2 sticky left-0 bg-white">
                  {en.profiles?.full_name}
                  <span className="text-slate-400 ml-1 text-xs">{en.profiles?.student_code}</span>
                </td>
                {sortedUnits.map((u) => (
                  <Fragment key={u.id}>
                    {(["K", "P", "A"] as Category[]).map((cat) => {
                      const comp = components.find((c) => c.unit_id === u.id && c.category === cat);
                      if (!comp) return <td key={u.id + cat} className="p-1 border-l border-slate-100" />;
                      return (
                        <td key={u.id + cat} className="p-1 border-l border-slate-100">
                          <input
                            type="number"
                            defaultValue={getScore(en.id, "unit_component", comp.id)}
                            onBlur={(e) => saveScore(en.id, "unit_component", comp.id, e.target.value)}
                            className="w-14 border border-slate-200 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                      );
                    })}
                  </Fragment>
                ))}
                {(["midterm", "final"] as const).map((type) => {
                  const exam = exams.find((e) => e.exam_type === type);
                  return (
                    <td key={type} className="p-1 border-l border-slate-100">
                      {exam ? (
                        <input
                          type="number"
                          defaultValue={getScore(en.id, "exam", exam.id)}
                          onBlur={(e) => saveScore(en.id, "exam", exam.id, e.target.value)}
                          className="w-16 border border-slate-200 rounded px-1 py-0.5 text-sm"
                        />
                      ) : null}
                    </td>
                  );
                })}
                <td className="p-2 border-l border-slate-100 text-center font-medium">
                  {total} / {maxTotal}
                </td>
                <td className="p-2 text-center font-medium">{calcGrade(percent, scales)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {saving && <p className="text-xs text-slate-400 mt-2">กำลังบันทึก...</p>}
    </div>
  );
}
