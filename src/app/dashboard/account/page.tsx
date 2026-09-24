import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountPage() {
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

  return (
    <div className="px-6 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800 mt-2">บัญชีของฉัน</h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">ชื่อ</span>
            <span className="text-slate-800">{profile?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">อีเมล</span>
            <span className="text-slate-800 break-all">{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">บทบาท</span>
            <span className="text-slate-800">
              {profile?.role === "teacher" ? "ครู" : "นักเรียน"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-800 mb-3">เปลี่ยนรหัสผ่าน</h2>
          <ChangePasswordForm email={user.email ?? ""} />
        </div>
      </div>
    </div>
  );
}
