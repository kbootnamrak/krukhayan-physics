/**
 * เรียงรายชื่อนักเรียนแบบสมุดคะแนน: ตามห้อง → เลขที่ → รหัสนักเรียน
 * ใช้ที่เดียวกันทั้งแท็บนักเรียน ตารางกรอกคะแนน และไฟล์ Excel ให้ลำดับตรงกันทุกที่
 *
 * คนที่ไม่มีห้อง/เลขที่ (นำเข้าจากไฟล์แบบย่อ) ไปอยู่ท้ายสุด เรียงตามรหัสนักเรียน
 */
// ใช้ ?: ด้วย เพราะแถวที่นำเข้าก่อนมีคอลัมน์ห้อง/เลขที่ อาจไม่มีค่านี้เลย (undefined) แทนที่จะเป็น null
export type Orderable = { classroom?: string | null; class_number?: number | null; student_code: string | null };

const th = new Intl.Collator("th", { numeric: true });

export function compareRoster(a: Orderable, b: Orderable) {
  const ra = a.classroom ?? null;
  const rb = b.classroom ?? null;
  if (ra !== rb) {
    if (ra === null) return 1;
    if (rb === null) return -1;
    // numeric: "ม.6/2" มาก่อน "ม.6/10"
    return th.compare(ra, rb);
  }
  const na = a.class_number ?? null;
  const nb = b.class_number ?? null;
  if (na !== nb) {
    if (na === null) return 1;
    if (nb === null) return -1;
    return na - nb;
  }
  return th.compare(a.student_code ?? "", b.student_code ?? "");
}

/** "ม.6/1 เลขที่ 3" — ว่างถ้าไม่มีข้อมูลห้อง */
export function placeLabel(s: { classroom?: string | null; class_number?: number | null }) {
  return [s.classroom, s.class_number != null ? `เลขที่ ${s.class_number}` : null].filter(Boolean).join(" ");
}
