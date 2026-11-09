-- ============================================================================
-- เกมภารกิจ: เล่นได้หลายครั้ง (ค่าเริ่มต้น 3) เก็บคะแนนครั้งที่ดีที่สุด
--
-- * games.max_attempts            จำนวนครั้งที่เล่นได้ต่อคน (1–10)
-- * game_plays หนึ่งแถว = หนึ่งครั้ง (attempt 1, 2, 3 ...)
-- * ระหว่างยังเล่นไม่ครบ: ตอบแล้วรู้แค่ถูก/ผิด — ไม่บอกเฉลยและคำอธิบาย (ครั้งถัดไปต้องคิดเอง)
--   เฉลยเปิดเมื่อเล่นครบทุกครั้ง หรือนักเรียนกด "จบและดูเฉลย" (final = true → เล่นต่อไม่ได้)
-- * สลับลำดับตัวเลือกใหม่ทุกครั้ง: choice_orders = {"<item_id>": [ลำดับเดิมของตัวเลือกที่แสดงตำแหน่ง 0,1,2,...]}
--   นักเรียนส่งตำแหน่งที่เห็น → ฐานข้อมูลแปลงเป็นตัวเลือกเดิมก่อนตรวจ คำตอบเก็บเป็นตัวเลือกเดิม
-- ============================================================================

alter table public.games
  add column max_attempts smallint not null default 3 check (max_attempts between 1 and 10);

alter table public.game_plays
  add column attempt smallint not null default 1 check (attempt between 1 and 10),
  add column choice_orders jsonb not null default '{}'::jsonb,
  add column final boolean not null default false;
alter table public.game_plays drop constraint if exists game_plays_game_id_enrollment_id_key;
alter table public.game_plays add constraint game_plays_attempt_unique unique (game_id, enrollment_id, attempt);

comment on table public.game_plays is 'การเล่นเกมภารกิจ หนึ่งแถวต่อหนึ่งครั้ง (attempt) — ครูลบทุกแถวของคนนั้นเพื่อให้เริ่มใหม่';

-- ----------------------------------------------------------------------------
-- เปิดเฉลยแล้วหรือยัง: เล่นจบครบทุกครั้ง หรือนักเรียนกดจบเอง
-- ----------------------------------------------------------------------------
create or replace function public.game_revealed(p_game uuid, p_enrollment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_plays p
    join public.games g on g.id = p.game_id
    where p.game_id = p_game and p.enrollment_id = p_enrollment
      and p.finished_at is not null
      and (p.final or p.attempt >= g.max_attempts)
  );
$$;
revoke execute on function public.game_revealed(uuid, uuid) from public, anon, authenticated;

-- ลำดับตัวเลือกแบบสุ่มสำหรับการเล่นครั้งใหม่
create or replace function public.game_shuffle_orders(p_game uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(i.id::text, (
    select jsonb_agg(n - 1 order by random())
    from generate_series(1, cardinality(i.choices)) n
  )), '{}'::jsonb)
  from public.game_items i
  where i.game_id = p_game and i.kind = 'choice' and i.choices is not null;
