-- ============================================================================
-- เข้าสู่ระบบด้วยบัญชี Google ของโรงเรียน + รายชื่อรอเข้าเรียน
--
-- เดิมระบบนำเข้า Excel ต้องสร้างบัญชีให้นักเรียนก่อน โดยตั้งอีเมลปลอมและสุ่ม
-- รหัสผ่านที่ไม่มีใครได้เห็น นักเรียนจึงล็อกอินไม่ได้เลย
--
-- โครงสร้างใหม่: นำเข้ารายชื่อไว้ก่อนโดยยังไม่สร้างบัญชี แล้วจับคู่อัตโนมัติ
-- ตอนนักเรียนล็อกอินด้วย Google ครั้งแรก (อีเมลตั้งตามรหัสนักเรียน)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- รายชื่อนักเรียนที่ครูนำเข้าไว้ ยังไม่ผูกกับบัญชีจนกว่าจะล็อกอินครั้งแรก
-- ---------------------------------------------------------------------------
create table if not exists public.class_roster (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  student_code text not null,
  full_name    text not null,
  claimed_by   uuid references public.profiles(id) on delete set null,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint class_roster_unique unique (course_id, student_code)
);

comment on table public.class_roster is
  'รายชื่อนักเรียนต่อวิชา นำเข้าจาก Excel — claimed_by จะถูกเติมตอนนักเรียนล็อกอินครั้งแรก';

create index if not exists class_roster_code_idx on public.class_roster (student_code);

alter table public.class_roster enable row level security;

-- ครูจัดการได้ทั้งหมด (ใช้ฟังก์ชันเดิมของระบบ IoT ซึ่งเช็ก role ของผู้เรียก)
drop policy if exists class_roster_teacher on public.class_roster;
create policy class_roster_teacher on public.class_roster
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

-- นักเรียนอ่านได้เฉพาะแถวของตัวเอง (ไว้แสดงว่าถูกจับคู่แล้ว)
drop policy if exists class_roster_own on public.class_roster;
create policy class_roster_own on public.class_roster
  for select to authenticated using (claimed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- สร้างโปรไฟล์อัตโนมัติเมื่อมีบัญชีใหม่
--
-- ทำที่ระดับฐานข้อมูลเพื่อให้มั่นใจว่าทุกบัญชีมีโปรไฟล์เสมอ ไม่ว่าจะสมัคร
-- เข้ามาทางไหน — การจับคู่กับรายชื่อและการลงทะเบียนเรียนทำต่อในฝั่งแอป
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'ไม่ทราบชื่อ'), '@', 1)
    ),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
