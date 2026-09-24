-- ============================================================================
-- แก้ is_teacher() เรียกตัวเองไม่รู้จบ
--
-- อาการ: นักเรียนเปิดหน้าเว็บแล้วฐานข้อมูลตอบกลับมาว่า
--        "stack depth limit exceeded" ทำให้หน้าเว็บโหลดไม่ขึ้น
--
-- สาเหตุ: is_teacher() ถูกสร้างเป็น SECURITY INVOKER จึงทำงานด้วยสิทธิ์ของผู้เรียก
--        และถูก RLS ของตาราง profiles บังคับใช้ด้วย แต่ตัวนโยบายของ profiles เอง
--        ก็เรียก is_teacher() ทำให้วนกลับมาหาตัวเองไม่รู้จบ
--
--          นโยบาย profiles: (id = auth.uid()) OR is_teacher()
--                              → is_teacher() อ่าน profiles
--                                  → นโยบายทำงานอีก → is_teacher() → ...
--
-- ทำไมเพิ่งเจอตอนนี้: Postgres ลัดวงจร OR — ถ้าแถวที่อ่านเป็นของผู้เรียกเอง
--        เงื่อนไขแรกเป็นจริงแล้วจบ ไม่ต้องเรียก is_teacher() ระบบจึงใช้งานได้
--        ตลอดมาเพราะมีผู้ใช้อยู่คนเดียว ปัญหาโผล่เมื่อเริ่มมีข้อมูลของคนอื่น
--        ซึ่งก็คือวันที่นักเรียนคนแรกเข้าสู่ระบบ
--
-- วิธีแก้: เปลี่ยนเป็น SECURITY DEFINER ให้ทำงานด้วยสิทธิ์เจ้าของ จึงไม่ย้อนกลับ
--        ไปชนนโยบายของตัวเอง เป็นรูปแบบเดียวกับ iot_is_teacher() ที่ใช้อยู่แล้ว
--        และแก้คำเตือน function_search_path_mutable ของ security advisor ไปพร้อมกัน
--
-- ฟังก์ชันนี้คืนค่าเพียงจริง/เท็จว่า "ผู้เรียกเป็นครูหรือไม่" ซึ่งผู้เรียกรู้อยู่แล้ว
-- การให้สิทธิ์เจ้าของจึงไม่เปิดเผยข้อมูลของผู้อื่นเพิ่ม
-- ============================================================================

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- นโยบาย RLS เรียกใช้ฟังก์ชันนี้ authenticated จึงต้องมีสิทธิ์เรียกต่อไป
-- ส่วน anon ไม่มีนโยบายไหนใช้ ตัดออกไม่ให้เรียกผ่าน /rest/v1/rpc ได้
revoke all on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;