$$;
revoke execute on function public.game_shuffle_orders(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- ผลของข้อที่ตอบแล้ว — แปลงตำแหน่งตัวเลือกตามลำดับที่นักเรียนเห็น
-- p_reveal = false → บอกแค่ถูก/ผิด ไม่มีเฉลย/คำอธิบาย
-- ----------------------------------------------------------------------------
drop function if exists public.game_feedback(uuid, jsonb);
create or replace function public.game_feedback(p_item uuid, p_entry jsonb, p_order jsonb, p_reveal boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'item_id', i.id,
    'given', case
      when i.kind = 'choice' and p_order is not null and jsonb_typeof(p_order) = 'array'
        then (select to_jsonb(o.pos - 1) from jsonb_array_elements_text(p_order) with ordinality o(val, pos) where o.val::int = (p_entry ->> 'v')::int)
      else p_entry -> 'v'
    end,
    'ok', coalesce((p_entry ->> 'ok')::boolean, false),
    'pts', coalesce((p_entry ->> 'pts')::numeric, 0),
    'correct_index', case
      when not p_reveal or k.correct_index is null then null
      when p_order is not null and jsonb_typeof(p_order) = 'array'
        then (select o.pos - 1 from jsonb_array_elements_text(p_order) with ordinality o(val, pos) where o.val::int = k.correct_index)
      else k.correct_index
    end,
    'answer', case when p_reveal then k.answer end,
    'explanation', case when p_reveal then k.explanation end
  )
  from public.game_items i
  left join public.game_keys k on k.item_id = i.id
  where i.id = p_item;
$$;
revoke execute on function public.game_feedback(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- โจทย์ทั้งเกม (ตัวเลือกเรียงตามลำดับของครั้งนี้) + ผลข้อที่ตอบแล้ว + สรุปทุกครั้ง
-- ----------------------------------------------------------------------------
create or replace function public.game_payload(p_play uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with pl as (
    select p.*, g.title, g.description, g.theme, g.mode, g.stages, g.seconds_per_item, g.max_attempts,
           public.game_revealed(p.game_id, p.enrollment_id) as revealed
    from public.game_plays p
    join public.games g on g.id = p.game_id
    where p.id = p_play
  ),
  mine as (
    select q.* from public.game_plays q join pl on q.game_id = pl.game_id and q.enrollment_id = pl.enrollment_id
  )
  select jsonb_build_object(
    'play_id', pl.id,
    'title', pl.title,
    'description', pl.description,
    'theme', pl.theme,
    'mode', pl.mode,
    'stages', pl.stages,
    'seconds_per_item', pl.seconds_per_item,
    'finished', pl.finished_at is not null,
    'score', pl.score,
    'max_score', pl.max_score,
    'xp', pl.xp,
    'attempt', pl.attempt,
    'max_attempts', pl.max_attempts,
    'attempts_used', (select count(*) from mine),
    'best_score', (select max(score) from mine where finished_at is not null),
    'revealed', pl.revealed,
    -- เล่นครั้งใหม่ได้: ครั้งนี้จบแล้ว ยังไม่กดจบ และยังไม่ครบจำนวนครั้ง
    'can_retry', pl.finished_at is not null and not pl.revealed and (select count(*) from mine) < pl.max_attempts,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id, 'stage', i.stage, 'kind', i.kind, 'prompt', i.prompt, 'image', i.image,
          'choices', case
            when i.kind = 'choice' and jsonb_typeof(pl.choice_orders -> i.id::text) = 'array'
              then (select to_jsonb(array_agg(i.choices[o.val::int + 1] order by o.pos))
                    from jsonb_array_elements_text(pl.choice_orders -> i.id::text) with ordinality o(val, pos))
            else to_jsonb(i.choices)
          end,
          'unit', i.unit, 'scientific', i.scientific, 'points', i.points
        ) order by i.stage, i.position
      )
      from public.game_items i where i.game_id = pl.game_id
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_object_agg(a.key, public.game_feedback(a.key::uuid, a.value, pl.choice_orders -> a.key, pl.revealed))
      from jsonb_each(pl.answers) a
    ), '{}'::jsonb)
  )
  from pl;
