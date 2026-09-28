import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// โดเมนหลักของเว็บ — ชื่อเดิม .vercel.app ยังเปิดได้ แต่พาหน้าเว็บมาที่นี่
const PRIMARY_HOST = "phyzix.app";
const OLD_HOSTS = new Set([
  "krukhayan-physics.vercel.app",
  "krukhayan-physics-urrw.vercel.app",
  "krukhayan-physics-git-main-urrw.vercel.app",
]);

/**
 * ชื่อเดิมพาไปชื่อใหม่ เฉพาะการเปิดหน้าเว็บ (GET)
 * ไม่พา: /api (บอร์ด ESP32 ส่งข้อมูลมาชื่อเดิม และ LINE webhook) และ /auth
 * (ล็อกอินที่เริ่มจากชื่อเดิมต้องจบที่ชื่อเดิม คุกกี้ยืนยันตัวตนผูกกับชื่อเว็บ)
 */
function redirectOldHost(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host || !OLD_HOSTS.has(host)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) return null;
  return NextResponse.redirect(`https://${PRIMARY_HOST}${pathname}${search}`, 308);
}

// Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy (ชื่อเดิมเลิกใช้แล้ว)
export async function proxy(request: NextRequest) {
  return redirectOldHost(request) ?? (await updateSession(request));
}

export const config = {
  matcher: [
    // launch = หน้าเปิดแอป (static) ไม่ต้องตรวจล็อกอิน ให้ส่งจาก CDN ได้ทันที
    "/((?!_next/static|_next/image|favicon.ico|launch$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
