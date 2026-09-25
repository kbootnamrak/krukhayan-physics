-- ============================================================================
-- บันทึกรุ่นมือถือ (Android) เพิ่ม
--
-- Chrome บน Android รุ่นใหม่ซ่อนรุ่นเครื่องใน user agent (ขึ้นแค่ "Android 10; K" ทุกเครื่อง)
-- หน้าเว็บจึงขอรุ่นผ่าน navigator.userAgentData แล้วส่งมาเอง (เช่น "SM-A546E")
-- iPhone/Safari ไม่เปิดเผยรุ่นให้เว็บ จึงยังเป็น null
-- ============================================================================

alter table public.device_events add column device_model text check (device_model is null or length(device_model) <= 80);

drop function public.log_device(text, text, uuid);

create or replace function public.log_device(p_device text, p_kind text, p_quiz uuid default null, p_model text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json;
  v_model text := nullif(left(trim(coalesce(p_model, '')), 80), '');
begin
  if v_uid is null or public.is_teacher() then
    return;
  end if;
  if p_device is null or length(p_device) not between 8 and 64 or p_kind not in ('visit', 'quiz') then
    return;
  end if;

  -- แถวเดิมของเครื่องนี้ที่ยังไม่มีรุ่น (บันทึกก่อนมีคอลัมน์นี้) — เติมรุ่นให้
  if v_model is not null then
    update public.device_events
    set device_model = v_model
    where user_id = v_uid and device_id = p_device and device_model is null;
  end if;

  -- เข้าเว็บ: บันทึกไม่เกินชั่วโมงละครั้งต่อเครื่อง · แบบทดสอบ: ครั้งเดียวต่อชุดต่อเครื่อง
  if exists (
    select 1 from public.device_events
    where user_id = v_uid and device_id = p_device and kind = p_kind
      and (
        (p_kind = 'visit' and at > now() - interval '1 hour')
        or (p_kind = 'quiz' and quiz_id is not distinct from p_quiz)
      )
  ) then
    return;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;

  insert into public.device_events (user_id, device_id, user_agent, ip, kind, quiz_id, device_model)
  values (
    v_uid,
    p_device,
    left(v_headers ->> 'user-agent', 400),
    left(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), 64),
    p_kind,
    case when p_kind = 'quiz' then p_quiz end,
    v_model
  );
end;
$$;

revoke execute on function public.log_device(text, text, uuid, text) from public, anon;
grant execute on function public.log_device(text, text, uuid, text) to authenticated;
