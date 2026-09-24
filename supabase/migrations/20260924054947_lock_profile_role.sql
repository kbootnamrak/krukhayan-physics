-- ============================================================================
-- ปิดช่องที่นักเรียนเปลี่ยนตัวเองเป็นครูได้
--
-- เดิม policy profiles_update_own อนุญาตให้ผู้ใช้แก้แถวของตัวเองได้ "ทุกคอลัมน์"
-- (ไม่มี with check และสิทธิ์ระดับตารางเปิดไว้ทั้งหมด) นักเรียนจึงพิมพ์คำสั่งเดียว
-- ใน Console ของเบราว์เซอร์ก็ตั้ง role = 'teacher' ให้ตัวเองได้ แล้วแก้คะแนนใครก็ได้
-- ช่องเดียวกันยังทำให้แก้ student_code เป็นรหัสของเพื่อนเพื่อแย่งที่ในรายวิชาได้ด้วย
--
-- หน้าเว็บไม่เคยแก้ profiles จากฝั่งเบราว์เซอร์เลย ทุกจุดที่เขียน profiles ทำผ่าน
--   - trigger handle_new_user() (security definer) ตอนสมัคร
--   - service role ใน /auth/callback และ /api/students/import
-- จึงตัดสิทธิ์เขียนของ anon / authenticated ออกทั้งหมดได้โดยไม่กระทบการทำงาน
-- การตั้งใครเป็นครูยังทำได้ตามเดิมจาก SQL Editor ของ Supabase
-- ============================================================================

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

-- ตัดที่ระดับสิทธิ์ของตารางด้วย ไม่พึ่ง RLS อย่างเดียว
-- ถ้าวันหน้ามีคนเพิ่ม policy update กลับมาโดยไม่ระวัง ก็ยังแก้ role ไม่ได้อยู่ดี
revoke insert, update, delete on public.profiles from anon, authenticated;
