import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ไคลเอนต์ที่ใช้ service role — ข้าม RLS ทั้งหมด
 * ใช้ได้เฉพาะใน route handler ฝั่งเซิร์ฟเวอร์เท่านั้น ห้าม import เข้า client component
 */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
