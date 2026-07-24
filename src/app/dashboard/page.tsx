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

  const { data: subjects } = await supabase.from("subjects").select("code, name");

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            สวัสดี, {profile?.full_name ?? user.email}
          </h1>
          <p className="text-slate-500 text-sm">
            บทบาท: {profile?.role === "teacher" ? "ครู" : "นักเรียน"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-medium text-slate-700 mb-3">รายวิชา</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {subjects?.length ? (
              subjects.map((s) => (
                <li key={s.code} className="border-b border-slate-100 pb-2">
                  {s.name}
                </li>
              ))
            ) : (
              <li className="text-slate-400">
                ยังไม่มีรายวิชา — ครูสามารถเพิ่มได้จาก Supabase Table Editor
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
