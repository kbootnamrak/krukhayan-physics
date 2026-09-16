import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { recordAndNotify } from "@/lib/iot/notify";

/**
 * ตรวจว่ามีอุปกรณ์ตัวไหนเงียบหายไปบ้าง
 *
 * "ไม่มีข้อมูลเข้ามา" เป็นความผิดปกติที่อันตรายที่สุด (ไฟดับ/Wi-Fi ล่ม/บอร์ดค้าง)
 * แต่ตรวจจาก route ingest ไม่ได้ เพราะอุปกรณ์ที่ตายแล้วย่อมไม่ยิงคำขอเข้ามา
 * จึงต้องมีตัวจับเวลาฝั่งเซิร์ฟเวอร์เรียกเข้ามาเป็นระยะ
 *
 * เรียกด้วย  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า CRON_SECRET" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const now = new Date();

  const { data: devices, error } = await admin
    .from("iot_devices")
    .select("id, name, location, last_seen_at, offline_after_s")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changed: { device: string; kind: string }[] = [];

  for (const device of devices ?? []) {
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    const isOffline = now.getTime() - lastSeen > device.offline_after_s * 1000;

    // ดูว่าครั้งล่าสุดเราแจ้งสถานะการเชื่อมต่อของเครื่องนี้ว่าอะไร เพื่อไม่เตือนซ้ำทุกรอบ
    const { data: lastAlert } = await admin
      .from("iot_alerts")
      .select("kind")
      .eq("device_id", device.id)
      .in("kind", ["offline", "online"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastKind = lastAlert?.kind ?? "online";
    if (isOffline === (lastKind === "offline")) continue;

    const kind = isOffline ? "offline" : "online";
    const minutes = device.last_seen_at
      ? Math.round((now.getTime() - lastSeen) / 60000)
      : null;

    await recordAndNotify(
      admin,
      device,
      {
        device_id: device.id,
        rule_id: null,
        metric: null,
        kind,
        value: null,
        threshold: null,
        message: isOffline
          ? minutes === null
            ? "อุปกรณ์ยังไม่เคยส่งข้อมูลเข้ามาเลย"
            : `ขาดการติดต่อ ${minutes} นาที — ตรวจสอบไฟเลี้ยงและสัญญาณ Wi-Fi`
          : "อุปกรณ์กลับมาส่งข้อมูลแล้ว",
      },
      now
    );

    changed.push({ device: device.name, kind });
  }

  return NextResponse.json({ ok: true, checked: devices?.length ?? 0, changed });
}
