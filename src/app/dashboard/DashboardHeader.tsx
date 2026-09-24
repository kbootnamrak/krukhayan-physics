import Link from "next/link";

/**
 * แถบด้านบนของทุกหน้าใน /dashboard
 *
 * ปุ่มออกจากระบบจำเป็นมากในโรงเรียน เพราะนักเรียนใช้คอมห้องคอมร่วมกัน
 * ถ้าไม่มีปุ่มนี้ คนที่มานั่งเครื่องต่อจะเห็นคะแนนของคนก่อนหน้า
 */
export default function DashboardHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-semibold text-slate-800 whitespace-nowrap">
          KruKhayan Physics
        </Link>

        {displayName !== null && (
          <div className="flex items-center gap-4 min-w-0">
            <span className="hidden sm:block text-sm text-slate-500 truncate">{displayName}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 whitespace-nowrap"
              >
                ออกจากระบบ
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
