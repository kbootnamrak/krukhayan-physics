"use client";

import { use, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcGrade, DEFAULT_GRADE_SCALE } from "@/lib/grade";
import UnitsPanel from "./UnitsPanel";
import ScoresPanel from "./ScoresPanel";
import StudentsPanel, { type RosterRow } from "./StudentsPanel";
import MaterialsPanel from "./MaterialsPanel";

type Tab = "units" | "scores" | "students" | "materials" | "grade";

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [courseLabel, setCourseLabel] = useState("");
  const [tab, setTab] = useState<Tab>("units");

  const [units, setUnits] = useState<{ id: string; title: string; sort_order: number }[]>([]);
  const [components, setComponents] = useState<{ id: string; unit_id: string; category: "K" | "P" | "A"; max_score: number }[]>([]);
  const [exams, setExams] = useState<{ id: string; exam_type: "midterm" | "final"; max_score: number }[]>([]);
  const [enrollments, setEnrollments] = useState<{ id: string; student_id: string; profiles: { full_name: string; student_code: string | null } | null }[]>([]);
  const [scores, setScores] = useState<{ enrollment_id: string; source_type: "unit_component" | "exam"; source_id: string; score: number | null }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; title: string; link_url: string | null }[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    if (!uid) return;

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).single();
    const teacher = profile?.role === "teacher";
    setIsTeacher(teacher);
    if (!teacher) setTab("grade");

    const { data: course } = await supabase
      .from("courses")
      .select("id, subjects(name), terms(academic_year, semester)")
      .eq("id", courseId)
      .single();
    if (course) {
      const subj = (course as unknown as { subjects: { name: string } | null }).subjects;
      const term = (course as unknown as { terms: { academic_year: number; semester: number } | null }).terms;
      setCourseLabel(`${subj?.name ?? ""} — ปีการศึกษา ${term?.academic_year ?? ""} เทอม ${term?.semester ?? ""}`);
    }

    const { data: unitData } = await supabase
      .from("course_units")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order");
    setUnits(unitData ?? []);

    const unitIds = (unitData ?? []).map((u) => u.id);
    const { data: compData } = unitIds.length
      ? await supabase.from("unit_components").select("id, unit_id, category, max_score").in("unit_id", unitIds)
      : { data: [] };
    setComponents(compData ?? []);

    const { data: examData } = await supabase.from("exams").select("id, exam_type, max_score").eq("course_id", courseId);
    setExams(examData ?? []);

    const { data: enrollData } = await supabase
      .from("enrollments")
      .select("id, student_id, profiles(full_name, student_code)")
      .eq("course_id", courseId);
    setEnrollments((enrollData as unknown as typeof enrollments) ?? []);

    if (teacher) {
      const { data: rosterData } = await supabase
        .from("class_roster")
        .select("id, student_code, full_name, claimed_by, claimed_at")
        .eq("course_id", courseId)
        .order("student_code");
      setRoster((rosterData as RosterRow[]) ?? []);
    }

    const enrollIds = (enrollData ?? []).map((e) => e.id);
    const { data: scoreData } = enrollIds.length
      ? await supabase
          .from("student_scores")
          .select("enrollment_id, source_type, source_id, score")
          .in("enrollment_id", enrollIds)
      : { data: [] };
    setScores(scoreData ?? []);

    const { data: materialData } = await supabase
      .from("materials")
      .select("id, title, link_url")
      .eq("course_id", courseId);
    setMaterials(materialData ?? []);

    setLoading(false);
  }, [courseId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-500">กำลังโหลด...</div>;
  }

  const myEnrollment = enrollments.find((e) => e.student_id === userId);
  const maxTotal = components.reduce((s, c) => s + c.max_score, 0) + exams.reduce((s, e) => s + e.max_score, 0);
  const myTotal = myEnrollment
    ? scores
        .filter((s) => s.enrollment_id === myEnrollment.id)
        .reduce((sum, s) => sum + (s.score ?? 0), 0)
    : 0;
  const myPercent = maxTotal > 0 ? (myTotal / maxTotal) * 100 : 0;

  const tabs: { key: Tab; label: string; teacherOnly?: boolean }[] = [
    { key: "units", label: "หน่วยการเรียนรู้", teacherOnly: true },
    { key: "scores", label: "กรอกคะแนน", teacherOnly: true },
    { key: "students", label: "นักเรียน", teacherOnly: true },
    { key: "materials", label: "สื่อการสอน" },
    { key: "grade", label: "คะแนนของฉัน" },
  ];

  return (
    <div className="px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">{courseLabel}</h1>

        <div className="flex gap-1 border-b border-slate-200">
          {tabs
            .filter((t) => !t.teacherOnly || isTeacher)
            .filter((t) => t.key !== "grade" || !isTeacher)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm ${
                  tab === t.key ? "border-b-2 border-slate-800 text-slate-800 font-medium" : "text-slate-500"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {tab === "units" && isTeacher && (
          <UnitsPanel courseId={courseId} units={units} components={components} exams={exams} onChanged={load} />
        )}

        {tab === "scores" && isTeacher && (
          <ScoresPanel
            units={units}
            components={components}
            exams={exams}
            enrollments={enrollments}
            scores={scores}
            gradeScales={DEFAULT_GRADE_SCALE}
            onChanged={load}
          />
        )}

        {tab === "students" && isTeacher && (
          <StudentsPanel courseId={courseId} roster={roster} onChanged={load} />
        )}

        {tab === "materials" && (
          <MaterialsPanel courseId={courseId} materials={materials} isTeacher={isTeacher} onChanged={load} />
        )}

        {tab === "grade" && !isTeacher && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            {units.map((u) => (
              <div key={u.id} className="border-b border-slate-100 pb-3">
                <p className="font-medium text-slate-700 text-sm mb-1">{u.title}</p>
                <div className="flex gap-4 text-sm text-slate-600">
                  {components
                    .filter((c) => c.unit_id === u.id)
                    .map((c) => {
                      const s = myEnrollment
                        ? scores.find(
                            (sc) =>
                              sc.enrollment_id === myEnrollment.id &&
                              sc.source_type === "unit_component" &&
                              sc.source_id === c.id
                          )
                        : undefined;
                      return (
                        <span key={c.id}>
                          {c.category}: {s?.score ?? "-"} / {c.max_score}
                        </span>
                      );
                    })}
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-sm text-slate-600">
              {exams.map((e) => {
                const s = myEnrollment
                  ? scores.find(
                      (sc) => sc.enrollment_id === myEnrollment.id && sc.source_type === "exam" && sc.source_id === e.id
                    )
                  : undefined;
                return (
                  <span key={e.id}>
                    {e.exam_type === "midterm" ? "กลางภาค" : "ปลายภาค"}: {s?.score ?? "-"} / {e.max_score}
                  </span>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-slate-700 font-medium">
                รวม {myTotal} / {maxTotal} ({myPercent.toFixed(1)}%)
              </span>
              <span className="text-xl font-semibold text-slate-800">
                เกรด {calcGrade(myPercent, DEFAULT_GRADE_SCALE)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
