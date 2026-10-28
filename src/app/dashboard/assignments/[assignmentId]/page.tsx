"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { componentOptions, type Assignment, type ComponentOption, type Submission } from "@/lib/assignments";
import Breadcrumbs from "../../Breadcrumbs";
import StudentAssignment from "./StudentAssignment";
import TeacherAssignment, { type Student } from "./TeacherAssignment";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "teacher"; a: Assignment; course: string; students: Student[]; subs: Submission[]; options: ComponentOption[]; rooms: string[] }
  | { kind: "student"; a: Assignment; course: string; enrollmentId: string; sub: Submission | null };

/** หน้างาน — ครูเห็นหน้าตรวจงาน นักเรียนเห็นหน้าส่งงาน */
export default function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const supabase = createClient();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return setState({ kind: "error", message: "เข้าสู่ระบบก่อน" });

      const [{ data: profile }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
        supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle(),
      ]);
      if (!a) return setState({ kind: "error", message: "ไม่พบงานนี้ หรือครูยังไม่ได้มอบหมายให้ห้องของคุณ" });
      const assignment = a as Assignment;

      const { data: c } = await supabase.from("courses").select("subjects(code, name)").eq("id", assignment.course_id).maybeSingle();
      const subj = (c as unknown as { subjects: { code: string; name: string } | null } | null)?.subjects;
      const course = subj ? `${subj.code} ${subj.name}` : "รายวิชา";

      if (profile?.role === "teacher") {
        const [enrollRes, subRes, unitRes] = await Promise.all([
          supabase.from("enrollments").select("id, class_roster(full_name, student_code, classroom, class_number), profiles(full_name, student_code)").eq("course_id", assignment.course_id),
          supabase.from("assignment_submissions").select("*").eq("assignment_id", assignmentId),
          supabase.from("course_units").select("id, title, sort_order").eq("course_id", assignment.course_id),
        ]);
        const unitIds = (unitRes.data ?? []).map((u) => u.id);
        const { data: comps } = unitIds.length
          ? await supabase.from("unit_components").select("id, unit_id, category, max_score").in("unit_id", unitIds)
          : { data: [] };
        type Row = {
          id: string;
          class_roster: { full_name: string; student_code: string; classroom: string | null; class_number: number | null } | null;
          profiles: { full_name: string; student_code: string | null } | null;
        };
        const students: Student[] = ((enrollRes.data as unknown as Row[]) ?? [])
          .map((e) => ({
            enrollmentId: e.id,
            name: e.class_roster?.full_name ?? e.profiles?.full_name ?? "",
            code: e.class_roster?.student_code ?? e.profiles?.student_code ?? "",
            room: e.class_roster?.classroom ?? "",
            number: e.class_roster?.class_number ?? null,
          }))
          .sort((x, y) => x.room.localeCompare(y.room, "th") || (x.number ?? 999) - (y.number ?? 999) || x.code.localeCompare(y.code));
        const rooms = [...new Set(students.map((s) => s.room).filter(Boolean))];
        return setState({
          kind: "teacher",
          a: assignment,
          course,
          students,
          subs: (subRes.data as Submission[]) ?? [],
          options: componentOptions(unitRes.data ?? [], (comps as { id: string; unit_id: string; category: "K" | "P" | "A"; max_score: number }[]) ?? []),
          rooms,
        });
      }

      const { data: enr } = await supabase.from("enrollments").select("id").eq("course_id", assignment.course_id).eq("student_id", uid).maybeSingle();
      if (!enr) return setState({ kind: "error", message: "คุณยังไม่ได้ลงทะเบียนในวิชานี้" });
      const { data: sub } = await supabase.from("assignment_submissions").select("*").eq("assignment_id", assignmentId).eq("enrollment_id", enr.id).maybeSingle();
      setState({ kind: "student", a: assignment, course, enrollmentId: enr.id, sub: (sub as Submission) ?? null });
    }
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [assignmentId, supabase]);

  const crumbs = [
    { label: "หน้าหลัก", href: "/dashboard" },
    ...(state.kind === "teacher" || state.kind === "student"
      ? [{ label: state.course, href: `/dashboard/courses/${state.a.course_id}` }, { label: state.a.title }]
      : [{ label: "งาน" }]),
  ];

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <div className={`mx-auto space-y-4 ${state.kind === "teacher" ? "max-w-6xl" : "max-w-2xl"}`}>
        <Breadcrumbs items={crumbs} />
        {state.kind === "loading" && <p className="text-sm text-slate-500">กำลังโหลด...</p>}
        {state.kind === "error" && <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-600">{state.message}</p>}
        {state.kind === "teacher" && (
          <TeacherAssignment initial={state.a} students={state.students} initialSubs={state.subs} componentOptions={state.options} rooms={state.rooms} courseLabel={state.course} />
        )}
        {state.kind === "student" && <StudentAssignment assignment={state.a} enrollmentId={state.enrollmentId} initial={state.sub} />}
      </div>
    </div>
  );
}
