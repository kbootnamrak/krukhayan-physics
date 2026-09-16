import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { hashDeviceKey } from "@/lib/iot/deviceKey";
import { describeEvent, evaluateRule } from "@/lib/iot/alerts";
import { recordAndNotify } from "@/lib/iot/notify";
import { SENSOR_RANGE, type AlertRule, type AlertState, type Metric } from "@/lib/iot/types";

/** จำนวนค่าที่รับได้ต่อหนึ่งคำขอ — อุปกรณ์ที่ออฟไลน์ไปพักหนึ่งจะส่งย้อนหลังมาเป็นชุด */
const MAX_BATCH = 60;

/** ยอมรับเวลาที่อุปกรณ์แนบมาได้ย้อนหลังเท่านี้ (นาฬิกาอุปกรณ์อาจเดินคลาดถ้า NTP ไม่ผ่าน) */
const MAX_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type Sample = {
  recorded_at?: string;
  temperature_c?: unknown;
  humidity_pct?: unknown;
  heat_index_c?: unknown;
  rssi?: unknown;
  uptime_s?: unknown;
};

function readMetric(raw: unknown, metric: Metric): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const { min, max } = SENSOR_RANGE[metric];
  // นอกช่วงที่เซนเซอร์วัดได้ = อ่านพลาด/สายหลวม ไม่ใช่สภาพแวดล้อมจริง
  if (n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

function readNumber(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function resolveTimestamp(raw: string | undefined, now: Date) {
  if (!raw) return now;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return now;
  const diff = now.getTime() - t.getTime();
  // เวลาอนาคตเกิน 5 นาที หรือย้อนหลังเกิน 7 วัน = นาฬิกาอุปกรณ์เพี้ยน ใช้เวลาเซิร์ฟเวอร์แทน
  if (diff < -MAX_CLOCK_SKEW_MS || diff > MAX_BACKFILL_MS) return now;
  return t;
}

export async function POST(request: Request) {
  const key = request.headers.get("x-device-key");
  if (!key) {
    return NextResponse.json({ error: "missing x-device-key" }, { status: 401 });
  }

  let admin;
  try {
    admin = adminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server misconfigured" },
      { status: 500 }
    );
  }

  const { data: device } = await admin
    .from("iot_devices")
    .select("id, name, location, is_active, sample_interval_s")
    .eq("key_hash", hashDeviceKey(key))
    .maybeSingle();

  if (!device) return NextResponse.json({ error: "unknown device key" }, { status: 401 });
  if (!device.is_active) return NextResponse.json({ error: "device disabled" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const raw = body as { readings?: Sample[] } & Sample;
  const samples = Array.isArray(raw.readings) ? raw.readings : [raw];
  if (samples.length === 0 || samples.length > MAX_BATCH) {
    return NextResponse.json({ error: `readings ต้องมี 1–${MAX_BATCH} รายการ` }, { status: 400 });
  }

  const now = new Date();
  const rows = samples
    .map((s) => {
      const temperature = readMetric(s.temperature_c, "temperature_c");
      const humidity = readMetric(s.humidity_pct, "humidity_pct");
      if (temperature === null && humidity === null) return null;
      return {
        device_id: device.id,
        recorded_at: resolveTimestamp(s.recorded_at, now).toISOString(),
        temperature_c: temperature,
        humidity_pct: humidity,
        heat_index_c: readNumber(s.heat_index_c),
        rssi: readNumber(s.rssi),
        uptime_s: readNumber(s.uptime_s),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return NextResponse.json({ error: "ไม่มีค่าที่อ่านได้ในช่วงที่เซนเซอร์รองรับ" }, { status: 422 });
  }

  // upsert + ignoreDuplicates: อุปกรณ์ส่งซ้ำเพราะ retry ก็ไม่เกิดข้อมูลซ้อน
  const { error: insertError } = await admin
    .from("iot_readings")
    .upsert(rows, { onConflict: "device_id,recorded_at", ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const latest = rows.reduce((a, b) => (a.recorded_at >= b.recorded_at ? a : b));

  await admin
    .from("iot_devices")
    .update({ last_seen_at: now.toISOString(), last_rssi: latest.rssi })
    .eq("id", device.id);

  await evaluateAlerts(admin, device, latest, now);

  return NextResponse.json({
    ok: true,
    accepted: rows.length,
    skipped: samples.length - rows.length,
    // ให้อุปกรณ์ปรับจังหวะการส่งและตั้งนาฬิกาตามเซิร์ฟเวอร์ได้โดยไม่ต้องแฟลชใหม่
    sample_interval_s: device.sample_interval_s,
    server_time: now.toISOString(),
  });
}

type LatestRow = { temperature_c: number | null; humidity_pct: number | null };

async function evaluateAlerts(
  admin: ReturnType<typeof adminClient>,
  device: { id: string; name: string; location: string | null },
  latest: LatestRow,
  now: Date
) {
  const { data: rules } = await admin
    .from("iot_alert_rules")
    .select("id, device_id, metric, min_value, max_value, hysteresis, consecutive_required, cooldown_minutes, enabled")
    .eq("device_id", device.id)
    .eq("enabled", true);

  if (!rules || rules.length === 0) return;

  const { data: states } = await admin
    .from("iot_alert_states")
    .select("rule_id, status, breach_count, last_notified_at")
    .in("rule_id", rules.map((r) => r.id));

  const stateByRule = new Map(
    (states ?? []).map((s) => [s.rule_id as string, s as AlertState & { rule_id: string }])
  );

  for (const rule of rules as AlertRule[]) {
    const value = latest[rule.metric];
    if (value === null) continue;

    const previous: AlertState = stateByRule.get(rule.id) ?? {
      status: "ok",
      breach_count: 0,
      last_notified_at: null,
    };

    const { state, event } = evaluateRule(rule, previous, value, now);

    await admin.from("iot_alert_states").upsert(
      {
        rule_id: rule.id,
        status: state.status,
        breach_count: state.breach_count,
        last_notified_at: state.last_notified_at,
        updated_at: now.toISOString(),
      },
      { onConflict: "rule_id" }
    );

    if (!event) continue;

    await recordAndNotify(
      admin,
      device,
      {
        device_id: device.id,
        rule_id: rule.id,
        metric: rule.metric,
        kind: event.kind,
        value: event.value,
        threshold: event.threshold,
        message: describeEvent(event),
      },
      now
    );
  }
}
