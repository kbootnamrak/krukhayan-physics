/**
 * คำนวณคะแนนรวมของนักเรียนหนึ่งคน — ใช้ร่วมกันทั้งตารางของครูและหน้า "คะแนนของฉัน"
 * ให้ตัวเลขสองฝั่งตรงกันเสมอ
 *
 * แยก "ยังไม่ได้กรอก" (null) ออกจาก "ได้ 0" อย่างชัดเจน
 * เดิมช่องว่างถูกนับเป็น 0 แต่คะแนนเต็มนับทั้งวิชา นักเรียนที่เพิ่งสอบไปหน่วยเดียว
 * จึงเห็นตัวเองได้ 7/100 = เกรด 0 ตั้งแต่กลางเทอม
 */

export type SourceType = "unit_component" | "exam";

export type GradedItem = { sourceType: SourceType; sourceId: string; max: number };

export type ScoreLookup = (sourceType: SourceType, sourceId: string) => number | null;

export type ScoreSummary = {
  /** คะแนนที่ได้ รวมเฉพาะช่องที่กรอกแล้ว */
  earned: number;
  /** คะแนนเต็มของทั้งวิชา */
  maxAll: number;
  /** คะแนนเต็มของเฉพาะรายการที่กรอกคะแนนแล้ว */
  maxAssessed: number;
  /** จำนวนรายการที่ยังไม่ได้กรอก */
  missing: number;
  /** กรอกครบทุกรายการแล้ว — เกรดถือเป็นเกรดจริงได้ */
  complete: boolean;
  /** % ของคะแนนที่ได้เทียบกับรายการที่ตรวจแล้ว — null ถ้ายังไม่มีรายการไหนตรวจ */
  percentAssessed: number | null;
  /** % ของทั้งวิชา — มีค่าเฉพาะเมื่อกรอกครบแล้ว */
  percentFinal: number | null;
};

export function gradedItems(
  components: { id: string; max_score: number | string }[],
  exams: { id: string; max_score: number | string }[]
): GradedItem[] {
  return [
    ...components.map((c) => ({ sourceType: "unit_component" as const, sourceId: c.id, max: Number(c.max_score) })),
    ...exams.map((e) => ({ sourceType: "exam" as const, sourceId: e.id, max: Number(e.max_score) })),
  ];
}

export function summarize(items: GradedItem[], scoreOf: ScoreLookup): ScoreSummary {
  let earned = 0;
  let maxAll = 0;
  let maxAssessed = 0;
  let missing = 0;

  for (const item of items) {
    maxAll += item.max;
    const score = scoreOf(item.sourceType, item.sourceId);
    if (score === null) {
      missing++;
    } else {
      earned += score;
      maxAssessed += item.max;
    }
  }

  const complete = items.length > 0 && missing === 0;
  return {
    earned,
    maxAll,
    maxAssessed,
    missing,
    complete,
    percentAssessed: maxAssessed > 0 ? (earned / maxAssessed) * 100 : null,
    percentFinal: complete && maxAll > 0 ? (earned / maxAll) * 100 : null,
  };
}

/** สร้างตัวค้นคะแนนของนักเรียนหนึ่งคนจากแถวคะแนนทั้งหมด */
export function scoreLookup(
  scores: { enrollment_id: string; source_type: SourceType; source_id: string; score: number | string | null }[],
  enrollmentId: string
): ScoreLookup {
  const map = new Map<string, number | null>();
  for (const s of scores) {
    if (s.enrollment_id !== enrollmentId) continue;
    map.set(`${s.source_type}:${s.source_id}`, s.score === null ? null : Number(s.score));
  }
  return (sourceType, sourceId) => map.get(`${sourceType}:${sourceId}`) ?? null;
}

/** แสดงตัวเลขแบบไม่มีทศนิยมเกินจำเป็น: 7.5 → "7.5", 8 → "8", 7.3333 → "7.33" */
export function fmt(n: number) {
  return String(Math.round(n * 100) / 100);
}
