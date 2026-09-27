import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy (ชื่อเดิมเลิกใช้แล้ว)
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // launch = หน้าเปิดแอป (static) ไม่ต้องตรวจล็อกอิน ให้ส่งจาก CDN ได้ทันที
    "/((?!_next/static|_next/image|favicon.ico|launch$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
