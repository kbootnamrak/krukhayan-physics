import type { SupabaseClient } from "@supabase/supabase-js";
import { studentCodeFromEmail } from "@/lib/school";

export type LinkResult =
  | { ok: true; studentCode: string; enrolled: number }
  | { ok: false; reason: "not_school_email" };

/**
 * จับคู่บัญชีที่เพิ่งล็อกอินเข้ากับรายชื่อที่ครูนำเข้าไว้
 *
 * เรียกทุกครั้งที่ล็อกอินผ่าน /auth/callback ไม่ใช่เฉพาะครั้งแรก เพราะครูอาจ
 * นำเข้ารายชื่อของวิชาใหม่ทีหลัง นักเรียนคนเดิมจะได้ถูกลงทะเบียนเพิ่มให้เอง
 * โดยไม่ต้องทำอะไร ฟังก์ชันนี้ไม่ทำอะไรซ้ำถ้าจับคู่ไปแล้ว
 */
export async function linkStudentToRoster(
  admin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<LinkResult> {
  const studentCode = studentCodeFromEmail(user.email);
  if (!studentCode) return { ok: false, reason: "not_school_email" };

  // รายชื่อที่ยังไม่มีใครรับ หรือที่เป็นของคนนี้อยู่แล้ว
  const { data: rosterRows } = await admin
    .from("class_roster")
    .select("id, course_id, full_name, claimed_by")
    .eq("student_code", studentCode)
    .or(`claimed_by.is.null,claimed_by.eq.${user.id}`);

  const rows = rosterRows ?? [];

  // ชื่อภาษาไทยจาก Excel ของครูอ่านง่ายกว่าชื่อที่ตั้งไว้ในบัญชี Google
  const nameFromRoster = rows[0]?.full_name ?? null;

  await admin
    .from("profiles")
    .update({
      student_code: studentCode,
      ...(nameFromRoster ? { full_name: nameFromRoster } : {}),
    })
    .eq("id", user.id);

  let enrolled = 0;
  for (const row of rows) {
    const { error } = await admin
      .from("enrollments")
      .upsert(
        { course_id: row.course_id, student_id: user.id },
        { onConflict: "course_id,student_id", ignoreDuplicates: true }
      );
    if (error) continue;

    await admin
      .from("class_roster")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", row.id);

    enrolled++;
  }

  return { ok: true, studentCode, enrolled };
}
