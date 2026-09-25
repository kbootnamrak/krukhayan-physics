import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Breadcrumbs from "../Breadcrumbs";
import { UnitGlyph } from "@/components/PhysicsArt";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isTeacher = profile?.role === "teacher";

  let courses: { id: string; subjects: { name: string } | null; terms: { academic_year: number; semester: number } | null }[] = [];

  if (isTeacher) {
    const { data } = await supabase
      .from("courses")
      .select("id, subjects(name), terms(academic_year, semester)")
      .eq("teacher_id", user.id)
      .order("id");
    courses = ((data ?? []) as unknown) as typeof courses;
  } else {
    const { data } = await supabase
      .from("enrollments")
      .select("courses(id, subjects(name), terms(academic_year, semester))")
      .eq("student_id", user.id);
    courses = ((data ?? []) as unknown as { courses: (typeof courses)[number] }[])
      .map((e) => e.courses)
      .filter(Boolean);
  }

  return (
    <div className="px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "รายวิชาของฉัน" }]} />
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold text-slate-800">รายวิชาของฉัน</h1>
          {isTeacher && (
            <Link href="/dashboard/admin" className="text-sm text-slate-600 underline">
              จัดการวิชา/เทอม
            </Link>
          )}
        </div>

        <div className="bg-white rounded-sm border-2 border-porcelain divide-y divide-slate-200">
          {courses.length === 0 && (
            <p className="p-6 text-sm text-slate-400">
              {isTeacher ? "ยังไม่มีวิชาที่เปิดสอน ไปที่ \"จัดการวิชา/เทอม\" เพื่อเปิดวิชาใหม่" : "ยังไม่ได้ลงทะเบียนวิชาใด"}
            </p>
          )}
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/courses/${c.id}`}
              className="group flex items-center gap-3 p-4 hover:bg-slate-100"
            >
              <span className="text-trace-cyan">
                <UnitGlyph title="" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-slate-800">{c.subjects?.name}</span>
                <span className="block text-sm text-slate-500">
                  ปีการศึกษา {c.terms?.academic_year} เทอม {c.terms?.semester}
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="size-5 text-slate-400 group-hover:text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
