-- ============================================================================
-- กฎความถูกต้องของคะแนน — ให้ฐานข้อมูลเป็นด่านสุดท้าย ไม่พึ่งหน้าเว็บอย่างเดียว
--
-- เดิมไม่มีกฎอะไรเลย: กรอก 50 ในช่องที่เต็ม 10 ได้ กรอกติดลบได้
-- และ source_id ชี้ไปที่ไหนก็ได้ (แม้แต่รายการของวิชาอื่น) เพราะไม่มี foreign key
-- ============================================================================

-- คะแนนเต็มต้องมากกว่า 0
alter table public.unit_components
  add constraint unit_components_max_positive check (max_score > 0);
alter table public.exams
  add constraint exams_max_positive check (max_score > 0);

-- ---------------------------------------------------------------------------
-- ตรวจคะแนนทุกครั้งที่บันทึก
--   - รายการคะแนนต้องมีอยู่จริง และเป็นของวิชาเดียวกับที่นักเรียนลงทะเบียน
--   - 0 ≤ คะแนน ≤ คะแนนเต็ม (null = ยังไม่ได้กรอก ยอมให้ผ่าน)
--   - อัปเดต updated_at ให้ด้วย (เดิมค่านี้ไม่เคยเปลี่ยนหลังบันทึกครั้งแรก)
-- ข้อความ error เป็นภาษาไทย เพราะหน้าเว็บแสดงให้ครูเห็นตรง ๆ
-- ---------------------------------------------------------------------------
create or replace function public.check_student_score()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_allowed numeric;
  source_course uuid;
  enrollment_course uuid;
begin
  if new.source_type = 'unit_component' then
    select c.max_score, u.course_id into max_allowed, source_course
    from unit_components c join course_units u on u.id = c.unit_id
    where c.id = new.source_id;
  else
    select e.max_score, e.course_id into max_allowed, source_course
    from exams e
    where e.id = new.source_id;
  end if;

  if not found then
    raise exception using errcode = '23503',
      message = 'ไม่พบรายการคะแนนนี้ อาจถูกลบไปแล้ว — รีเฟรชหน้าแล้วลองใหม่';
  end if;

  select course_id into enrollment_course from enrollments where id = new.enrollment_id;
  if enrollment_course is distinct from source_course then
    raise exception using errcode = '23514',
      message = 'รายการคะแนนนี้ไม่ได้อยู่ในวิชาเดียวกับนักเรียน';
  end if;

  if new.score is not null and new.score < 0 then
    raise exception using errcode = '23514', message = 'คะแนนติดลบไม่ได้';
  end if;

  if new.score is not null and new.score > max_allowed then
    raise exception using errcode = '23514',
      message = format('คะแนน %s เกินคะแนนเต็ม %s', new.score, max_allowed);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger student_scores_check
  before insert or update on public.student_scores
  for each row execute function public.check_student_score();

-- ---------------------------------------------------------------------------
-- ห้ามลดคะแนนเต็มจนต่ำกว่าคะแนนที่นักเรียนได้ไปแล้ว
-- ไม่งั้นจะมีนักเรียนได้ 12 จากเต็ม 10 ค้างอยู่ในระบบ
-- ---------------------------------------------------------------------------
create or replace function public.check_max_not_below_scores()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  highest numeric;
begin
  select max(score) into highest
  from student_scores
  where source_type = tg_argv[0] and source_id = new.id;

  if highest is not null and new.max_score < highest then
    raise exception using errcode = '23514',
      message = format('ลดคะแนนเต็มเหลือ %s ไม่ได้ เพราะมีนักเรียนได้ %s ไปแล้ว', new.max_score, highest);
  end if;
  return new;
end;
$$;

create trigger unit_components_check_max
  before update of max_score on public.unit_components
  for each row execute function public.check_max_not_below_scores('unit_component');

create trigger exams_check_max
  before update of max_score on public.exams
  for each row execute function public.check_max_not_below_scores('exam');

-- ---------------------------------------------------------------------------
-- ลบรายการคะแนนแล้ว ลบคะแนนของรายการนั้นตามไปด้วย
-- source_id ไม่มี foreign key (ชี้ได้สองตาราง) จึง cascade เองไม่ได้
-- หน้าเว็บจะถามก่อนเสมอถ้ามีคะแนนอยู่แล้ว ส่วนนี้กันไม่ให้เหลือคะแนนกำพร้า
-- ---------------------------------------------------------------------------
create or replace function public.delete_scores_of_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from student_scores where source_type = tg_argv[0] and source_id = old.id;
  return old;
end;
$$;

create trigger unit_components_delete_scores
  after delete on public.unit_components
  for each row execute function public.delete_scores_of_source('unit_component');

create trigger exams_delete_scores
  after delete on public.exams
  for each row execute function public.delete_scores_of_source('exam');
