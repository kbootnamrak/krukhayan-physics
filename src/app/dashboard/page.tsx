import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isTeacher = profile?.role === "teacher";

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            สวัสดี, {profile?.full_name ?? user.email}
          </h1>
          <p className="text-slate-500 text-sm">
            บทบาท: {isTeacher ? "ครู" : "นักเรียน"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <Link href="/dashboard/courses" className="block text-slate-700 font-medium hover:underline">
            รายวิชาของฉัน →
          </Link>
          {isTeacher && (
            <Link href="/dashboard/admin" className="block text-slate-700 font-medium hover:underline">
              จัดการวิชา / ปีการศึกษา →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
