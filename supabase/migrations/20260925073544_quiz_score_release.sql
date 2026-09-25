-- ============================================================================
-- แบบทดสอบ: ครูตรวจคะแนนก่อน แล้วค่อยประกาศให้นักเรียนเห็น
--
-- quizzes.scores_released: false = นักเรียนเห็นแค่ว่า "ส่งแล้ว" ยังไม่เห็นคะแนน
--
-- ต้องซ่อนที่ฐานข้อมูล ไม่ใช่แค่ซ่อนบนหน้าจอ: เดิมนักเรียนอ่านแถวใน quiz_attempts
-- ของตัวเองได้ตรง ๆ (รวมคอลัมน์ score) — ตอนนี้อ่านตารางนี้ได้เฉพาะครู
-- นักเรียนอ่านสถานะของตัวเองผ่าน quiz_my_attempts() ซึ่งคืนคะแนนเฉพาะเมื่อประกาศแล้ว
-- ฟังก์ชันที่เคยคืนคะแนน (quiz_start/quiz_submit/quiz_log_leave) ก็ปิดคะแนนแบบเดียวกัน
-- ============================================================================

alter table public.quizzes
  add column scores_released boolean not null default false;

drop policy "quiz_attempts_select_own_or_teacher" on public.quiz_attempts;
-- สิทธิ์ของครู (อ่าน/เขียนทั้งหมด) มาจาก quiz_attempts_write_teacher ที่มีอยู่แล้ว

-- คะแนนที่นักเรียนเห็นได้: มีค่าเฉพาะเมื่อส่งแล้วและครูประกาศแล้ว
create or replace function public.quiz_visible_score(p_attempt uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when z.scores_released then a.score end
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;
$$;
revoke execute on function public.quiz_visible_score(uuid) from public, anon, authenticated;

create or replace function public.quiz_result(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', 'submitted',
    'reason', a.submit_reason,
    'released', z.scores_released,
    'score', case when z.scores_released then a.score end,
    'max_score', a.max_score
  )
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;
$$;
revoke execute on function public.quiz_result(uuid) from public, anon, authenticated;

-- สถานะการทำแบบทดสอบทุกชุดของนักเรียนคนนี้ในวิชาหนึ่ง (ใช้แทนการอ่านตารางตรง ๆ)
create or replace function public.quiz_my_attempts(p_course uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'quiz_id', a.quiz_id,
    'enrollment_id', a.enrollment_id,
    'started_at', a.started_at,
    'deadline_at', a.deadline_at,
    'submitted_at', a.submitted_at,
    'submit_reason', a.submit_reason,
    'released', z.scores_released,
    'score', case when z.scores_released then a.score end,
    'max_score', a.max_score
  )), '[]'::jsonb)
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  join public.enrollments e on e.id = a.enrollment_id
  where z.course_id = p_course and e.student_id = auth.uid();
$$;

create or replace function public.quiz_submit(p_attempt uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts;
begin
  select a.* into v_attempt
  from public.quiz_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt and e.student_id = auth.uid();
  if not found then
    raise exception 'attempt_not_found';
  end if;

  if v_attempt.submitted_at is null then
    update public.quiz_attempts
    set submitted_at = least(now(), deadline_at + interval '30 seconds'),
        score = public.quiz_grade(id),
        submit_reason = case when now() > deadline_at then 'time_up' else 'student' end
    where id = p_attempt;
  end if;

  return public.quiz_result(p_attempt);
end;
$$;

create or replace function public.quiz_log_leave(p_attempt uuid, p_away integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts;
  v_max integer;
begin
  select a.* into v_attempt
  from public.quiz_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt and e.student_id = auth.uid();
  if not found then
    raise exception 'attempt_not_found';
  end if;

  if v_attempt.submitted_at is null and now() <= v_attempt.deadline_at + interval '30 seconds' then
    v_attempt := public.quiz_record_leave(p_attempt, p_away, 'switch');
  end if;
  select max_leaves into v_max from public.quizzes where id = v_attempt.quiz_id;

  return jsonb_build_object(
    'leave_count', v_attempt.leave_count,
    'max_leaves', v_max,
    'submitted', v_attempt.submitted_at is not null,
    'released', (select scores_released from public.quizzes where id = v_attempt.quiz_id),
    'score', public.quiz_visible_score(p_attempt),
    'max_score', v_attempt.max_score
  );
end;
$$;

revoke execute on function public.quiz_my_attempts(uuid) from public, anon;
grant execute on function public.quiz_my_attempts(uuid) to authenticated;
