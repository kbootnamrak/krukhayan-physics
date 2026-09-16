import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { createDeviceKey } from "@/lib/iot/deviceKey";

/** ออกคีย์ใหม่ให้อุปกรณ์ (คีย์เดิมใช้ไม่ได้ทันที — ต้องแฟลช config.h ใหม่) */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const { key, keyHash, keyPrefix } = createDeviceKey();
  const admin = adminClient();

  const { error } = await admin
    .from("iot_devices")
    .update({ key_hash: keyHash, key_prefix: keyPrefix })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key, key_prefix: keyPrefix });
}
