import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-800">รายวิชาของฉัน</h1>
          {isTeacher && (
            <Link href="/dashboard/admin" className="text-sm text-slate-600 underline">
              จัดการวิชา/เทอม
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {courses.length === 0 && (
            <p className="p-6 text-sm text-slate-400">
              {isTeacher ? "ยังไม่มีวิชาที่เปิดสอน ไปที่ \"จัดการวิชา/เทอม\" เพื่อเปิดวิชาใหม่" : "ยังไม่ได้ลงทะเบียนวิชาใด"}
            </p>
          )}
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/courses/${c.id}`}
              className="block p-4 hover:bg-slate-50 text-sm"
            >
              <span className="font-medium text-slate-700">{c.subjects?.name}</span>
              <span className="text-slate-400 ml-2">
                ปีการศึกษา {c.terms?.academic_year} เทอม {c.terms?.semester}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
