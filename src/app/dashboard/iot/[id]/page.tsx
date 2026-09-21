"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AlertRule } from "@/lib/iot/types";
import { csvFileName, readingsToCsv } from "@/lib/iot/csv";
import TimeSeriesChart, { type Point } from "./TimeSeriesChart";
import ThresholdPanel from "./ThresholdPanel";
import RecipientsPanel, { type Recipient } from "./RecipientsPanel";
import AlertsPanel, { type AlertRow } from "./AlertsPanel";

/**
 * สีของกราฟมาจากชุดสีที่ผ่านการตรวจความต่างสำหรับผู้ที่มองสีผิดปกติแล้ว
 * ส้ม = อุณหภูมิ, น้ำเงิน = ความชื้น ตามความคุ้นเคยของผู้ใช้
 */
const TEMP_COLOR = "#eb6834";
const HUMID_COLOR = "#2a78d6";
const RSSI_COLOR = "#1baf7a";

const RANGES = [
  { key: "1h", label: "1 ชม.", hours: 1 },
  { key: "6h", label: "6 ชม.", hours: 6 },
  { key: "24h", label: "24 ชม.", hours: 24 },
  { key: "7d", label: "7 วัน", hours: 24 * 7 },
] as const;

const REFRESH_MS = 30_000;

type Device = {
  id: string;
  name: string;
  location: string | null;
  sample_interval_s: number;
  offline_after_s: number;
  last_seen_at: string | null;
  key_prefix: string;
};

type Reading = {
  recorded_at: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  heat_index_c: number | null;
  rssi: number | null;
};

type Tab = "chart" | "thresholds" | "alerts" | "recipients" | "device";

