import type { Metadata } from "next";
import Link from "next/link";
import SpectrumLab from "./SpectrumLab";

export const metadata: Metadata = {
  title: "ห้องทดลองเสมือน: สเปกตรัมของแก๊สร้อน (กิจกรรม 19.1)",
  description: "จำลองการทดลอง 3 มิติ มองสเปกตรัมของหลอดไส้ ไฮโดรเจน และนีออนผ่านเกรตติง วัดตำแหน่งเส้นสเปกตรัมแล้วคำนวณความยาวคลื่น",
};

/** ห้องทดลองเสมือน กิจกรรม 19.1 — เปิดได้โดยไม่ต้องล็อกอิน ครูแนบลิงก์ในงานได้ */
export default function SpectrumLabPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* แอปที่ติดตั้งบนมือถือไม่มีปุ่มย้อนกลับของเบราว์เซอร์ — ต้องมีทางกลับหน้าหลักด้านบน */}
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-800">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H6M11 6l-6 6 6 6" />
          </svg>
          หน้าหลัก
        </Link>
      </div>
      <SpectrumLab />
    </main>
  );
}
