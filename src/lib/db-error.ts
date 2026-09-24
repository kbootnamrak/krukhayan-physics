/**
 * แปลง error จาก Supabase เป็นข้อความภาษาไทยที่ครูอ่านแล้วรู้ว่าต้องทำอะไร
 *
 * trigger ในฐานข้อมูลส่งข้อความภาษาไทยมาเองอยู่แล้ว (เช่น "คะแนน 12 เกินคะแนนเต็ม 10")
 * ส่วนที่ต้องแปลคือ error ที่มาจากตัว Postgres / เครือข่ายโดยตรง
 */
export function dbErrorMessage(
  error: { message?: string; code?: string } | null | undefined,
  options: { duplicate?: string } = {}
): string {
  if (!error) return "";
  const message = error.message ?? "";

  if (/failed to fetch|network|load failed/i.test(message)) {
    return "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  }
  // unique constraint — ข้อความขึ้นกับว่ากำลังเพิ่มอะไร ผู้เรียกจึงส่งมาเอง
  if (error.code === "23505") return options.duplicate ?? "มีข้อมูลนี้อยู่แล้ว";
  if (/max_positive/.test(message)) return "คะแนนเต็มต้องมากกว่า 0";
  if (error.code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "ไม่มีสิทธิ์บันทึก — ลองออกจากระบบแล้วเข้าใหม่";
  }
  // ข้อความภาษาไทยจาก trigger ส่งต่อได้ตรง ๆ
  if (/[฀-๿]/.test(message)) return message;

  return `บันทึกไม่สำเร็จ (${message || "ไม่ทราบสาเหตุ"})`;
}
