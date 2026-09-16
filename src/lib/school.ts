/**
 * โดเมนอีเมลของโรงเรียน — ใช้จำกัดว่าใครล็อกอินเข้าระบบได้
 *
 * อีเมลนักเรียนตั้งตามรหัสนักเรียน เช่น 65001@urrw.ac.th
 * ระบบจึงถอดรหัสนักเรียนออกจากอีเมลได้ตรง ๆ โดยไม่ต้องกรอกอีเมลตอนนำเข้า Excel
 */
export const SCHOOL_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN?.trim().toLowerCase() || "urrw.ac.th";

export function isSchoolEmail(email: string | null | undefined) {
  return Boolean(email?.trim().toLowerCase().endsWith(`@${SCHOOL_EMAIL_DOMAIN}`));
}

/** ถอดรหัสนักเรียนจากอีเมลโรงเรียน — คืน null ถ้าไม่ใช่อีเมลของโรงเรียน */
export function studentCodeFromEmail(email: string | null | undefined) {
  if (!isSchoolEmail(email)) return null;
  const code = email!.trim().toLowerCase().split("@")[0];
  return code || null;
}
