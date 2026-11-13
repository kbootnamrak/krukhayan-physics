import type { Metadata } from "next";
import SpectrumLab from "./SpectrumLab";

export const metadata: Metadata = {
  title: "ห้องทดลองเสมือน: สเปกตรัมของแก๊สร้อน (กิจกรรม 19.1)",
  description: "จำลองการทดลอง 3 มิติ มองสเปกตรัมของหลอดไส้ ไฮโดรเจน และนีออนผ่านเกรตติง วัดตำแหน่งเส้นสเปกตรัมแล้วคำนวณความยาวคลื่น",
};

/** ห้องทดลองเสมือน กิจกรรม 19.1 — เปิดได้โดยไม่ต้องล็อกอิน ครูแนบลิงก์ในงานได้ */
export default function SpectrumLabPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <SpectrumLab />
    </main>
  );
}
