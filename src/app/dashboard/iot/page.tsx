"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DeviceRow = {
  device_id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  is_offline: boolean;
  recorded_at: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
};

const REFRESH_MS = 30_000;

function formatSeen(iso: string | null, now: number) {
  if (!iso) return "ยังไม่เคยส่งข้อมูล";
  if (now === 0) return "";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "เมื่อครู่นี้";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.round(hours / 24)} วันที่แล้ว`;
}

export default function IotDevicesPage() {
  const supabase = createClient();

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setNow(Date.now());
    const uid = userData.user?.id;
    if (!uid) return;

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).single();
    setIsTeacher(profile?.role === "teacher");

    const { data } = await supabase
      .from("iot_device_latest")
      .select("*")
      .order("name");
    setDevices((data as DeviceRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

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

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    const res = await fetch("/api/iot/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location, sample_interval_s: 60 }),
    });
    const body = await res.json();
    setCreating(false);

    if (!res.ok) {
      setError(body.error ?? "สร้างอุปกรณ์ไม่สำเร็จ");
      return;
    }
    setNewKey(body.key);
    setName("");
    setLocation("");
    load();
  }

  return (
    <div className="px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
            ← กลับหน้าหลัก
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800 mt-2">ระบบติดตามอุณหภูมิและความชื้น</h1>
          <p className="text-slate-500 text-sm">
            ข้อมูลจากบอร์ด ESP32 + เซนเซอร์ DHT11 อัปเดตอัตโนมัติทุก 30 วินาที
          </p>
        </div>

        {newKey && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">
              คัดลอก device key นี้ไปใส่ใน <code>config.h</code> ของบอร์ด — แสดงเพียงครั้งเดียว
            </p>
            <code className="block bg-white border border-amber-200 rounded-md px-3 py-2 text-sm break-all">
              {newKey}
            </code>
            <button
              onClick={() => setNewKey(null)}
              className="text-xs text-amber-900 underline underline-offset-2"
            >
              คัดลอกแล้ว ปิดข้อความนี้
            </button>
          </div>
        )}

        {isTeacher && (
          <form
            onSubmit={createDevice}
            className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2 flex-wrap"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่ออุปกรณ์ เช่น เครื่องวัดห้องเซิร์ฟเวอร์"
              className="flex-1 min-w-[220px] border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ตำแหน่งติดตั้ง เช่น อาคาร 3 ชั้น 2"
              className="flex-1 min-w-[200px] border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              disabled={creating}
              className="bg-slate-800 text-white rounded-md px-4 text-sm disabled:opacity-50"
            >
              {creating ? "กำลังสร้าง…" : "เพิ่มอุปกรณ์"}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          {loading && <p className="text-sm text-slate-400">กำลังโหลด…</p>}
          {!loading && devices.length === 0 && (
            <p className="text-sm text-slate-400">ยังไม่มีอุปกรณ์ในระบบ</p>
          )}
          {devices.map((d) => (
            <Link
              key={d.device_id}
              href={`/dashboard/iot/${d.device_id}`}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.location ?? "ไม่ได้ระบุตำแหน่ง"}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                    d.is_offline
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-green-50 text-green-800 border border-green-200"
                  }`}
                >
                  {d.is_offline ? "⚠ ออฟไลน์" : "● ออนไลน์"}
                </span>
              </div>

              <div className="mt-4 flex gap-6">
                <div>
                  <p className="text-2xl font-semibold text-slate-800 tabular-nums">
                    {d.temperature_c === null ? "—" : `${Number(d.temperature_c).toFixed(1)}°C`}
                  </p>
                  <p className="text-xs text-slate-500">อุณหภูมิ</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800 tabular-nums">
                    {d.humidity_pct === null ? "—" : `${Number(d.humidity_pct).toFixed(0)}%`}
                  </p>
                  <p className="text-xs text-slate-500">ความชื้น</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-3">อัปเดต {formatSeen(d.last_seen_at, now)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
