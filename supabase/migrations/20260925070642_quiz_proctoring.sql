-- ============================================================================
-- แบบทดสอบ: นับการออกจากหน้าข้อสอบ + ส่งอัตโนมัติเมื่อออกครบกำหนด
--
-- เว็บห้ามนักเรียนสลับแอป/แท็บหรือแคปหน้าจอไม่ได้ แต่ตรวจได้ว่าออกจากหน้าไป
-- หน้าเว็บรายงานทุกครั้งที่กลับมา (และทุกครั้งที่เปิดหน้าข้อสอบซ้ำระหว่างทำ)
-- ฐานข้อมูลเป็นคนนับและตัดสินส่งอัตโนมัติเอง แก้ตัวเลขฝั่งเบราว์เซอร์ไม่ได้
--
-- quizzes.max_leaves: ออกได้กี่ครั้งก่อนถูกส่งอัตโนมัติ (0 = ไม่จำกัด แค่บันทึก)
-- quiz_attempts.submit_reason: student = กดส่งเอง · time_up = หมดเวลา · left_page = ออกจากหน้าครบกำหนด
--
-- แก้ของเดิมด้วย: quiz_start เคยบันทึกการส่ง (หมดเวลา) แล้ว raise exception ต่อ
-- ซึ่งทำให้ PostgreSQL ย้อนการบันทึกนั้นทิ้ง ตอนนี้คืนสถานะเป็น jsonb แทน:
--   {"status": "active", ...โจทย์}  หรือ  {"status": "submitted", "reason": ..., "score": ..., "max_score": ...}
-- ============================================================================

alter table public.quizzes
  add column max_leaves integer not null default 3 check (max_leaves between 0 and 20);

alter table public.quiz_attempts
  add column leave_count integer not null default 0,
  -- [{"at": เวลา, "away": วินาที, "kind": "switch" | "reopen"}]
  add column leave_log jsonb not null default '[]'::jsonb,
  add column submit_reason text check (submit_reason in ('student', 'time_up', 'left_page'));

-- โจทย์ + ข้อมูลที่หน้าทำข้อสอบต้องใช้ (ชื่อ/รหัสสำหรับลายน้ำ, จำนวนครั้งที่ออกไปแล้ว)
create or replace function public.quiz_payload(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', 'active',
    'attempt_id', a.id,
    'title', z.title,
    'deadline_at', a.deadline_at,
    'server_now', now(),
    'answers', a.answers,
    'leave_count', a.leave_count,
    'max_leaves', z.max_leaves,
    'student', jsonb_build_object('name', r.full_name, 'code', r.student_code),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'prompt', q.prompt,
          'image', q.image,
          'choices', (
            select jsonb_agg(jsonb_build_object('k', p.k::integer, 'text', q.choices[p.k::integer + 1]) order by p.ord)
            from jsonb_array_elements_text(l.item -> 'p') with ordinality as p(k, ord)
          )
        ) order by l.ord
      )
      from jsonb_array_elements(a.layout) with ordinality as l(item, ord)
      join public.quiz_questions q on q.id = (l.item ->> 'q')::uuid
    ), '[]'::jsonb)
  )
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  join public.enrollments e on e.id = a.enrollment_id
  left join public.class_roster r on r.id = e.roster_id
  where a.id = p_attempt;
$$;
revoke execute on function public.quiz_payload(uuid) from public, anon, authenticated;

-- บันทึกการออกจากหน้า 1 ครั้ง แล้วส่งอัตโนมัติถ้าครบกำหนด (ใช้ภายใน)
create or replace function public.quiz_record_leave(p_attempt uuid, p_away integer, p_kind text)
returns public.quiz_attempts
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts;
  v_max integer;
begin
  update public.quiz_attempts
  set leave_count = leave_count + 1,
      leave_log = leave_log || jsonb_build_array(jsonb_build_object('at', now(), 'away', greatest(0, coalesce(p_away, 0)), 'kind', p_kind))
  where id = p_attempt and submitted_at is null
  returning * into v_attempt;

  select max_leaves into v_max from public.quizzes where id = v_attempt.quiz_id;
  if v_max > 0 and v_attempt.leave_count >= v_max then
    update public.quiz_attempts
    set submitted_at = least(now(), deadline_at + interval '30 seconds'),
        score = public.quiz_grade(id),
        submit_reason = 'left_page'
    where id = p_attempt
    returning * into v_attempt;
  end if;
  return v_attempt;
