import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { linkStudentToRoster } from "@/lib/students/link";
import { detachAndDeleteStudentUser, generatePin, pinEmail } from "@/lib/students/pin";

/**
 * PIN เข้าระบบของนักเรียน (ครูเท่านั้น) — นักเรียนทุกคนมี PIN ได้ ทั้งคนที่เข้าด้วย Google แล้วและคนที่ยังไม่เคยเข้า
 *
 * GET  ?courseId=...                                   → สถานะรายคน { rosterId, account: google|pin|null, hasPin }
 * POST { rosterId, action: "issue" }                   → สร้าง/เปลี่ยน PIN ใหม่ให้หนึ่งคน
 * POST { rosterId, action: "revoke" }                  → ยกเลิก PIN (คะแนนยังอยู่ · คนที่มี Google ยังเข้าด้วย Google ได้)
 * POST { courseId, rosterIds, action: "issue-bulk", replace } → สร้าง PIN ทีละหลายคน
 *        replace = false → ข้ามคนที่มี PIN อยู่แล้ว · true → ออก PIN ใหม่ทุกคน (PIN เดิมใช้ไม่ได้)
 *
 * PIN คืนให้ครูครั้งเดียว ระบบไม่เก็บตัว PIN (เก็บแค่แฮชในฐานะรหัสผ่านของบัญชี)
 */

export const maxDuration = 60;

type Admin = ReturnType<typeof adminClient>;
type Status = { roster_id: string; account: "google" | "pin" | null; has_pin: boolean };
type RosterRow = { id: string; course_id: string; student_code: string; full_name: string; classroom: string | null; class_number: number | null; claimed_by: string | null };

export type IssuedPin = { rosterId: string; name: string; studentCode: string; classroom: string | null; classNumber: number | null; pin: string };

async function statusOf(admin: Admin, courseId: string) {
  const { data, error } = await admin.rpc("student_pin_status", { p_course: courseId });
  if (error) throw new Error(error.message);
  return new Map(((data as Status[]) ?? []).map((s) => [s.roster_id, s]));
}

/** สร้าง/เปลี่ยน PIN ให้หนึ่งคน — คืน PIN หรือข้อความผิดพลาด */
async function issueOne(admin: Admin, roster: RosterRow, status: Status | undefined): Promise<{ pin: string } | { error: string }> {
  const pin = generatePin();

  // มีบัญชีอยู่แล้ว (Google หรือ PIN) → ตั้ง PIN เป็นรหัสผ่านของบัญชีนั้น
  if (roster.claimed_by && status?.account) {
    const { error } = await admin.auth.admin.updateUserById(roster.claimed_by, {
      password: pin,
      ...(status.account === "google" ? { app_metadata: { pin: "on" } } : {}),
    });
    if (error) return { error: `ตั้ง PIN ไม่สำเร็จ: ${error.message}` };
    return { pin };
  }

  // ยังไม่เคยเข้า → สร้างบัญชี PIN แล้วผูกกับรายชื่อของรหัสนี้ทุกวิชา
  const { data, error } = await admin.auth.admin.createUser({
    email: pinEmail(roster.student_code),
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: roster.full_name, student_code: roster.student_code, login: "pin" },
  });
  if (error || !data.user) {
    // รหัสเดียวกันอยู่หลายวิชา: อีกวิชาสร้างบัญชี PIN ไว้แล้ว → ใช้บัญชีนั้น
    if (error && /already been registered|already exists/i.test(error.message)) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email === pinEmail(roster.student_code));
      if (existing) {
        const upd = await admin.auth.admin.updateUserById(existing.id, { password: pin });
        if (upd.error) return { error: `ตั้ง PIN ไม่สำเร็จ: ${upd.error.message}` };
        await linkStudentToRoster(admin, { id: existing.id, email: pinEmail(roster.student_code) });
        return { pin };
      }
    }
    return { error: `สร้าง PIN ไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}` };
  }
  await linkStudentToRoster(admin, { id: data.user.id, email: pinEmail(roster.student_code) });
  return { pin };
}

export async function GET(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "ไม่ได้ระบุวิชา" }, { status: 400 });

  try {
    const map = await statusOf(adminClient(), courseId);
    return NextResponse.json({
      status: [...map.values()].map((s) => ({ rosterId: s.roster_id, account: s.account, hasPin: s.has_pin })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "โหลดสถานะ PIN ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { rosterId?: string; rosterIds?: string[]; courseId?: string; action?: string; replace?: boolean }
    | null;
  const action = body?.action;
  const admin = adminClient();
  const columns = "id, course_id, student_code, full_name, classroom, class_number, claimed_by";

  // ---------------------------------------------------------------- หลายคน
  if (action === "issue-bulk") {
    const courseId = body?.courseId;
    const ids = (body?.rosterIds ?? []).filter((x): x is string => typeof x === "string");
    if (!courseId || ids.length === 0 || ids.length > 300) {
      return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ครบ" }, { status: 400 });
    }
    const { data: rows, error } = await admin.from("class_roster").select(columns).eq("course_id", courseId).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const status = await statusOf(admin, courseId);
    const todo = ((rows as RosterRow[]) ?? []).filter((r) => body?.replace || !status.get(r.id)?.has_pin);

    const issued: IssuedPin[] = [];
    const failed: { rosterId: string; name: string; error: string }[] = [];
    // ทีละ 4 คนพร้อมกัน — เร็วพอ และไม่ชนขีดจำกัดของ Supabase Auth
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      const results = await Promise.all(batch.map((r) => issueOne(admin, r, status.get(r.id))));
      results.forEach((res, k) => {
        const r = batch[k];
        if ("pin" in res) {
          issued.push({ rosterId: r.id, name: r.full_name, studentCode: r.student_code, classroom: r.classroom, classNumber: r.class_number, pin: res.pin });
        } else {
          failed.push({ rosterId: r.id, name: r.full_name, error: res.error });
        }
      });
    }
    return NextResponse.json({ ok: true, issued, failed, skipped: ids.length - todo.length });
  }

  // ---------------------------------------------------------------- คนเดียว
  const rosterId = body?.rosterId;
  if (!rosterId || (action !== "issue" && action !== "revoke")) {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ครบ" }, { status: 400 });
  }
  const { data: roster } = await admin.from("class_roster").select(columns).eq("id", rosterId).maybeSingle();
  if (!roster) return NextResponse.json({ error: "ไม่พบนักเรียนคนนี้ในรายชื่อ" }, { status: 404 });
  const row = roster as RosterRow;
  const st = (await statusOf(admin, row.course_id)).get(row.id);

  if (action === "revoke") {
    if (!row.claimed_by || !st?.has_pin) return NextResponse.json({ error: "นักเรียนคนนี้ไม่มี PIN" }, { status: 409 });
    if (st.account === "pin") {
      const res = await detachAndDeleteStudentUser(admin, row.claimed_by);
      if (!res.ok) return NextResponse.json({ error: `ยกเลิก PIN ไม่สำเร็จ: ${res.error}` }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    // บัญชี Google: เปลี่ยนรหัสผ่านเป็นค่าสุ่มยาวที่ไม่มีใครรู้ → PIN เดิมใช้ไม่ได้ ยังเข้าด้วย Google ได้ตามปกติ
    const random = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await admin.auth.admin.updateUserById(row.claimed_by, { password: random, app_metadata: { pin: null } });
    if (error) return NextResponse.json({ error: `ยกเลิก PIN ไม่สำเร็จ: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const res = await issueOne(admin, row, st);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, pin: res.pin, studentCode: row.student_code, name: row.full_name });
}
