import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { linkStudentToRoster } from "@/lib/students/link";
import { isPinEmail } from "@/lib/students/pin";

/**
 * นักเรียนที่เข้าด้วย PIN เรียกหลังล็อกอิน — ผูกเข้ากับรายชื่อวิชาใหม่ที่ครูนำเข้าทีหลัง
 * (นักเรียนที่เข้าด้วย Google ได้ขั้นนี้จาก /auth/callback อยู่แล้ว)
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPinEmail(user.email)) return NextResponse.json({ ok: true, skipped: true });

  const result = await linkStudentToRoster(adminClient(), user);
  return NextResponse.json(result);
}
