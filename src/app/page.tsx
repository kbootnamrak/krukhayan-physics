import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * หน้าแรกของเว็บไม่มีเนื้อหาของตัวเอง — พาไปหน้าที่ใช้จริงทันที
 * ล็อกอินแล้วไปหน้าหลัก ยังไม่ล็อกอินไปหน้าเข้าสู่ระบบ (หน้าที่มีภาพฟิสิกส์เต็ม)
 *
 * ลิงก์ในอีเมลที่ใช้ไม่ได้จะพากลับมาที่นี่พร้อม #error=... ต่อท้าย
 * เบราว์เซอร์พาส่วนหลัง # ติดไปกับการ redirect ด้วย หน้า /login จึงยังแสดงข้อความแจ้งได้เหมือนเดิม
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
