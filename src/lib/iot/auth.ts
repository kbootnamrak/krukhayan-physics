import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type TeacherAuth =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/** ตรวจว่าเป็นครูที่ล็อกอินอยู่ — ใช้กับ route ที่จัดการอุปกรณ์/คีย์ */
export async function requireTeacher(): Promise<TeacherAuth> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
