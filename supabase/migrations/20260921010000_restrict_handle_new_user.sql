-- handle_new_user() เป็นฟังก์ชันสำหรับ trigger เท่านั้น ไม่ได้ตั้งใจให้ใครเรียกตรง ๆ
-- แต่ตามค่าเริ่มต้นของ Postgres ฟังก์ชันใหม่จะเปิดให้ทุก role เรียกได้ จึงโผล่ใน
-- /rest/v1/rpc ของ Supabase ทั้งสำหรับผู้ที่ล็อกอินและยังไม่ล็อกอิน
--
-- ตัดสิทธิ์ออกทั้งหมด — trigger ยังทำงานปกติ เพราะ Postgres เรียกฟังก์ชัน trigger
-- ด้วยสิทธิ์ของระบบเอง ไม่ได้ผ่านสิทธิ์ของผู้ใช้ (ทดสอบยืนยันแล้ว)
revoke all on function public.handle_new_user() from public, anon, authenticated;
