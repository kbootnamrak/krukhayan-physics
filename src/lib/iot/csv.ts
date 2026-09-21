export type CsvReading = {
  recorded_at: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  heat_index_c: number | null;
  rssi: number | null;
};

const BANGKOK = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** คืนรูปแบบ YYYY-MM-DD HH:MM:SS ตามเวลาไทย — Excel อ่านเป็นวันที่-เวลาได้เลย */
function bangkokTime(iso: string) {
  return BANGKOK.format(new Date(iso)).replace("T", " ");
}

function cell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * แปลงค่าที่วัดได้เป็น CSV สำหรับเปิดใน Excel
 *
 * คอลัมน์ "เวลาที่ผ่านไป" นับจากแถวแรกของชุดข้อมูล มีไว้ให้พล็อตกราฟและ
 * fit สมการได้ตรง ๆ เช่นกราฟการเย็นตัวที่ต้องให้จุดเริ่มต้นเป็นศูนย์
 */
export function readingsToCsv(rows: CsvReading[]) {
  const headers = [
    "เวลา",
    "เวลาที่ผ่านไป (วินาที)",
    "อุณหภูมิ (°C)",
    "ความชื้น (%RH)",
    "ดัชนีความร้อน (°C)",
    "ความแรงสัญญาณ (dBm)",
  ];

  const sorted = [...rows].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const startMs = sorted.length > 0 ? new Date(sorted[0].recorded_at).getTime() : 0;

  const lines = sorted.map((r) =>
    [
      cell(bangkokTime(r.recorded_at)),
      cell(Math.round((new Date(r.recorded_at).getTime() - startMs) / 1000)),
      cell(r.temperature_c),
      cell(r.humidity_pct),
      cell(r.heat_index_c),
      cell(r.rssi),
    ].join(",")
  );

  // ﻿ (BOM) จำเป็นสำหรับ Excel บน Windows ไม่งั้นหัวตารางภาษาไทยจะกลายเป็นตัวขยะ
  return "﻿" + [headers.join(","), ...lines].join("\r\n") + "\r\n";
}

export function csvFileName(deviceName: string, rangeLabel: string) {
  const stamp = BANGKOK.format(new Date()).replace(/[^0-9]/g, "").slice(0, 12);
  const safeName = deviceName.replace(/[\\/:*?"<>|]/g, "").trim() || "อุปกรณ์";
  return `${safeName}-${rangeLabel}-${stamp}.csv`;
}
