import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { linkStudentToRoster } from "@/lib/students/link";
import { detachAndDeleteStudentUser, generatePin, isPinEmail, pinEmail } from "@/lib/students/pin";

/**
 * PIN สำหรับนักเรียนที่ใช้อีเมลโรงเรียนไม่ได้ (ครูเท่านั้น)
 *
 * GET  ?courseId=...                    → รายชื่อ (roster id) ในวิชานี้ที่เข้าระบบด้วย PIN
 * POST { rosterId, action: "issue" }    → สร้าง/เปลี่ยน PIN ใหม่ คืน PIN ให้ครูบอกนักเรียน (แสดงครั้งเดียว ไม่เก็บตัว PIN)
 * POST { rosterId, action: "revoke" }   → ยกเลิก PIN ลบบัญชี PIN (คะแนนยังอยู่กับรายชื่อ)
 */

async function pinUserIdsByHolder(admin: ReturnType<typeof adminClient>, holderIds: string[]) {
  const pinIds = new Set<string>();
  for (const id of holderIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (isPinEmail(data.user?.email)) pinIds.add(id);
  }
  return pinIds;
}

export async function GET(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "ไม่ได้ระบุวิชา" }, { status: 400 });

  const admin = adminClient();
  const { data: rows, error } = await admin.from("class_roster").select("id, claimed_by").eq("course_id", courseId).not("claimed_by", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pinIds = await pinUserIdsByHolder(admin, [...new Set((rows ?? []).map((r) => r.claimed_by as string))]);
  return NextResponse.json({ rosterIds: (rows ?? []).filter((r) => pinIds.has(r.claimed_by as string)).map((r) => r.id) });
}

export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { rosterId?: string; action?: string } | null;
  const rosterId = body?.rosterId;
  const action = body?.action;
  if (!rosterId || (action !== "issue" && action !== "revoke")) {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ครบ" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: roster } = await admin.from("class_roster").select("id, student_code, full_name, claimed_by").eq("id", rosterId).maybeSingle();
  if (!roster) return NextResponse.json({ error: "ไม่พบนักเรียนคนนี้ในรายชื่อ" }, { status: 404 });

  let holderIsPin = false;
  if (roster.claimed_by) {
    const { data } = await admin.auth.admin.getUserById(roster.claimed_by);
    holderIsPin = isPinEmail(data.user?.email);
  }

  if (action === "revoke") {
    if (!roster.claimed_by || !holderIsPin) return NextResponse.json({ error: "นักเรียนคนนี้ไม่ได้ใช้ PIN" }, { status: 409 });
    const res = await detachAndDeleteStudentUser(admin, roster.claimed_by);
    if (!res.ok) return NextResponse.json({ error: `ยกเลิก PIN ไม่สำเร็จ: ${res.error}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // issue
  if (roster.claimed_by && !holderIsPin) {
    return NextResponse.json({ error: "นักเรียนคนนี้เข้าระบบด้วย Google ของโรงเรียนแล้ว ไม่ต้องใช้ PIN" }, { status: 409 });
  }

  const pin = generatePin();
  let userId = holderIsPin ? roster.claimed_by! : null;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pin });
    if (error) return NextResponse.json({ error: `เปลี่ยน PIN ไม่สำเร็จ: ${error.message}` }, { status: 500 });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: pinEmail(roster.student_code),
      password: pin,
      email_confirm: true,
      user_metadata: { full_name: roster.full_name, student_code: roster.student_code, login: "pin" },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: `สร้าง PIN ไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}` }, { status: 500 });
    }
    userId = data.user.id;
  }

  // ผูกเข้ากับรายชื่อของรหัสนี้ทุกวิชาที่ยังไม่มีใครรับ
  await linkStudentToRoster(admin, { id: userId, email: pinEmail(roster.student_code) });

  return NextResponse.json({ ok: true, pin, studentCode: roster.student_code, name: roster.full_name });
}
