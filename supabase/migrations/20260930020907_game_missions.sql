-- ============================================================================
-- เกมภารกิจ (ใบงานแบบเล่นเป็นเกม เก็บคะแนน)
--
-- ใบงานหนึ่งชุด = เกมหนึ่งเกม แบ่งเป็นด่าน (ตอนที่ 1, 2, ...) แต่ละด่านมีหลายข้อ
-- ข้อมี 2 แบบ: เลือกตอบ (choice) และพิมพ์ตัวเลข (numeric — ยอมให้คลาดเคลื่อนได้ตาม tolerance)
-- นักเรียนตอบแล้วรู้ผลทันทีพร้อมคำอธิบาย แต่คะแนนนับเฉพาะคำตอบแรกของแต่ละข้อ
-- เล่นซ้ำไม่ได้คะแนนเพิ่ม (1 คนต่อ 1 เกม — ครูลบแถวเพื่อให้เล่นใหม่ได้)
-- XP / คอมโบเป็นของตกแต่งในเกม ไม่ใช่คะแนนเก็บ
--
-- ความปลอดภัยแบบเดียวกับแบบทดสอบ:
-- * โจทย์ (game_items) อ่านได้เฉพาะครู นักเรียนได้โจทย์ผ่าน game_start() หลังครูเปิดให้ห้องตัวเองแล้ว
-- * เฉลยและคำอธิบายแยกตาราง (game_keys) ครูเท่านั้น — นักเรียนเห็นเฉลยของข้อที่ตอบไปแล้วเท่านั้น
-- * การตอบทำผ่าน game_answer() ซึ่งตรวจเองฝั่งฐานข้อมูล
-- ============================================================================

create table public.games (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  unit_id uuid references public.course_units(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  -- ชื่อด่าน: [{"title": "ตอนที่ 1 ...", "intro": "..."}] — ตำแหน่งในอาร์เรย์ = game_items.stage - 1
  stages jsonb not null default '[]'::jsonb,
  -- เวลาต่อข้อ (วินาที) ใช้คิดโบนัส XP เท่านั้น ไม่มีผลกับคะแนน
  seconds_per_item integer not null default 60 check (seconds_per_item between 10 and 600),
  created_at timestamptz not null default now()
);
create index games_course_id_idx on public.games (course_id);

create table public.game_items (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  stage smallint not null default 1 check (stage between 1 and 20),
  position integer not null default 0,
  kind text not null check (kind in ('choice', 'numeric')),
  prompt text not null default '',
  image text check (image is null or length(image) <= 700000),
  choices text[] check (choices is null or cardinality(choices) between 2 and 8),
  -- ข้อตัวเลข: หน่วยที่แสดงท้ายช่อง และให้กรอกแบบ a × 10^n หรือไม่
  unit text,
  scientific boolean not null default false,
  points numeric not null default 1 check (points > 0 and points <= 100),
  check (kind <> 'choice' or choices is not null)
);
create index game_items_game_id_idx on public.game_items (game_id, stage, position);

create table public.game_keys (
  item_id uuid primary key references public.game_items(id) on delete cascade,
  correct_index smallint check (correct_index between 0 and 7),
  answer numeric,
  -- ค่าคลาดเคลื่อนที่ยอมรับ เทียบเป็นสัดส่วนของคำตอบ (0.02 = ±2%)
  tolerance numeric not null default 0.02 check (tolerance >= 0 and tolerance < 1),
  -- แสดงหลังนักเรียนตอบข้อนั้นแล้ว
  explanation text,
  check (correct_index is not null or answer is not null)
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  classroom text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index game_sessions_one_open on public.game_sessions (game_id, classroom) where closed_at is null;

create table public.game_plays (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- {"<item_id>": {"v": คำตอบ, "ok": true/false, "pts": คะแนนที่ได้, "at": เวลาตอบ}}
  answers jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  max_score numeric not null,
  xp integer not null default 0 check (xp between 0 and 100000),
  unique (game_id, enrollment_id)
);
create index game_plays_game_id_idx on public.game_plays (game_id);

comment on table public.game_plays is 'การเล่นเกมภารกิจ คนละ 1 ครั้งต่อเกม — ครูลบแถวเพื่อให้เล่นใหม่ได้';

alter table public.games enable row level security;
alter table public.game_items enable row level security;
alter table public.game_keys enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_plays enable row level security;

create policy "games_read_all" on public.games for select using (auth.uid() is not null);
create policy "games_write_teacher" on public.games for all using (public.is_teacher()) with check (public.is_teacher());

create policy "game_items_teacher" on public.game_items for all using (public.is_teacher()) with check (public.is_teacher());
create policy "game_keys_teacher" on public.game_keys for all using (public.is_teacher()) with check (public.is_teacher());

create policy "game_sessions_read_all" on public.game_sessions for select using (auth.uid() is not null);
create policy "game_sessions_write_teacher" on public.game_sessions for all using (public.is_teacher()) with check (public.is_teacher());

-- นักเรียนอ่านการเล่นของตัวเองได้ (คะแนนในเกมเห็นทันทีอยู่แล้ว) เขียนเองไม่ได้
create policy "game_plays_select_own_or_teacher" on public.game_plays for select using (
  public.is_teacher()
  or exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid())
);
create policy "game_plays_write_teacher" on public.game_plays for all using (public.is_teacher()) with check (public.is_teacher());

-- ----------------------------------------------------------------------------
-- ผลของข้อที่ตอบแล้ว (เฉลย + คำอธิบาย) — ใช้ภายใน
-- ----------------------------------------------------------------------------
create or replace function public.game_feedback(p_item uuid, p_entry jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'item_id', i.id,
    'given', p_entry -> 'v',
    'ok', coalesce((p_entry ->> 'ok')::boolean, false),
    'pts', coalesce((p_entry ->> 'pts')::numeric, 0),
    'correct_index', k.correct_index,
    'answer', k.answer,
    'explanation', k.explanation
  )
  from public.game_items i
  left join public.game_keys k on k.item_id = i.id
  where i.id = p_item;
$$;
revoke execute on function public.game_feedback(uuid, jsonb) from public, anon, authenticated;

-- โจทย์ทั้งเกม (ไม่มีเฉลย) + ผลของข้อที่ตอบไปแล้ว
create or replace function public.game_payload(p_play uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'play_id', p.id,
    'title', g.title,
    'description', g.description,
    'stages', g.stages,
    'seconds_per_item', g.seconds_per_item,
    'finished', p.finished_at is not null,
    'score', p.score,
    'max_score', p.max_score,
    'xp', p.xp,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id, 'stage', i.stage, 'kind', i.kind, 'prompt', i.prompt, 'image', i.image,
          'choices', to_jsonb(i.choices), 'unit', i.unit, 'scientific', i.scientific, 'points', i.points
        ) order by i.stage, i.position
      )
      from public.game_items i where i.game_id = g.id
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_object_agg(a.key, public.game_feedback(a.key::uuid, a.value))
      from jsonb_each(p.answers) a
    ), '{}'::jsonb)
  )
  from public.game_plays p
  join public.games g on g.id = p.game_id
  where p.id = p_play;
