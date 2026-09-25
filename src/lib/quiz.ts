/**
 * แบบทดสอบออนไลน์ — ชนิดข้อมูลและข้อความภาษาไทยที่ใช้ร่วมกันทั้งฝั่งครูและนักเรียน
 * การเริ่มทำ บันทึกคำตอบ และส่ง ทำผ่านฟังก์ชันในฐานข้อมูล (quiz_start / quiz_save_answer / quiz_submit)
 * ดูรายละเอียดความปลอดภัยใน migration ของแบบทดสอบ
 */

export type Quiz = {
  id: string;
  course_id: string;
  unit_id: string | null;
  title: string;
  time_limit_minutes: number;
  shuffle: boolean;
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  image: string | null;
  choices: string[];
};

export type QuizSession = { id: string; quiz_id: string; classroom: string; opened_at: string; closed_at: string | null };

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number;
  answers: Record<string, number>;
};

/** โจทย์ที่นักเรียนได้รับจาก quiz_start — ตัวเลือกสลับแล้ว k คือเลขตัวเลือกเดิม (ไม่มีเฉลย) */
export type TakeQuestion = { id: string; prompt: string; image: string | null; choices: { k: number; text: string }[] };

export type TakePayload = {
  attempt_id: string;
  title: string;
  deadline_at: string;
  server_now: string;
  answers: Record<string, number>;
  questions: TakeQuestion[];
};

export const CHOICE_LABELS = ["ก", "ข", "ค", "ง", "จ", "ฉ"];

/** แปลงรหัสข้อผิดพลาดจากฟังก์ชันในฐานข้อมูลเป็นข้อความที่นักเรียนอ่านเข้าใจ */
export function quizErrorMessage(message: string | undefined | null): string {
  const m = message ?? "";
  if (m.includes("not_open")) return "ครูยังไม่เปิดแบบทดสอบนี้ให้ห้องของคุณ";
  if (m.includes("already_submitted")) return "คุณส่งแบบทดสอบนี้ไปแล้ว";
  if (m.includes("time_up")) return "หมดเวลาทำแบบทดสอบแล้ว ระบบตรวจจากคำตอบที่บันทึกไว้";
  if (m.includes("not_enrolled")) return "คุณยังไม่ได้ลงทะเบียนในวิชานี้ ถ้าคิดว่าผิดพลาด แจ้งครูผู้สอน";
  if (m.includes("no_questions")) return "แบบทดสอบนี้ยังไม่มีคำถาม";
  if (m.includes("quiz_not_found")) return "ไม่พบแบบทดสอบนี้";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return m || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

/** ย่อรูปในเบราว์เซอร์แล้วแปลงเป็น data URI (กว้างไม่เกิน 1000px) — เก็บในฐานข้อมูลได้เลย ไม่ต้องมีที่เก็บไฟล์ */
export async function imageFileToDataUri(file: File, maxWidth = 1000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // พื้นขาว — รูปโปร่งใสจะได้ไม่กลายเป็นดำ
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.85;
  let uri = canvas.toDataURL("image/webp", quality);
  while (uri.length > 650_000 && quality > 0.4) {
    quality -= 0.15;
    uri = canvas.toDataURL("image/webp", quality);
  }
  if (uri.length > 650_000) throw new Error("รูปใหญ่เกินไป ลองตัดรูปให้เล็กลง");
  return uri;
}
