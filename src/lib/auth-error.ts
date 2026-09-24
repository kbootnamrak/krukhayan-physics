/**
 * แปลง error จาก Supabase Auth เป็นภาษาไทย
 * เดิมหน้าเข้าสู่ระบบแสดงข้อความดิบ เช่น "Invalid login credentials" ซึ่งนักเรียนหลายคนอ่านไม่ออก
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  email_not_confirmed: "ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ยืนยันในกล่องจดหมายก่อน",
  over_email_send_rate_limit: "ขอส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่",
  over_request_rate_limit: "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
  same_password: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
  weak_password: "รหัสผ่านง่ายเกินไป ลองใช้ตัวอักษรผสมตัวเลขให้ยาวขึ้น",
  session_not_found: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง",
  user_banned: "บัญชีนี้ถูกระงับการใช้งาน ติดต่อครูผู้ดูแล",
  email_address_invalid: "รูปแบบอีเมลไม่ถูกต้อง",
  validation_failed: "ข้อมูลไม่ถูกต้อง ตรวจอีเมลแล้วลองใหม่",
};

export function authErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "";
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];

  const message = error.message ?? "";
  if (/failed to fetch|network|load failed/i.test(message)) return "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  if (/invalid login credentials/i.test(message)) return MESSAGES.invalid_credentials;
  if (/session/i.test(message)) return MESSAGES.session_not_found;
  if (/rate limit|too many/i.test(message)) return MESSAGES.over_request_rate_limit;

  return `เกิดข้อผิดพลาด: ${message || "ไม่ทราบสาเหตุ"}`;
}