$$;
revoke execute on function public.game_payload(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- เริ่ม/เล่นต่อ — p_new = true เริ่มครั้งใหม่ (ถ้ายังเหลือครั้ง)
-- ----------------------------------------------------------------------------
drop function if exists public.game_start(uuid);
create or replace function public.game_start(p_game uuid, p_new boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_enrollment uuid;
  v_classroom text;
  v_last public.game_plays;
  v_play public.game_plays;
  v_max numeric;
  v_used integer;
begin
  select * into v_game from public.games where id = p_game;
  if not found then
    raise exception 'game_not_found';
  end if;

  select e.id, r.classroom into v_enrollment, v_classroom
  from public.enrollments e
  left join public.class_roster r on r.id = e.roster_id
  where e.course_id = v_game.course_id and e.student_id = auth.uid()
  limit 1;
  if v_enrollment is null then
    raise exception 'not_enrolled';
  end if;

  select * into v_last from public.game_plays
  where game_id = p_game and enrollment_id = v_enrollment
  order by attempt desc limit 1
  for update;
  select count(*) into v_used from public.game_plays where game_id = p_game and enrollment_id = v_enrollment;

  -- ดูผลครั้งล่าสุด (เล่นจบแล้ว) ได้เสมอ
  if v_last.id is not null and v_last.finished_at is not null and not p_new then
    return public.game_payload(v_last.id);
  end if;

  if not exists (
    select 1 from public.game_sessions s
    where s.game_id = p_game and s.closed_at is null and s.classroom = v_classroom
  ) then
    raise exception 'not_open';
  end if;

  -- ครั้งที่ค้างอยู่ → เล่นต่อ
  if v_last.id is not null and v_last.finished_at is null then
    return public.game_payload(v_last.id);
  end if;

  if v_last.id is not null and (public.game_revealed(p_game, v_enrollment) or v_used >= v_game.max_attempts) then
    raise exception 'no_attempts_left';
  end if;

  select coalesce(sum(points), 0) into v_max from public.game_items where game_id = p_game;
  if v_max = 0 then
    raise exception 'no_items';
  end if;

  insert into public.game_plays (game_id, enrollment_id, max_score, attempt, choice_orders)
  values (p_game, v_enrollment, v_max, coalesce(v_last.attempt, 0) + 1, public.game_shuffle_orders(p_game))
  returning * into v_play;
  return public.game_payload(v_play.id);
end;
$$;
revoke execute on function public.game_start(uuid, boolean) from public, anon;
grant execute on function public.game_start(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- ตอบหนึ่งข้อ — p_choice คือตำแหน่งที่นักเรียนเห็น (ครั้งนี้สลับลำดับไว้)
-- ----------------------------------------------------------------------------
create or replace function public.game_answer(p_play uuid, p_item uuid, p_choice integer default null, p_value numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_play public.game_plays;
  v_item public.game_items;
  v_key public.game_keys;
  v_order jsonb;
  v_orig integer;
  v_ok boolean;
  v_given jsonb;
  v_entry jsonb;
  v_reveal boolean;
begin
  select p.* into v_play
  from public.game_plays p
  join public.enrollments e on e.id = p.enrollment_id
  where p.id = p_play and e.student_id = auth.uid()
  for update of p;
  if not found then
    raise exception 'play_not_found';
  end if;
  if v_play.finished_at is not null then
    raise exception 'already_finished';
  end if;

  select * into v_item from public.game_items where id = p_item and game_id = v_play.game_id;
  if not found then
    raise exception 'item_not_found';
  end if;

  v_order := v_play.choice_orders -> p_item::text;
  v_reveal := public.game_revealed(v_play.game_id, v_play.enrollment_id);

  if v_play.answers ? p_item::text then
    return public.game_feedback(p_item, v_play.answers -> p_item::text, v_order, v_reveal);
  end if;

  select * into v_key from public.game_keys where item_id = p_item;

  if v_item.kind = 'choice' then
    if p_choice is null or p_choice < 0 or p_choice >= cardinality(v_item.choices) then
      raise exception 'invalid_answer';
    end if;
    v_orig := case when jsonb_typeof(v_order) = 'array' then (v_order ->> p_choice)::int else p_choice end;
    v_given := to_jsonb(v_orig);
    v_ok := v_key.correct_index is not null and v_orig = v_key.correct_index;
  else
    if p_value is null then
      raise exception 'invalid_answer';
    end if;
    v_given := to_jsonb(p_value);
    v_ok := v_key.answer is not null
      and abs(p_value - v_key.answer) <= greatest(abs(v_key.answer) * v_key.tolerance, 1e-12);
  end if;

  v_entry := jsonb_build_object('v', v_given, 'ok', v_ok, 'pts', case when v_ok then v_item.points else 0 end, 'at', now());

  update public.game_plays
  set answers = answers || jsonb_build_object(p_item::text, v_entry),
      score = score + case when v_ok then v_item.points else 0 end
  where id = p_play;

  return public.game_feedback(p_item, v_entry, v_order, v_reveal);
end;
$$;
revoke execute on function public.game_answer(uuid, uuid, integer, numeric) from public, anon;
grant execute on function public.game_answer(uuid, uuid, integer, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- จบครั้งนี้ — ครั้งสุดท้ายถือว่าจบเกม (เปิดเฉลย)
-- ----------------------------------------------------------------------------
create or replace function public.game_finish(p_play uuid, p_xp integer default 0)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_play public.game_plays;
  v_items integer;
  v_max_attempts smallint;
begin
  select p.* into v_play
  from public.game_plays p
  join public.enrollments e on e.id = p.enrollment_id
  where p.id = p_play and e.student_id = auth.uid()
  for update of p;
  if not found then
    raise exception 'play_not_found';
  end if;
  if v_play.finished_at is null then
    select count(*) into v_items from public.game_items where game_id = v_play.game_id;
    select max_attempts into v_max_attempts from public.games where id = v_play.game_id;
    update public.game_plays
    set finished_at = now(),
        xp = least(greatest(coalesce(p_xp, 0), 0), v_items * 500),
        final = v_play.attempt >= v_max_attempts
    where id = p_play;
  end if;
  return public.game_payload(p_play);
end;
$$;
revoke execute on function public.game_finish(uuid, integer) from public, anon;
grant execute on function public.game_finish(uuid, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- นักเรียนกด "จบและดูเฉลย" — ไม่เล่นครั้งต่อไป
-- ----------------------------------------------------------------------------
create or replace function public.game_conclude(p_play uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_play public.game_plays;
begin
  select p.* into v_play
  from public.game_plays p
  join public.enrollments e on e.id = p.enrollment_id
  where p.id = p_play and e.student_id = auth.uid()
  for update of p;
  if not found then
    raise exception 'play_not_found';
  end if;
  if v_play.finished_at is null then
    raise exception 'not_finished';
  end if;
  update public.game_plays set final = true where id = p_play;
  return public.game_payload(p_play);
end;
$$;
revoke execute on function public.game_conclude(uuid) from public, anon;
grant execute on function public.game_conclude(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- เกมของฉันในวิชา — สรุปต่อเกม: ครั้งล่าสุด + คะแนนดีที่สุด + จำนวนครั้ง
-- ----------------------------------------------------------------------------
drop function if exists public.game_my_plays(uuid);
create or replace function public.game_my_plays(p_course uuid)
returns table (
  game_id uuid, play_id uuid, started_at timestamptz, finished_at timestamptz,
  score numeric, best_score numeric, max_score numeric, xp integer, answered integer,
  attempts_used integer, max_attempts smallint, revealed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.game_id)
    p.game_id, p.id, p.started_at, p.finished_at, p.score,
    (select max(q.score) from public.game_plays q where q.game_id = p.game_id and q.enrollment_id = p.enrollment_id and q.finished_at is not null),
    p.max_score, p.xp,
    (select count(*)::integer from jsonb_object_keys(p.answers)),
    (select count(*)::integer from public.game_plays q where q.game_id = p.game_id and q.enrollment_id = p.enrollment_id),
    g.max_attempts,
    public.game_revealed(p.game_id, p.enrollment_id)
  from public.game_plays p
  join public.enrollments e on e.id = p.enrollment_id
  join public.games g on g.id = p.game_id
  where e.student_id = auth.uid() and g.course_id = p_course
  order by p.game_id, p.attempt desc;
$$;
revoke execute on function public.game_my_plays(uuid) from public, anon;
grant execute on function public.game_my_plays(uuid) to authenticated;
