import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAlertMessage, lineConfigured, pushLineText } from "./line";

type AlertRow = {
  device_id: string;
  rule_id: string | null;
  metric: string | null;
  kind: string;
  value: number | null;
  threshold: number | null;
  message: string;
};

/**
 * บันทึกการแจ้งเตือนลงฐานข้อมูล แล้วส่ง LINE ให้ผู้รับของอุปกรณ์นั้น
 * (ผู้รับที่ device_id เป็น null = รับแจ้งเตือนของทุกอุปกรณ์)
 *
 * บันทึกลงตารางก่อนเสมอ ต่อให้ส่ง LINE ไม่ผ่าน ประวัติก็ยังครบ
 */
export async function recordAndNotify(
  admin: SupabaseClient,
  device: { id: string; name: string; location: string | null },
  alert: AlertRow,
  at: Date
) {
  const { data: recipients } = await admin
    .from("iot_line_recipients")
    .select("target_id")
    .eq("enabled", true)
    .or(`device_id.eq.${device.id},device_id.is.null`);

  const targets = [...new Set((recipients ?? []).map((r) => r.target_id as string))];

  const text = buildAlertMessage({
    kind: alert.kind,
    deviceName: device.name,
    location: device.location,
    detail: alert.message,
    at,
    dashboardUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/iot/${device.id}`
      : undefined,
  });

  const errors: string[] = [];
  if (targets.length === 0) {
    errors.push("ยังไม่มีผู้รับแจ้งเตือนทาง LINE");
  } else if (!lineConfigured()) {
    errors.push("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
  } else {
    const retryKey = crypto.randomUUID();
    const results = await Promise.all(targets.map((t) => pushLineText(t, text, retryKey)));
    results.forEach((r, i) => {
      if (!r.ok) errors.push(`${targets[i]}: ${r.error}`);
    });
  }

  await admin.from("iot_alerts").insert({
    ...alert,
    notified: targets.length > 0 && errors.length === 0,
    notify_error: errors.length > 0 ? errors.join(" | ").slice(0, 500) : null,
    created_at: at.toISOString(),
  });
}
