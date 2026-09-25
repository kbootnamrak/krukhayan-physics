-- ============================================================================
-- บันทึกเครื่องที่นักเรียนใช้เข้าเว็บ/ทำแบบทดสอบ — ช่วยครูสังเกตการล็อกอินทำแทนเพื่อน
--
-- device_id: รหัสสุ่มที่เบราว์เซอร์สร้างเก็บไว้ในเครื่องตอนเข้าเว็บครั้งแรก
--   ถ้ารหัสเดียวกันโผล่ในบัญชีนักเรียนหลายคน = เครื่องเดียวกันถูกใช้หลายบัญชี
--   (ล้างข้อมูลเบราว์เซอร์/โหมดไม่ระบุตัวตนแล้วจะได้รหัสใหม่ — เป็นสัญญาณ ไม่ใช่หลักฐาน)
-- user_agent / ip: อ่านจาก header ของคำขอฝั่งเซิร์ฟเวอร์ นักเรียนกรอกเองไม่ได้
--
-- ครูอ่านได้อย่างเดียว · นักเรียนบันทึกได้ผ่าน log_device() ของตัวเองเท่านั้น (อ่านไม่ได้)
-- ============================================================================

create table public.device_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null check (length(device_id) between 8 and 64),
  user_agent text,
  ip text,
  kind text not null check (kind in ('visit', 'quiz')),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  at timestamptz not null default now()
);
create index device_events_user_idx on public.device_events (user_id, at desc);
create index device_events_device_idx on public.device_events (device_id);
create index device_events_quiz_idx on public.device_events (quiz_id) where quiz_id is not null;

alter table public.device_events enable row level security;
create policy "device_events_teacher_read" on public.device_events for select using (public.is_teacher());

create or replace function public.log_device(p_device text, p_kind text, p_quiz uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json;
begin
  if v_uid is null or public.is_teacher() then
    return;
  end if;
  if p_device is null or length(p_device) not between 8 and 64 or p_kind not in ('visit', 'quiz') then
    return;
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

  insert into public.device_events (user_id, device_id, user_agent, ip, kind, quiz_id)
  values (
    v_uid,
    p_device,
    left(v_headers ->> 'user-agent', 400),
    left(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), 64),
    p_kind,
    case when p_kind = 'quiz' then p_quiz end
  );
end;
$$;

revoke execute on function public.log_device(text, text, uuid) from public, anon;
grant execute on function public.log_device(text, text, uuid) to authenticated;
