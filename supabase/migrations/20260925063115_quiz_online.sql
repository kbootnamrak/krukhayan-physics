-- ============================================================================
-- แบบทดสอบออนไลน์ประจำบท
--
-- ครูสร้างแบบทดสอบปรนัยในวิชา (ผูกกับหน่วยการเรียนได้) แล้วเปิดให้ทีละห้อง
-- นักเรียนทำบนเว็บได้ครั้งเดียว มีเวลาจำกัด ลำดับข้อและตัวเลือกสลับต่อคน
-- ระบบตรวจให้ทันที นักเรียนเห็นแค่คะแนน — คะแนนยังไม่เข้าช่อง K (ครูดูผลดิบก่อน)
--
-- ความปลอดภัย:
-- * โจทย์ (quiz_questions) อ่านได้เฉพาะครู นักเรียนได้โจทย์ผ่าน quiz_start() เท่านั้น
--   → เปิดดูข้อสอบล่วงหน้าก่อนครูเปิดสอบไม่ได้
-- * เฉลยแยกตาราง (quiz_answer_keys) ครูเท่านั้น — ไม่มีทางไหนที่นักเรียนอ่านได้
-- * การเริ่มทำ บันทึกคำตอบ และส่ง ทำผ่านฟังก์ชันฝั่งฐานข้อมูลเท่านั้น
--   ฟังก์ชันตรวจเวลาเอง นาฬิกาในเครื่องนักเรียนโกงเวลาไม่ได้
-- ============================================================================

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  unit_id uuid references public.course_units(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  time_limit_minutes integer not null default 30 check (time_limit_minutes between 1 and 300),
  shuffle boolean not null default true,
  created_at timestamptz not null default now()
);
create index quizzes_course_id_idx on public.quizzes (course_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null default 0,
  prompt text not null default '',
  -- รูปประกอบโจทย์ เก็บเป็น data URI (ย่อขนาดในเบราว์เซอร์ก่อนบันทึก) ไม่ต้องตั้งที่เก็บไฟล์แยก
  image text check (image is null or length(image) <= 700000),
  choices text[] not null default array['', '', '', '']::text[]
    check (cardinality(choices) between 2 and 6)
);
create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_index smallint not null check (correct_index between 0 and 5)
);

-- ครูเปิดสอบทีละห้อง: 1 แถว = 1 ครั้งที่เปิด ปิดแล้วใส่ closed_at
create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  classroom text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
-- ห้องหนึ่งเปิดซ้อนได้ครั้งเดียว
create unique index quiz_sessions_one_open on public.quiz_sessions (quiz_id, classroom) where closed_at is null;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  -- ลำดับข้อและตัวเลือกของคนนี้: [{"q": question_id, "p": [2,0,3,1]}, ...]
  layout jsonb not null,
  -- คำตอบ: {"<question_id>": ดัชนีตัวเลือกเดิม (ก่อนสลับ)}
  answers jsonb not null default '{}'::jsonb,
  score integer,
  max_score integer not null,
  unique (quiz_id, enrollment_id)
);
create index quiz_attempts_quiz_id_idx on public.quiz_attempts (quiz_id);

comment on table public.quiz_attempts is 'การทำแบบทดสอบ คนละ 1 ครั้งต่อแบบทดสอบ — ครูลบแถวเพื่อให้ทำใหม่ได้';

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "quizzes_read_all" on public.quizzes for select using (auth.uid() is not null);
create policy "quizzes_write_teacher" on public.quizzes for all using (public.is_teacher()) with check (public.is_teacher());

create policy "quiz_questions_teacher" on public.quiz_questions for all using (public.is_teacher()) with check (public.is_teacher());
create policy "quiz_answer_keys_teacher" on public.quiz_answer_keys for all using (public.is_teacher()) with check (public.is_teacher());

create policy "quiz_sessions_read_all" on public.quiz_sessions for select using (auth.uid() is not null);
create policy "quiz_sessions_write_teacher" on public.quiz_sessions for all using (public.is_teacher()) with check (public.is_teacher());

-- นักเรียนเห็นเฉพาะการทำของตัวเอง (ไว้แสดงคะแนน) เขียนเองไม่ได้ ต้องผ่านฟังก์ชัน
create policy "quiz_attempts_select_own_or_teacher" on public.quiz_attempts for select using (
  public.is_teacher()
  or exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid())
);
create policy "quiz_attempts_write_teacher" on public.quiz_attempts for all using (public.is_teacher()) with check (public.is_teacher());

