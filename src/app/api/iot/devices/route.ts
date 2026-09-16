import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/iot/auth";
import { adminClient } from "@/lib/iot/admin";
import { createDeviceKey } from "@/lib/iot/deviceKey";

/** เกณฑ์เริ่มต้น — ตั้งให้พอใช้งานได้ทันที ครูปรับเองได้ในหน้าอุปกรณ์ */
const DEFAULT_RULES = [
  { metric: "temperature_c", min_value: 18, max_value: 28, hysteresis: 0.5 },
  { metric: "humidity_pct", min_value: 30, max_value: 70, hysteresis: 2 },
];

export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    location?: string;
    sample_interval_s?: number;
  };

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "ต้องระบุชื่ออุปกรณ์" }, { status: 400 });

  const interval = Number(body.sample_interval_s ?? 60);
  if (!Number.isInteger(interval) || interval < 10 || interval > 3600) {
    return NextResponse.json({ error: "ช่วงเวลาส่งข้อมูลต้องอยู่ระหว่าง 10–3600 วินาที" }, { status: 400 });
  }

  const { key, keyHash, keyPrefix } = createDeviceKey();
  const admin = adminClient();

  const { data: device, error } = await admin
    .from("iot_devices")
    .insert({
      name,
      location: body.location?.trim() || null,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      owner_id: auth.userId,
      sample_interval_s: interval,
    })
    .select("id, name, location, sample_interval_s, key_prefix")
    .single();

  if (error || !device) {
    return NextResponse.json({ error: error?.message ?? "สร้างอุปกรณ์ไม่สำเร็จ" }, { status: 500 });
  }

  await admin
    .from("iot_alert_rules")
    .insert(DEFAULT_RULES.map((r) => ({ ...r, device_id: device.id })));

  // คีย์จริงถูกส่งกลับครั้งเดียวตรงนี้เท่านั้น ฐานข้อมูลเก็บแค่ hash
  return NextResponse.json({ device, key });
}