export default function IotDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deviceId } = use(params);
  const supabase = createClient();

  const [isTeacher, setIsTeacher] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24h");
  const [tab, setTab] = useState<Tab>("chart");
  const [now, setNow] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setNow(Date.now());
    const uid = userData.user?.id;
    if (!uid) return;

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).single();
    const teacher = profile?.role === "teacher";
    setIsTeacher(teacher);

    const { data: dev } = await supabase
      .from("iot_devices")
      .select("id, name, location, sample_interval_s, offline_after_s, last_seen_at, key_prefix")
      .eq("id", deviceId)
      .single();
    setDevice(dev as Device | null);

    const hours = RANGES.find((r) => r.key === range)!.hours;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const { data: rows } = await supabase
      .from("iot_readings")
      .select("recorded_at, temperature_c, humidity_pct, heat_index_c, rssi")
      .eq("device_id", deviceId)
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(2000);
    setReadings((rows as Reading[]) ?? []);

    const { data: ruleRows } = await supabase
      .from("iot_alert_rules")
      .select("*")
      .eq("device_id", deviceId)
      .order("metric");
    setRules((ruleRows as AlertRule[]) ?? []);

    const { data: alertRows } = await supabase
      .from("iot_alerts")
      .select("id, kind, message, notified, notify_error, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(50);
    setAlerts((alertRows as AlertRow[]) ?? []);

    if (teacher) {
      const { data: recipientRows } = await supabase
        .from("iot_line_recipients")
        .select("id, device_id, target_type, target_id, label, enabled")
        .or(`device_id.eq.${deviceId},device_id.is.null`);
      setRecipients((recipientRows as Recipient[]) ?? []);
    }
  }, [supabase, deviceId, range]);

  useEffect(() => {
    // โหลดครั้งแรกผ่าน timer เช่นเดียวกับรอบถัด ๆ ไป — effect จึงทำหน้าที่
    // "ต่อ/ตัดการเชื่อมกับตัวจับเวลา" อย่างเดียว ไม่สั่ง setState ตรง ๆ
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const series = useMemo(() => {
    const temp: Point[] = [];
    const humid: Point[] = [];
    const rssi: Point[] = [];
    for (const r of readings) {
      const t = new Date(r.recorded_at).getTime();
      if (r.temperature_c !== null) temp.push({ t, v: Number(r.temperature_c) });
      if (r.humidity_pct !== null) humid.push({ t, v: Number(r.humidity_pct) });
      if (r.rssi !== null) rssi.push({ t, v: Number(r.rssi) });
    }
    return { temp, humid, rssi };
  }, [readings]);

  // สร้างไฟล์ในเบราว์เซอร์เลย ไม่ต้องยิงกลับไปที่เซิร์ฟเวอร์ เพราะข้อมูลโหลดมาอยู่แล้ว
  function downloadCsv() {
    if (readings.length === 0) return;
    const rangeLabel = RANGES.find((r) => r.key === range)?.label.replace(/\s/g, "") ?? range;
    const blob = new Blob([readingsToCsv(readings)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(device?.name ?? "อุปกรณ์", rangeLabel);
    link.click();
    URL.revokeObjectURL(url);
  }

  const ruleFor = (metric: string) => rules.find((r) => r.metric === metric) ?? null;
  const tempRule = ruleFor("temperature_c");
  const humidRule = ruleFor("humidity_pct");

  // เทียบกับเวลาที่บันทึกไว้ตอนโหลดข้อมูลรอบล่าสุด ไม่ใช่ Date.now() ตอน render
  // เพื่อให้ผลลัพธ์ของการ render ขึ้นกับ state เท่านั้น
  const isOffline =
    device !== null &&
    now > 0 &&
    (device.last_seen_at === null ||
      now - new Date(device.last_seen_at).getTime() > device.offline_after_s * 1000);

  async function rotateKey() {
    if (!confirm("ออกคีย์ใหม่แล้วคีย์เดิมจะใช้ไม่ได้ทันที ต้องแฟลชบอร์ดใหม่ ยืนยันหรือไม่?")) return;
    setRotating(true);
    const res = await fetch(`/api/iot/devices/${deviceId}/key`, { method: "POST" });
    const body = await res.json();
    setRotating(false);
    if (res.ok) {
      setNewKey(body.key);
      load();
    }
  }

  const tabs: { key: Tab; label: string; teacherOnly?: boolean }[] = [
    { key: "chart", label: "กราฟ" },
    { key: "thresholds", label: "เกณฑ์แจ้งเตือน" },
    { key: "alerts", label: "ประวัติแจ้งเตือน" },
    { key: "recipients", label: "ผู้รับแจ้งเตือน", teacherOnly: true },
    { key: "device", label: "ข้อมูลอุปกรณ์", teacherOnly: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/iot" className="text-sm text-slate-500 hover:underline">
            ← อุปกรณ์ทั้งหมด
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold text-slate-800">{device?.name ?? "กำลังโหลด…"}</h1>
            {device && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  isOffline
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-800 border border-green-200"
                }`}
              >
                {isOffline ? "⚠ ออฟไลน์" : "● ออนไลน์"}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">{device?.location ?? ""}</p>
        </div>

        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {tabs
            .filter((t) => !t.teacherOnly || isTeacher)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-slate-800 text-slate-800 font-medium"
                    : "border-transparent text-slate-500"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {tab === "chart" && (
          <div className="space-y-4">
            <div className="flex gap-1 flex-wrap items-center">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    range === r.key
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}

              <button
                onClick={downloadCsv}
                disabled={readings.length === 0}
                className="ml-auto text-xs px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-600 hover:border-slate-500 disabled:opacity-40"
                title="เปิดใน Excel ได้ทันที มีคอลัมน์เวลาที่ผ่านไปสำหรับพล็อตกราฟ"
              >
                ⬇ ดาวน์โหลด CSV ({readings.length} แถว)
              </button>
            </div>

            <TimeSeriesChart
              title="อุณหภูมิ"
              unit="°C"
              color={TEMP_COLOR}
              data={series.temp}
              min={tempRule?.min_value ?? null}
              max={tempRule?.max_value ?? null}
            />
            <TimeSeriesChart
              title="ความชื้นสัมพัทธ์"
              unit="%RH"
              color={HUMID_COLOR}
              data={series.humid}
              min={humidRule?.min_value ?? null}
              max={humidRule?.max_value ?? null}
            />
            <TimeSeriesChart
              title="ความแรงสัญญาณ Wi-Fi"
              unit="dBm"
              color={RSSI_COLOR}
              data={series.rssi}
              min={null}
              max={null}
            />
          </div>
        )}

        {tab === "thresholds" && (
          <ThresholdPanel rules={rules} isTeacher={isTeacher} onChanged={load} />
        )}

        {tab === "alerts" && <AlertsPanel alerts={alerts} />}

        {tab === "recipients" && isTeacher && (
          <RecipientsPanel deviceId={deviceId} recipients={recipients} onChanged={load} />
        )}

        {tab === "device" && isTeacher && device && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
            <p className="text-slate-600">
              ส่งข้อมูลทุก <strong>{device.sample_interval_s}</strong> วินาที · ถือว่าออฟไลน์เมื่อเงียบเกิน{" "}
              <strong>{Math.round(device.offline_after_s / 60)}</strong> นาที
            </p>
            <p className="text-slate-600">
              Device key ขึ้นต้นด้วย <code className="bg-slate-100 px-1 rounded">{device.key_prefix}</code>{" "}
              (เก็บเฉพาะค่า hash ในฐานข้อมูล ดูคีย์เต็มย้อนหลังไม่ได้)
            </p>
            {newKey && (
              <div className="bg-amber-50 border border-amber-300 rounded-md p-3">
                <p className="text-amber-900 mb-1">คีย์ใหม่ — แสดงครั้งเดียว</p>
                <code className="block bg-white border border-amber-200 rounded px-2 py-1 break-all">
                  {newKey}
                </code>
              </div>
            )}
            <button
              onClick={rotateKey}
              disabled={rotating}
              className="border border-slate-300 rounded-md px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {rotating ? "กำลังออกคีย์…" : "ออก device key ใหม่"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
