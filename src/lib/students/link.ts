import type { SupabaseClient } from "@supabase/supabase-js";
import { studentCodeFromEmail } from "@/lib/school";
import { detachAndDeleteStudentUser, isPinEmail, studentCodeFromPinEmail } from "@/lib/students/pin";

export type LinkResult =
  | { ok: true; studentCode: string; enrolled: number }
  | { ok: false; reason: "not_school_email" };

/**
 * จับคู่บัญชีที่เพิ่งล็อกอินเข้ากับรายชื่อที่ครูนำเข้าไว้
 *
 * เรียกทุกครั้งที่ล็อกอิน (Google ผ่าน /auth/callback · PIN ผ่าน /api/students/link)
 * ไม่ใช่เฉพาะครั้งแรก เพราะครูอาจนำเข้ารายชื่อของวิชาใหม่ทีหลัง นักเรียนคนเดิมจะได้
 * ถูกลงทะเบียนเพิ่มให้เอง ฟังก์ชันนี้ไม่ทำอะไรซ้ำถ้าจับคู่ไปแล้ว
 *
 * รหัสนักเรียนมาจากอีเมลโรงเรียน (65001@urrw.ac.th) หรืออีเมลของบัญชี PIN
 * ถ้าเป็นบัญชี Google ของโรงเรียน และรายชื่อถูกบัญชี PIN ของคนเดียวกันรับไว้ก่อน
 * จะย้ายการลงทะเบียน (พร้อมคะแนนและผลแบบทดสอบ) มาที่บัญชี Google แล้วลบบัญชี PIN ทิ้ง
 */
export async function linkStudentToRoster(
  admin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<LinkResult> {
  const fromSchool = studentCodeFromEmail(user.email);
  const studentCode = fromSchool ?? studentCodeFromPinEmail(user.email);
  if (!studentCode) return { ok: false, reason: "not_school_email" };

  const { data: allRows } = await admin
    .from("class_roster")
    .select("id, course_id, full_name, claimed_by")
    .eq("student_code", studentCode);

  // บัญชี PIN ของรหัสนี้ที่ถือรายชื่ออยู่ — บัญชี Google ของโรงเรียนรับช่วงต่อได้
  const pinHolders = new Set<string>();
  if (fromSchool) {
    for (const holder of new Set((allRows ?? []).map((r) => r.claimed_by).filter((id): id is string => !!id && id !== user.id))) {
      const { data } = await admin.auth.admin.getUserById(holder);
      if (isPinEmail(data.user?.email)) pinHolders.add(holder);
    }
  }

  // รายชื่อที่ยังไม่มีใครรับ ที่เป็นของคนนี้อยู่แล้ว หรือที่บัญชี PIN ของคนเดียวกันถือไว้
  const rows = (allRows ?? []).filter((r) => !r.claimed_by || r.claimed_by === user.id || pinHolders.has(r.claimed_by));

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
    // การลงทะเบียนถูกสร้างไว้แล้วตั้งแต่ครูนำเข้ารายชื่อ (ครูจึงกรอกคะแนนได้ก่อนนักเรียนล็อกอิน)
    // ตรงนี้แค่ผูกบัญชีเข้ากับแถวนั้น — คะแนนที่ครูกรอกไว้ก่อนจะตามมาด้วย
    const { data: existing } = await admin
      .from("enrollments")
      .select("id, student_id")
      .eq("roster_id", row.id)
      .maybeSingle();

    const { error } = existing
      ? existing.student_id === user.id
        ? { error: null }
        : await admin.from("enrollments").update({ student_id: user.id }).eq("id", existing.id)
      : // รายชื่อที่นำเข้าก่อนมีการผูก roster_id — สร้างการลงทะเบียนตอนนี้
        await admin
          .from("enrollments")
          .upsert(
            { course_id: row.course_id, student_id: user.id, roster_id: row.id },
            { onConflict: "course_id,student_id", ignoreDuplicates: true }
          );
    if (error) continue;

    await admin
      .from("class_roster")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", row.id);

    enrolled++;
  }

  // ย้ายครบแล้ว บัญชี PIN ไม่มีรายชื่อเหลือ — ลบทิ้ง (ฟังก์ชันนี้ไม่ลบถ้ายังมีการลงทะเบียนผูกอยู่)
  for (const holder of pinHolders) await detachAndDeleteStudentUser(admin, holder);

  return { ok: true, studentCode, enrolled };
}
