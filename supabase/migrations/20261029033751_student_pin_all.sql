-- ============================================================================
-- PIN สำหรับนักเรียนทุกคน (ไม่ใช่เฉพาะคนที่เข้าอีเมลโรงเรียนไม่ได้)
--
-- * นักเรียนที่เข้าด้วย Google แล้ว: PIN = รหัสผ่านของบัญชี Google เดิม (อีเมล <รหัส>@โรงเรียน)
--   ทำเครื่องหมาย app_metadata.pin = "on" ให้รู้ว่ามี PIN
-- * นักเรียนที่ยังไม่เคยเข้า: บัญชี PIN แบบเดิม (<รหัส>@pin.krukhayan.invalid)
-- * student_pin_status(): ครูดูว่าใครมี PIN แล้ว (เรียกจากเซิร์ฟเวอร์ด้วย service role เท่านั้น)
-- * student_pin_transfer(): บัญชี PIN ที่ภายหลังเข้าด้วย Google ได้ → ย้าย PIN ไปบัญชี Google
--   นักเรียนใช้ PIN เดิมต่อได้ ไม่ต้องขอใหม่
-- ============================================================================

create or replace function public.student_pin_status(p_course uuid)
returns table (roster_id uuid, account text, has_pin boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    r.id,
    case
      when u.id is null then null
      when u.email like '%@pin.krukhayan.invalid' then 'pin'
      else 'google'
    end,
    coalesce(u.email like '%@pin.krukhayan.invalid' or u.raw_app_meta_data ->> 'pin' = 'on', false)
  from public.class_roster r
  left join auth.users u on u.id = r.claimed_by
  where r.course_id = p_course;
$$;
revoke execute on function public.student_pin_status(uuid) from public, anon, authenticated;
grant execute on function public.student_pin_status(uuid) to service_role;

create or replace function public.student_pin_transfer(p_from uuid, p_to uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
begin
  update auth.users t
  set encrypted_password = f.encrypted_password,
      raw_app_meta_data = coalesce(t.raw_app_meta_data, '{}'::jsonb) || '{"pin": "on"}'::jsonb,
      updated_at = now()
  from auth.users f
  where f.id = p_from
    and t.id = p_to
    and coalesce(f.encrypted_password, '') <> '';
  return found;
end;
$$;
revoke execute on function public.student_pin_transfer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.student_pin_transfer(uuid, uuid) to service_role;
