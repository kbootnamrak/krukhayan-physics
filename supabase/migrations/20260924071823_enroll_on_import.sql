-- ============================================================================
-- ลงทะเบียนนักเรียนเข้าวิชาตั้งแต่ตอนครูนำเข้ารายชื่อ ไม่ต้องรอนักเรียนล็อกอิน
--
-- เดิม enrollments.student_id ห้ามว่าง และ student_id ต้องเป็นบัญชีที่ล็อกอินแล้ว
-- การลงทะเบียนจึงเกิดตอนนักเรียนล็อกอินครั้งแรกเท่านั้น → ครูนำเข้ารายชื่อ 65 คนแล้ว
-- ตารางกรอกคะแนนว่างเปล่า กรอกคะแนนไม่ได้จนกว่านักเรียนทุกคนจะเข้าระบบ
--
-- ตอนนี้: การลงทะเบียน 1 แถวผูกกับรายชื่อ 1 แถว (roster_id) สร้างตอนนำเข้า
-- student_id ว่างไว้ก่อน แล้วเติมให้ตอนนักเรียนล็อกอิน คะแนนที่ครูกรอกไว้จึงตามไปด้วย
-- ============================================================================

alter table public.enrollments alter column student_id drop not null;

alter table public.enrollments
  add column if not exists roster_id uuid references public.class_roster(id) on delete cascade;

-- 1 รายชื่อ = 1 การลงทะเบียน (index นี้ใช้ค้นตอนนักเรียนล็อกอินด้วย)
create unique index if not exists enrollments_roster_id_key on public.enrollments (roster_id);

-- ต้องรู้ว่าเป็นใคร: มีบัญชีแล้ว หรือมีรายชื่อที่ครูนำเข้า อย่างใดอย่างหนึ่ง
alter table public.enrollments
  add constraint enrollments_has_student check (student_id is not null or roster_id is not null);

-- ผูกการลงทะเบียนที่มีอยู่เข้ากับรายชื่อของคนนั้น
update public.enrollments e
set roster_id = r.id
from public.class_roster r
where e.roster_id is null
  and r.course_id = e.course_id
  and r.claimed_by = e.student_id;

-- สร้างการลงทะเบียนให้ทุกคนในรายชื่อที่ยังไม่มี
insert into public.enrollments (course_id, student_id, roster_id)
select r.course_id, r.claimed_by, r.id
from public.class_roster r
where not exists (select 1 from public.enrollments e where e.roster_id = r.id);

comment on column public.enrollments.student_id is 'บัญชีของนักเรียน — ว่างถ้ายังไม่เคยล็อกอิน (เติมให้ตอนล็อกอินครั้งแรก)';
comment on column public.enrollments.roster_id is 'แถวในรายชื่อที่ครูนำเข้า — ลบรายชื่อแล้วการลงทะเบียนและคะแนนหายตาม';