end;
$$;
revoke execute on function public.quiz_record_leave(uuid, integer, text) from public, anon, authenticated;

-- หน้าเว็บรายงานว่านักเรียนเพิ่งกลับมาจากการออกไป p_away วินาที
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
    'score', v_attempt.score,
    'max_score', v_attempt.max_score
  );
end;
$$;

-- ผลของการทำที่ส่งแล้ว (คืนให้หน้าเว็บแสดงคะแนน)
create or replace function public.quiz_result(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('status', 'submitted', 'reason', submit_reason, 'score', score, 'max_score', max_score)
  from public.quiz_attempts where id = p_attempt;
$$;
revoke execute on function public.quiz_result(uuid) from public, anon, authenticated;

-- เริ่ม/ทำต่อ: เปิดหน้าข้อสอบซ้ำระหว่างทำ (รีเฟรช ปิดแล้วเปิดใหม่) นับเป็นการออกจากหน้า 1 ครั้ง
create or replace function public.quiz_start(p_quiz uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_quiz public.quizzes;
  v_enrollment uuid;
  v_classroom text;
  v_attempt public.quiz_attempts;
  v_layout jsonb;
  v_count integer;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  if not found then
    raise exception 'quiz_not_found';
  end if;

  select e.id, r.classroom into v_enrollment, v_classroom
  from public.enrollments e
  left join public.class_roster r on r.id = e.roster_id
  where e.course_id = v_quiz.course_id and e.student_id = auth.uid()
  limit 1;
  if v_enrollment is null then
    raise exception 'not_enrolled';
  end if;

  select * into v_attempt from public.quiz_attempts where quiz_id = p_quiz and enrollment_id = v_enrollment;
  if found then
    if v_attempt.submitted_at is null and now() > v_attempt.deadline_at then
      -- หมดเวลาแล้วแต่ยังไม่ได้ส่ง (เช่นปิดเบราว์เซอร์) ตรวจจากคำตอบที่บันทึกไว้
      update public.quiz_attempts
      set submitted_at = deadline_at, score = public.quiz_grade(id), submit_reason = 'time_up'
      where id = v_attempt.id
      returning * into v_attempt;
    elsif v_attempt.submitted_at is null then
      v_attempt := public.quiz_record_leave(v_attempt.id, null, 'reopen');
    end if;
    if v_attempt.submitted_at is not null then
      return public.quiz_result(v_attempt.id);
    end if;
    return public.quiz_payload(v_attempt.id);
  end if;

  if not exists (
    select 1 from public.quiz_sessions s
    where s.quiz_id = p_quiz and s.closed_at is null and s.classroom = v_classroom
  ) then
    raise exception 'not_open';
  end if;

  select count(*) into v_count from public.quiz_questions where quiz_id = p_quiz;
  if v_count = 0 then
    raise exception 'no_questions';
  end if;

  select jsonb_agg(item order by ord) into v_layout
  from (
    select
      jsonb_build_object(
        'q', q.id,
        'p', (
          select jsonb_agg(i order by case when v_quiz.shuffle then random() else i end)
          from generate_series(0, cardinality(q.choices) - 1) as i
        )
      ) as item,
      case when v_quiz.shuffle then random() else q.position end as ord
    from public.quiz_questions q
    where q.quiz_id = p_quiz
  ) t;

  insert into public.quiz_attempts (quiz_id, enrollment_id, deadline_at, layout, max_score)
  values (p_quiz, v_enrollment, now() + make_interval(mins => v_quiz.time_limit_minutes), v_layout, v_count)
  returning * into v_attempt;

  return public.quiz_payload(v_attempt.id);
end;
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
    where id = p_attempt
    returning * into v_attempt;
  end if;

  return jsonb_build_object('score', v_attempt.score, 'max_score', v_attempt.max_score, 'reason', v_attempt.submit_reason);
end;
$$;

create or replace function public.quiz_regrade(p_quiz uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_teacher() then
    raise exception 'teacher_only';
  end if;

  update public.quiz_attempts
  set submit_reason = case when submitted_at is null and now() > deadline_at then 'time_up' else submit_reason end,
      submitted_at = coalesce(submitted_at, case when now() > deadline_at then deadline_at end),
      score = case
        when submitted_at is not null or now() > deadline_at then public.quiz_grade(id)
        else score
      end
  where quiz_id = p_quiz;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.quiz_log_leave(uuid, integer) from public, anon;
grant execute on function public.quiz_log_leave(uuid, integer) to authenticated;
