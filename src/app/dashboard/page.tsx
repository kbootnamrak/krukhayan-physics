import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhysicsBanner } from "@/components/PhysicsArt";

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

  const links = [
    { href: "/dashboard/courses", label: "รายวิชาของฉัน", note: isTeacher ? "กรอกคะแนน · นักเรียน · สื่อการสอน" : "ดูคะแนนและสื่อการสอน", color: "var(--trace-magenta)" },
    ...(isTeacher
      ? [{ href: "/dashboard/admin", label: "จัดการวิชา / ปีการศึกษา", note: "เปิดวิชา ตั้งเทอม", color: "var(--trace-cyan)" }]
      : []),
    { href: "/dashboard/iot", label: "เครื่องวัดอุณหภูมิและความชื้น", note: "ข้อมูลจากบอร์ด ESP32", color: "var(--trace-yellow)" },
    { href: "/dashboard/account", label: "บัญชีของฉัน", note: "เปลี่ยนรหัสผ่าน", color: "var(--trace-lime)" },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* หัวหน้าหลัก: คำทักทายบนภาพฟิสิกส์นีออน (หน้านี้เป็นหน้า "แรก" หลังล็อกอิน จึงเข้มได้) */}
        <div className="relative overflow-hidden rounded-sm border-2 border-porcelain bg-white min-h-40">
          <PhysicsBanner className="absolute inset-0 h-full w-full max-sm:opacity-40" />
          <div className="relative p-6 sm:p-8 max-w-md space-y-1">
            <h1 className="font-display text-3xl font-bold text-slate-800">สวัสดี, {profile?.full_name ?? user.email}</h1>
            <p className="text-slate-600">{isTeacher ? "ครูผู้สอน" : "นักเรียน"} · KruKhayan Physics</p>
          </div>
        </div>

        {/* ทางไปแต่ละส่วน: แต่ละแถวคือขั้วต่อบนแผ่นวงจร สีตามลายทองแดง */}
        <nav className="grid gap-3 sm:grid-cols-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-3 rounded-sm border-2 border-slate-200 bg-white px-4 py-3.5 hover:border-slate-400"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full border-2 border-porcelain"
                style={{ background: l.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold text-slate-800">{l.label}</span>
                <span className="block text-sm text-slate-500">{l.note}</span>
              </span>
              <svg viewBox="0 0 24 24" className="size-5 text-slate-400 group-hover:text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
