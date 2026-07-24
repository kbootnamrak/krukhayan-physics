import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type Row = { student_code: string; full_name: string; email?: string };

export async function POST(request: Request) {
  // ต้อง login เป็นครูของ course นี้เท่านั้น
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { courseId, rows } = (await request.json()) as { courseId: string; rows: Row[] };
  if (!courseId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  const results: { student_code: string; status: string }[] = [];

  for (const row of rows) {
    const studentCode = String(row.student_code ?? "").trim();
    const fullName = String(row.full_name ?? "").trim();
    if (!studentCode || !fullName) {
      results.push({ student_code: studentCode || "(ไม่ระบุ)", status: "ข้าม: ข้อมูลไม่ครบ" });
      continue;
    }
    const email = row.email?.trim() || `${studentCode}@krukhayan-physics.local`;

    // หา profile เดิมจากรหัสนักเรียนก่อน
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("student_code", studentCode)
      .maybeSingle();

    let studentId = existingProfile?.id as string | undefined;

    if (!studentId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: `Std-${studentCode}-${Math.random().toString(36).slice(2, 8)}`,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr || !created.user) {
        results.push({ student_code: studentCode, status: `สร้างบัญชีไม่สำเร็จ: ${createErr?.message}` });
        continue;
      }
      studentId = created.user.id;
      await admin.from("profiles").insert({
        id: studentId,
        full_name: fullName,
        role: "student",
        student_code: studentCode,
      });
    }

    const { error: enrollErr } = await admin
      .from("enrollments")
      .upsert({ course_id: courseId, student_id: studentId }, { onConflict: "course_id,student_id" });

    results.push({ student_code: studentCode, status: enrollErr ? `ลงทะเบียนไม่สำเร็จ: ${enrollErr.message}` : "สำเร็จ" });
  }

  return NextResponse.json({ results });
}
