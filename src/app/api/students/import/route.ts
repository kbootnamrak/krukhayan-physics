import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school";
import { dbErrorMessage } from "@/lib/db-error";

type Row = { student_code: string; full_name: string };

/**
 * นำเข้ารายชื่อนักเรียนจาก Excel
 *
 * ไม่สร้างบัญชีให้นักเรียนอีกต่อไป — เดิมเคยสร้างบัญชีด้วยอีเมลปลอมและสุ่ม
 * รหัสผ่านที่ไม่มีใครได้เห็น นักเรียนจึงล็อกอินไม่ได้เลย
 *
 * ตอนนี้แค่บันทึกรายชื่อไว้ แล้วบัญชีจะถูกจับคู่อัตโนมัติตอนนักเรียนล็อกอิน
 * ด้วย Google ของโรงเรียนครั้งแรก (อีเมลตั้งตามรหัสนักเรียน)
 */
export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { courseId?: string; rows?: Row[] } | null;
  const courseId = body?.courseId;
  const rows = body?.rows;
  if (!courseId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ครบ ลองเลือกไฟล์ใหม่อีกครั้ง" }, { status: 400 });
  }

  const admin = adminClient();
  const results: { student_code: string; status: string }[] = [];

  for (const row of rows) {
    const studentCode = String(row.student_code ?? "").trim();
    const fullName = String(row.full_name ?? "").trim();

    if (!studentCode || !fullName) {
      results.push({ student_code: studentCode || "(ไม่ระบุ)", status: "ข้าม: ข้อมูลไม่ครบ" });
      continue;
    }

    const { data: roster, error: rosterError } = await admin
      .from("class_roster")
      .upsert(
        { course_id: courseId, student_code: studentCode, full_name: fullName },
        { onConflict: "course_id,student_code" }
      )
      .select("id, claimed_by")
      .single();

    if (rosterError || !roster) {
      results.push({ student_code: studentCode, status: `ไม่สำเร็จ: ${dbErrorMessage(rosterError)}` });
      continue;
    }

    if (roster.claimed_by) {
      // นำเข้าซ้ำเพื่อแก้ชื่อที่สะกดผิด — อัปเดตชื่อในโปรไฟล์ให้ทันที ตารางคะแนนจะได้ถูกต้องเลย
      // ไม่ต้องรอให้นักเรียนล็อกอินใหม่
      await admin.from("profiles").update({ full_name: fullName }).eq("id", roster.claimed_by);
      results.push({ student_code: studentCode, status: "มีอยู่แล้ว (เข้าระบบแล้ว) — อัปเดตชื่อแล้ว" });
      continue;
    }

    // ถ้านักเรียนคนนี้เคยล็อกอินไว้ก่อนที่ครูจะนำเข้ารายชื่อ ให้จับคู่ให้เลย
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("student_code", studentCode)
      .maybeSingle();

    if (!existing) {
      results.push({ student_code: studentCode, status: "เพิ่มแล้ว — รอนักเรียนเข้าระบบ" });
      continue;
    }

    await admin
      .from("enrollments")
      .upsert(
        { course_id: courseId, student_id: existing.id },
        { onConflict: "course_id,student_id", ignoreDuplicates: true }
      );

    await admin
      .from("class_roster")
      .update({ claimed_by: existing.id, claimed_at: new Date().toISOString() })
      .eq("id", roster.id);

    await admin.from("profiles").update({ full_name: fullName }).eq("id", existing.id);

    results.push({ student_code: studentCode, status: "เพิ่มและลงทะเบียนให้แล้ว" });
  }

  return NextResponse.json({ results, domain: SCHOOL_EMAIL_DOMAIN });
}
