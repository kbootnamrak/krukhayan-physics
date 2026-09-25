/**
 * สีลายวงจรของแต่ละหน่วยการเรียน — ใช้ชุดเดียวกันทั้งหน้าคะแนนนักเรียนและตารางกรอกคะแนนของครู
 * หน่วยที่ 1 ได้สีแรก หน่วยที่ 2 สีที่สอง … วนกลับเมื่อเกิน 4 หน่วย
 * ค่าสีจริงอยู่ใน globals.css (--trace-*) และเปลี่ยนตามธีมมืด/สว่าง
 */
export const UNIT_TRACES = ["var(--trace-magenta)", "var(--trace-cyan)", "var(--trace-yellow)", "var(--trace-lime)"];

/** สายสอบกลางภาค/ปลายภาค ใช้สีกระเบื้อง (ขาวบนพื้นมืด / หมึกกรมท่าบนพื้นสว่าง) */
export const EXAM_TRACE = "var(--porcelain)";

export function unitTrace(index: number) {
  return UNIT_TRACES[index % UNIT_TRACES.length];
}

/** สีตัวอักษรบนป้ายที่พื้นเป็นสีของสาย — สีสว่าง (เหลือง/เขียวมะนาว/ฟ้า) ต้องใช้หมึกเข้ม */
export function traceInk(color: string) {
  return color === UNIT_TRACES[0] ? "white" : "var(--sign-ink)";
}
