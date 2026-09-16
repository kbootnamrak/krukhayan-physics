import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isSchoolEmail } from "@/lib/school";
import { linkStudentToRoster } from "@/lib/students/link";

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
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  // ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — เดิมโค้ดนี้เงียบแล้วพาไป /dashboard
  // ซึ่งจะเด้งกลับหน้า login โดยผู้ใช้ไม่รู้ว่าเกิดอะไรขึ้น
  if (exchangeError || !data.user) {
    return NextResponse.redirect(`${origin}/login?auth_error=link_invalid`);
  }

  const user = data.user;
  const admin = adminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // ครูใช้บัญชีอะไรก็ได้ ไม่ต้องอยู่ในโดเมนโรงเรียนและไม่ต้องจับคู่รายชื่อ
  if (profile?.role === "teacher") {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // ด่านฝั่งเซิร์ฟเวอร์: รับเฉพาะบัญชีในโดเมนโรงเรียน
  // (Google consent screen แบบ Internal กันไว้อีกชั้นตั้งแต่ต้นทางแล้ว)
  if (!isSchoolEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?auth_error=not_school_email`);
  }

  await linkStudentToRoster(admin, user);

  return NextResponse.redirect(`${origin}${next}`);
}
