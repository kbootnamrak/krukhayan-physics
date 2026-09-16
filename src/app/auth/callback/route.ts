import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Supabase แนบสาเหตุมาเป็น query string เมื่อปฏิเสธคำขอตั้งแต่ต้นทาง
  const error = searchParams.get("error_code") ?? searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?auth_error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  // ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — เดิมโค้ดนี้เงียบแล้วพาไป /dashboard
  // ซึ่งจะเด้งกลับหน้า login โดยผู้ใช้ไม่รู้ว่าเกิดอะไรขึ้น
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?auth_error=link_invalid`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
