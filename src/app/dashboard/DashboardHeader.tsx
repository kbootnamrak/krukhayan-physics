import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { ChipMark } from "@/components/PhysicsArt";

/**
 * แถบด้านบนของทุกหน้าใน /dashboard
 *
 * ปุ่มออกจากระบบจำเป็นมากในโรงเรียน เพราะนักเรียนใช้คอมห้องคอมร่วมกัน
 * ถ้าไม่มีปุ่มนี้ คนที่มานั่งเครื่องต่อจะเห็นคะแนนของคนก่อนหน้า
 */
export default function DashboardHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className="relative bg-slate-50 border-b border-slate-200">
      {/* ลายทองแดงเรืองแสงเส้นบางใต้แถบบน — ส่วนเดียวของหน้างานที่มีแสงนีออน */}
      <span aria-hidden className="neon-soft route-glow absolute inset-x-0 -bottom-px h-px bg-trace-cyan text-trace-cyan opacity-60" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 whitespace-nowrap group">
          <ChipMark />
          <span className="font-display font-semibold uppercase tracking-[0.06em] text-[15px] text-slate-800 group-hover:text-slate-900">
            KruKhayan Physics
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {displayName !== null && (
            <span className="hidden sm:block text-sm text-slate-500 truncate">{displayName}</span>
          )}
          <ThemeToggle />
          {displayName !== null && (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="h-9 text-sm text-slate-600 border border-slate-300 rounded-md px-3 hover:text-slate-800 hover:border-slate-400 whitespace-nowrap"
              >
                ออกจากระบบ
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
