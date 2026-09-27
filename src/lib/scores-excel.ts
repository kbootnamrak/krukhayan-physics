import { fmt, type SourceType } from "@/lib/scores";

/**
 * อ่าน/เขียนคะแนนเป็น Excel — ใช้ทั้งแบบฟอร์มนำเข้าและไฟล์ที่กด "ดาวน์โหลด Excel"
 * หัวคอลัมน์คะแนนเป็นรูปแบบเดียวกัน: "หน่วยที่ 1 แม่เหล็กและไฟฟ้า K (10)" / "กลางภาค (10)"
 * จึงเอาไฟล์ที่ดาวน์โหลดไปแก้แล้วนำเข้ากลับได้เลย
 */

export type ExcelColumn = { sourceType: SourceType; sourceId: string; max: number; label: string };
export type ExcelGroup = { title: string; exam: boolean; columns: ExcelColumn[] };
export type ExcelStudent = {
  id: string; // enrollment id
  full_name: string;
  student_code: string | null;
  classroom: string | null;
  class_number: number | null;
};

/** ชื่อคอลัมน์ไม่รวมคะแนนเต็ม — ใช้จับคู่ตอนนำเข้า (ครูแก้คะแนนเต็มทีหลังไฟล์เก่าก็ยังใช้ได้) */
export function columnKey(group: ExcelGroup, column: ExcelColumn) {
  return group.exam ? column.label : `${group.title} ${column.label}`;
}

export function columnHeader(group: ExcelGroup, column: ExcelColumn) {
  return `${columnKey(group, column)} (${fmt(column.max)})`;
}

/** ตัดช่องว่างทุกแบบ และตัด "(คะแนนเต็ม)" ท้ายหัวคอลัมน์ */
function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/[ ​﻿]/g, " ")
    .replace(/\(\s*[\d.]+\s*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCode(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

export type ParsedCell = { enrollmentId: string; sourceType: SourceType; sourceId: string; score: number };

export type ScoreParseResult =
  | {
      ok: true;
      cells: ParsedCell[];
      /** ชื่อคอลัมน์คะแนนที่พบในไฟล์ */
      matchedColumns: string[];
      /** รหัสในไฟล์ที่ไม่มีในวิชานี้ */
      unknownCodes: string[];
      /** ช่องที่ใส่ค่าผิด (ไม่บันทึกช่องเหล่านี้) */
      problems: string[];
      /** ช่องว่างที่ข้ามไป (ไม่ลบคะแนนเดิม) */
      blank: number;
    }
  | { ok: false; error: string };

export function parseScoreSheet(table: unknown[][], groups: ExcelGroup[], students: ExcelStudent[]): ScoreParseResult {
  const headerIndex = table.slice(0, 20).findIndex((row) => row.some((cell) => normalizeHeader(cell) === "รหัสนักเรียน"));
  if (headerIndex === -1) return { ok: false, error: 'ไม่พบคอลัมน์ "รหัสนักเรียน" — ใช้แบบฟอร์มที่ดาวน์โหลดจากหน้านี้' };

  const header = table[headerIndex].map(normalizeHeader);
  const codeCol = header.indexOf("รหัสนักเรียน");

  const byKey = new Map<string, ExcelColumn>();
  for (const g of groups) for (const c of g.columns) byKey.set(columnKey(g, c), c);

  const scoreCols = header
    .map((h, i) => ({ i, h, column: byKey.get(h) }))
    .filter((x): x is { i: number; h: string; column: ExcelColumn } => !!x.column);
  if (scoreCols.length === 0) {
    return { ok: false, error: "ไม่พบคอลัมน์คะแนนที่ตรงกับหน่วยของวิชานี้ — หัวคอลัมน์ต้องเหมือนในแบบฟอร์ม เช่น \"หน่วยที่ 1 ... K (10)\"" };
  }

  const byCode = new Map(students.filter((s) => s.student_code).map((s) => [cleanCode(s.student_code), s]));
  const cells: ParsedCell[] = [];
  const unknownCodes: string[] = [];
  const problems: string[] = [];
  let blank = 0;

  table.slice(headerIndex + 1).forEach((row, r) => {
    const code = cleanCode(row[codeCol]);
    if (!code) return;
    const student = byCode.get(code);
    if (!student) return void unknownCodes.push(code);
    const excelRow = headerIndex + r + 2; // เลขแถวตามที่เห็นใน Excel

    for (const { i, h, column } of scoreCols) {
      const raw = row[i];
      const text = String(raw ?? "").trim();
      if (text === "") {
        blank++;
        continue;
      }
      const score = typeof raw === "number" ? raw : Number(text.replace(",", "."));
      if (!Number.isFinite(score)) problems.push(`แถว ${excelRow} ${student.full_name} · ${h}: "${text}" ไม่ใช่ตัวเลข`);
      else if (score < 0) problems.push(`แถว ${excelRow} ${student.full_name} · ${h}: ติดลบไม่ได้`);
      else if (score > column.max) problems.push(`แถว ${excelRow} ${student.full_name} · ${h}: ${text} เกินคะแนนเต็ม ${fmt(column.max)}`);
      else cells.push({ enrollmentId: student.id, sourceType: column.sourceType, sourceId: column.sourceId, score });
    }
  });

  return { ok: true, cells, matchedColumns: scoreCols.map((x) => x.h), unknownCodes, problems, blank };
}
