import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * เข้าระบบด้วยรหัสนักเรียน + PIN (สำหรับนักเรียนที่ใช้อีเมลโรงเรียนไม่ได้)
 *
 * ครูกดสร้าง PIN ให้เป็นรายคน ระบบสร้างบัญชี Supabase ให้ด้วยอีเมลสมมติ
 * "<รหัสนักเรียน>@pin.krukhayan.invalid" (โดเมน .invalid ส่งอีเมลไม่ได้จริงตามมาตรฐาน)
 * และใช้ PIN เป็นรหัสผ่าน นักเรียนพิมพ์แค่รหัสนักเรียน + PIN หน้าเว็บแปลงเป็นอีเมลให้เอง
 *
 * ถ้าภายหลังนักเรียนเข้าด้วย Google ของโรงเรียนได้ การลงทะเบียน (และคะแนนทั้งหมด)
 * จะย้ายไปบัญชี Google ให้เอง แล้วบัญชี PIN ถูกลบ — ดู linkStudentToRoster
 */
export const PIN_EMAIL_DOMAIN = "pin.krukhayan.invalid";

export function pinEmail(studentCode: string) {
  return `${studentCode.trim().toLowerCase()}@${PIN_EMAIL_DOMAIN}`;
}

export function isPinEmail(email: string | null | undefined) {
  return Boolean(email?.trim().toLowerCase().endsWith(`@${PIN_EMAIL_DOMAIN}`));
}

export function studentCodeFromPinEmail(email: string | null | undefined) {
  if (!isPinEmail(email)) return null;
  return email!.trim().toLowerCase().split("@")[0] || null;
}

/**
 * ลบบัญชีนักเรียนโดยไม่ให้คะแนนหาย
 *
 * enrollments.student_id อ้างถึง profiles แบบ ON DELETE CASCADE — ถ้าลบบัญชีตรง ๆ
 * การลงทะเบียน คะแนน และผลแบบทดสอบของคนนั้นจะถูกลบตามไปหมด
 * จึงปลดบัญชีออกจากการลงทะเบียน (ยังผูกกับรายชื่อผ่าน roster_id) ก่อน แล้วตรวจซ้ำว่าไม่เหลือ
 * ถ้ายังเหลือแม้แถวเดียว จะไม่ลบบัญชี
 */
export async function detachAndDeleteStudentUser(admin: SupabaseClient, userId: string) {
  await admin.from("class_roster").update({ claimed_by: null, claimed_at: null }).eq("claimed_by", userId);
  const { error: detachError } = await admin.from("enrollments").update({ student_id: null }).eq("student_id", userId);
  if (detachError) return { ok: false as const, error: detachError.message };

  const { count, error: countError } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", userId);
  if (countError || (count ?? 0) > 0) return { ok: false as const, error: "ยังมีการลงทะเบียนผูกอยู่ จึงไม่ลบบัญชี" };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** PIN 6 หลัก สุ่มแบบปลอดภัย (ใช้ฝั่งเซิร์ฟเวอร์) */
export function generatePin() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}