$$;
revoke execute on function public.game_payload(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- นักเรียนเริ่มเล่น / กลับมาเล่นต่อ
-- ----------------------------------------------------------------------------
create or replace function public.game_start(p_game uuid)
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
  v_play public.game_plays;
  v_max numeric;
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

  select * into v_play from public.game_plays where game_id = p_game and enrollment_id = v_enrollment;
  -- เล่นจบแล้ว ดูผลย้อนหลังได้เสมอ
  if found and v_play.finished_at is not null then
    return public.game_payload(v_play.id);
  end if;

  if not exists (
    select 1 from public.game_sessions s
    where s.game_id = p_game and s.closed_at is null and s.classroom = v_classroom
  ) then
    raise exception 'not_open';
  end if;

  if found then
    return public.game_payload(v_play.id);
  end if;

  select coalesce(sum(points), 0) into v_max from public.game_items where game_id = p_game;
  if v_max = 0 then
    raise exception 'no_items';
  end if;

  insert into public.game_plays (game_id, enrollment_id, max_score)
  values (p_game, v_enrollment, v_max)
  returning * into v_play;
  return public.game_payload(v_play.id);
end;
$$;
revoke execute on function public.game_start(uuid) from public, anon;
grant execute on function public.game_start(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- ตอบหนึ่งข้อ — ตรวจทันที นับเฉพาะคำตอบแรก (ตอบซ้ำได้ผลเดิมกลับไป)
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
  v_ok boolean;
  v_given jsonb;
  v_entry jsonb;
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

  if v_play.answers ? p_item::text then
    return public.game_feedback(p_item, v_play.answers -> p_item::text);
  end if;

  select * into v_key from public.game_keys where item_id = p_item;

  if v_item.kind = 'choice' then
    if p_choice is null or p_choice < 0 or p_choice >= cardinality(v_item.choices) then
      raise exception 'invalid_answer';
    end if;
    v_given := to_jsonb(p_choice);
    v_ok := v_key.correct_index is not null and p_choice = v_key.correct_index;
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

  return public.game_feedback(p_item, v_entry);
end;
$$;
revoke execute on function public.game_answer(uuid, uuid, integer, numeric) from public, anon;
grant execute on function public.game_answer(uuid, uuid, integer, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- จบเกม — บันทึก XP (ของตกแต่ง จำกัดเพดานกันค่าแปลก ๆ)
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
    update public.game_plays
    set finished_at = now(),
        xp = least(greatest(coalesce(p_xp, 0), 0), v_items * 500)
    where id = p_play;
  end if;
  return public.game_payload(p_play);
end;
$$;
revoke execute on function public.game_finish(uuid, integer) from public, anon;
grant execute on function public.game_finish(uuid, integer) to authenticated;

-- เกมที่นักเรียนเห็นในวิชา: เปิดให้ห้องตัวเองอยู่ หรือเคยเล่นแล้ว
create or replace function public.game_my_plays(p_course uuid)
returns table (game_id uuid, play_id uuid, started_at timestamptz, finished_at timestamptz, score numeric, max_score numeric, xp integer, answered integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.game_id, p.id, p.started_at, p.finished_at, p.score, p.max_score, p.xp,
         (select count(*)::integer from jsonb_object_keys(p.answers))
  from public.game_plays p
  join public.enrollments e on e.id = p.enrollment_id
  join public.games g on g.id = p.game_id
  where e.student_id = auth.uid() and g.course_id = p_course;
$$;
revoke execute on function public.game_my_plays(uuid) from public, anon;
grant execute on function public.game_my_plays(uuid) to authenticated;
