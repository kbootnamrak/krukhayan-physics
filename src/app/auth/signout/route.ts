import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ออกจากระบบ — รับเฉพาะ POST จากปุ่มในแถบด้านบน
 *
 * ไม่ใช้ GET เพราะเบราว์เซอร์และ <Link> prefetch ลิงก์ GET ล่วงหน้าได้เอง
 * ผู้ใช้จะถูกเตะออกจากระบบทั้งที่ยังไม่ได้กด
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // local = ออกเฉพาะเครื่องนี้ ครูที่ล็อกอินค้างไว้ในมือถือจะไม่หลุดตาม
  await supabase.auth.signOut({ scope: "local" });

  // 303 ให้เบราว์เซอร์เปลี่ยนเป็น GET /login ไม่ส่งฟอร์มซ้ำ
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
