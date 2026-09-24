-- iot_is_teacher() ถูก RLS policy เรียกใช้ จึงต้องให้สิทธิ์ authenticated ต่อไป
-- แต่ anon ไม่มี policy ไหนใช้เลย จึงตัดสิทธิ์ออกเพื่อไม่ให้เรียกผ่าน /rest/v1/rpc ได้
revoke all on function public.iot_is_teacher() from public, anon;
grant execute on function public.iot_is_teacher() to authenticated;
