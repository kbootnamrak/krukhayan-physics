/**
 * อ่านรายชื่อนักเรียนจากตาราง Excel (แถวละ array ของค่าในแต่ละช่อง)
 *
 * รับได้ 2 แบบ:
 *   1. แบบที่ส่งออกจากระบบทะเบียนโรงเรียน
 *      รหัสนักเรียน | คำนำหน้า | ชื่อ | นามสกุล | ระดับชั้น | ห้อง | เลขที่ | ... | สถานะนักเรียน
 *   2. แบบย่อ: รหัสนักเรียน | ชื่อ-สกุล
 *
 * หัวตารางไม่จำเป็นต้องอยู่แถวแรก — ไฟล์จากระบบทะเบียนบางรุ่นมีชื่อโรงเรียน/หัวรายงานอยู่ด้านบน
 * จึงหาแถวที่มีคำว่า "รหัสนักเรียน" เอง
 */

export type RosterInput = {
  student_code: string;
  full_name: string;
  /** เช่น "ม.6/1" — null ถ้าไฟล์ไม่มีคอลัมน์ห้อง */
  classroom: string | null;
  class_number: number | null;
};

export type ParseResult =
  | { ok: true; rows: RosterInput[]; skipped: { student_code: string; full_name: string; reason: string }[] }
  | { ok: false; error: string };

/** สถานะที่ถือว่ายังเรียนอยู่ — สถานะอื่น (ลาออก ย้าย จำหน่าย พักการเรียน ...) จะถูกข้าม */
const ACTIVE_STATUS = new Set(["เรียน", "กำลังเรียน", "กำลังศึกษา", "ปกติ"]);

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["รหัสนักเรียน", "เลขประจำตัวนักเรียน", "เลขประจำตัว", "student_code"],
  fullName: ["ชื่อ-สกุล", "ชื่อ - สกุล", "ชื่อ-นามสกุล", "ชื่อสกุล", "full_name"],
  prefix: ["คำนำหน้า", "คำนำหน้าชื่อ"],
  firstName: ["ชื่อ"],
  lastName: ["นามสกุล", "สกุล"],
  level: ["ระดับชั้น", "ชั้น"],
  room: ["ห้อง"],
  number: ["เลขที่"],
  status: ["สถานะนักเรียน", "สถานะ"],
};

/** ตัดช่องว่างทุกแบบ รวมถึงช่องว่างที่มองไม่เห็นซึ่งมักติดมากับไฟล์จากระบบทะเบียน */
function clean(value: unknown) {
  return String(value ?? "")
    .replace(/[ ​﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumns(header: string[]) {
  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i !== -1) col[key as keyof typeof HEADER_ALIASES] = i;
  }
  return col;
}

/** "ม.6" + "1" → "ม.6/1" · ถ้ามีแค่ห้อง ใช้ห้องอย่างเดียว */
function classroomOf(level: string, room: string) {
  if (level && room) return `${level}/${room}`;
  return room || level || null;
}

export function parseRoster(table: unknown[][]): ParseResult {
  const headerIndex = table.slice(0, 20).findIndex((row) => row.some((cell) => HEADER_ALIASES.code.includes(clean(cell))));
  if (headerIndex === -1) {
    return { ok: false, error: 'ไม่พบคอลัมน์ "รหัสนักเรียน" — ต้องมีหัวตารางชื่อนี้อยู่ในชีตแรก' };
  }

  const col = findColumns(table[headerIndex].map(clean));
  const hasSplitName = col.firstName !== undefined && col.lastName !== undefined;
  if (col.fullName === undefined && !hasSplitName) {
    return { ok: false, error: 'ไม่พบคอลัมน์ชื่อ — ต้องมี "ชื่อ-สกุล" หรือ "ชื่อ" กับ "นามสกุล"' };
  }

  const get = (row: unknown[], key: keyof typeof HEADER_ALIASES) => (col[key] === undefined ? "" : clean(row[col[key]!]));

  const rows: RosterInput[] = [];
  const skipped: { student_code: string; full_name: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const row of table.slice(headerIndex + 1)) {
    const code = get(row, "code");
    // คำนำหน้าติดกับชื่อ ไม่เว้นวรรค ตามแบบที่โรงเรียนเขียน เช่น "นายณัฐพัฒน์ โกะสูงเนิน"
    const fullName = hasSplitName
      ? `${get(row, "prefix")}${get(row, "firstName")} ${get(row, "lastName")}`.trim()
      : get(row, "fullName");

    if (!code && !fullName) continue; // แถวว่างท้ายตาราง

    if (!code || !fullName) {
      skipped.push({ student_code: code || "(ไม่มีรหัส)", full_name: fullName, reason: "ข้อมูลไม่ครบ" });
      continue;
    }

    const status = get(row, "status");
    if (status && !ACTIVE_STATUS.has(status)) {
      skipped.push({ student_code: code, full_name: fullName, reason: `สถานะ "${status}"` });
      continue;
    }

    if (seen.has(code)) {
      skipped.push({ student_code: code, full_name: fullName, reason: "รหัสซ้ำในไฟล์" });
      continue;
    }
    seen.add(code);

    const number = parseInt(get(row, "number"), 10);
    rows.push({
      student_code: code,
      full_name: fullName,
      classroom: classroomOf(get(row, "level"), get(row, "room")),
      class_number: Number.isFinite(number) ? number : null,
    });
  }

  if (rows.length === 0 && skipped.length === 0) {
    return { ok: false, error: "ไม่พบรายชื่อนักเรียนใต้หัวตาราง" };
  }
  return { ok: true, rows, skipped };
}
