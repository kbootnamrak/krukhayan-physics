import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getLineDisplayName, replyLineText, verifyLineSignature } from "@/lib/iot/line";

/**
 * Webhook ของ LINE — ใช้เก็บ userId ของคนที่จะรับแจ้งเตือน
 *
 * LINE ไม่เปิดเผย userId ให้ผู้ใช้เห็นเอง วิธีเดียวที่จะได้มาคือรอให้ผู้ใช้
 * แอดบอทเป็นเพื่อน (event: follow) หรือทักบอทสักครั้ง (event: message)
 * แล้วดึง source.userId จาก webhook นี้
 *
 * ตั้งค่า Webhook URL ใน LINE Developers Console เป็น
 *   https://<โดเมนของเว็บ>/api/iot/line/webhook
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const admin = adminClient();

  for (const event of payload.events ?? []) {
    const source = event.source ?? {};
    const targetType = source.type === "group" ? "group" : source.type === "room" ? "room" : "user";
    const targetId = source.groupId ?? source.roomId ?? source.userId;
    if (!targetId) continue;

    if (event.type === "unfollow" || event.type === "leave") {
      await admin
        .from("iot_line_recipients")
        .update({ enabled: false })
        .eq("target_id", targetId)
        .is("device_id", null);
      continue;
    }

    if (event.type !== "follow" && event.type !== "join" && event.type !== "message") continue;

    const label =
      targetType === "user" && source.userId ? await getLineDisplayName(source.userId) : null;

    // device_id เป็น null = รับแจ้งเตือนของทุกอุปกรณ์ ครูปรับให้เจาะจงรายเครื่องได้ในหน้าเว็บ
    const { error } = await admin.from("iot_line_recipients").upsert(
      {
        device_id: null,
        target_type: targetType,
        target_id: targetId,
        label: label ?? targetType,
        enabled: true,
      },
      { onConflict: "device_id,target_id" }
    );

    if (!error && event.replyToken) {
      await replyLineText(
        event.replyToken,
        "ลงทะเบียนรับแจ้งเตือนอุณหภูมิ/ความชื้นเรียบร้อยแล้ว\nระบบจะส่งข้อความมาที่นี่เมื่อค่าที่วัดได้ผิดจากเกณฑ์ที่ตั้งไว้"
      );
    }
  }

  // LINE ต้องได้ 200 เสมอ ไม่งั้นจะ retry และอาจปิด webhook ทิ้ง
  return NextResponse.json({ ok: true });
}

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
};
