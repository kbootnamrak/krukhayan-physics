import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

/**
 * แถบด้านบนของทุกหน้าใน /dashboard
 *
 * ปุ่มออกจากระบบจำเป็นมากในโรงเรียน เพราะนักเรียนใช้คอมห้องคอมร่วมกัน
 * ถ้าไม่มีปุ่มนี้ คนที่มานั่งเครื่องต่อจะเห็นคะแนนของคนก่อนหน้า
 */
export default function DashboardHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className="bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 whitespace-nowrap group">
          {/* สัญลักษณ์: สี่สายมาบรรจบที่สถานีเดียว */}
          <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden>
            <path d="M3 9h7l4 5" stroke="var(--line-scarlet)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 9h-7l-4 5" stroke="var(--line-cobalt)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 19h7l4-5" stroke="var(--line-green)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 19h-7l-4-5" stroke="var(--line-amber)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="14" cy="14" r="4" fill="var(--c-slate-50)" stroke="var(--porcelain)" strokeWidth="2.2" />
          </svg>
          <span className="font-sign font-semibold uppercase tracking-[0.08em] text-[15px] text-slate-800 group-hover:text-slate-900">
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