-- ----------------------------------------------------------------------------
-- ตรวจคะแนนของการทำหนึ่งครั้ง (ใช้ภายในเท่านั้น)
-- ----------------------------------------------------------------------------
create or replace function public.quiz_grade(p_attempt uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.quiz_attempts a
  cross join lateral jsonb_each_text(a.answers) ans(qid, choice)
  join public.quiz_answer_keys k on k.question_id = ans.qid::uuid
  where a.id = p_attempt and k.correct_index = ans.choice::integer;
$$;
revoke execute on function public.quiz_grade(uuid) from public, anon, authenticated;

-- ส่งโจทย์ของการทำครั้งนี้ตามลำดับที่สลับไว้ (ไม่มีเฉลย)
create or replace function public.quiz_payload(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'title', z.title,
    'deadline_at', a.deadline_at,
    'server_now', now(),
    'answers', a.answers,
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
  where a.id = p_attempt;
$$;
revoke execute on function public.quiz_payload(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- นักเรียนเริ่มทำ (หรือกลับมาทำต่อถ้ายังไม่หมดเวลา)
-- ----------------------------------------------------------------------------
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
    if v_attempt.submitted_at is not null then
      raise exception 'already_submitted';
    end if;
    if now() > v_attempt.deadline_at then
      -- หมดเวลาแล้วแต่ยังไม่ได้ส่ง (เช่นปิดเบราว์เซอร์) ตรวจจากคำตอบที่บันทึกไว้
      update public.quiz_attempts
      set submitted_at = deadline_at, score = public.quiz_grade(id)
      where id = v_attempt.id;
      raise exception 'time_up';
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

-- บันทึกคำตอบทีละข้อทันทีที่เลือก (เน็ตหลุดกลางทางก็ไม่เสียคำตอบ)
-- เผื่อ 30 วินาทีหลังหมดเวลาสำหรับคำขอที่ส่งมาช้า
create or replace function public.quiz_save_answer(p_attempt uuid, p_question uuid, p_choice integer)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts;
  v_choices integer;
begin
  select a.* into v_attempt
  from public.quiz_attempts a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_attempt and e.student_id = auth.uid();
  if not found then
    raise exception 'attempt_not_found';
  end if;
  if v_attempt.submitted_at is not null then
    raise exception 'already_submitted';
  end if;
  if now() > v_attempt.deadline_at + interval '30 seconds' then
    raise exception 'time_up';
  end if;

  select cardinality(q.choices) into v_choices
  from public.quiz_questions q
  where q.id = p_question
    and exists (select 1 from jsonb_array_elements(v_attempt.layout) l where (l ->> 'q')::uuid = p_question);
  if v_choices is null then
    raise exception 'question_not_in_quiz';
  end if;
  if p_choice is not null and (p_choice < 0 or p_choice >= v_choices) then
    raise exception 'bad_choice';
  end if;

  update public.quiz_attempts
  set answers = case
    when p_choice is null then answers - p_question::text
    else answers || jsonb_build_object(p_question::text, p_choice)
  end
  where id = p_attempt;
end;
$$;

-- ส่งคำตอบ (หรือหมดเวลา) → ตรวจทันที คืนคะแนน
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
        score = public.quiz_grade(id)
    where id = p_attempt
    returning * into v_attempt;
  end if;

  return jsonb_build_object('score', v_attempt.score, 'max_score', v_attempt.max_score);
end;
$$;

-- ครู: ตรวจการทำที่หมดเวลาแล้วแต่นักเรียนไม่ได้กดส่ง (เช่นปิดเบราว์เซอร์ไประหว่างสอบ)
-- และตรวจใหม่ทั้งหมดหลังครูแก้เฉลย
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
  set submitted_at = coalesce(submitted_at, case when now() > deadline_at then deadline_at end),
      score = case
        when submitted_at is not null or now() > deadline_at then public.quiz_grade(id)
        else score
      end
  where quiz_id = p_quiz;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.quiz_start(uuid) from public, anon;
revoke execute on function public.quiz_save_answer(uuid, uuid, integer) from public, anon;
revoke execute on function public.quiz_submit(uuid) from public, anon;
revoke execute on function public.quiz_regrade(uuid) from public, anon;
grant execute on function public.quiz_start(uuid) to authenticated;
grant execute on function public.quiz_save_answer(uuid, uuid, integer) to authenticated;
grant execute on function public.quiz_submit(uuid) to authenticated;
grant execute on function public.quiz_regrade(uuid) to authenticated;
