-- ============================================================================
-- การส่งงาน (ใช้ได้ทุกรายวิชา)
--
-- ครูสร้างงาน กำหนดส่ง คะแนนเต็ม และผูกกับช่องคะแนน K/P/A ของหน่วยได้
-- นักเรียนถ่ายรูป/แนบ PDF ส่งจากมือถือ → ไฟล์อยู่ใน storage bucket "submissions" (ส่วนตัว)
-- ส่งเลยกำหนดได้ แต่ระบบเห็นว่าส่งช้า · ครูให้คะแนน + ความเห็น หรือส่งคืนให้แก้ (เก็บประวัติทุกรอบ)
--
-- คะแนนเข้าช่อง K/P/A อัตโนมัติ:
--   ช่อง = round(ผลรวมคะแนนงานที่ตรวจแล้ว / ผลรวมคะแนนเต็มของงานเหล่านั้น × คะแนนเต็มของช่อง)
--   นับเฉพาะงานที่มีคะแนนแล้ว — คนไม่ส่งงานครูกด "ให้ 0 คนที่ไม่ส่ง" (สถานะ missing)
--
-- ความปลอดภัย: นักเรียนเขียนตารางเองไม่ได้ ส่งผ่าน assignment_submit() เท่านั้น
-- ไฟล์อัปโหลดได้เฉพาะโฟลเดอร์ <assignment_id>/<enrollment_id ของตัวเอง>/
-- ============================================================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  instructions text,
  due_at timestamptz,
  max_score numeric not null check (max_score > 0 and max_score <= 1000),
  -- ช่องคะแนนที่รับคะแนนจากงานนี้ (ไม่ผูก = เก็บไว้ดูในหน้างานอย่างเดียว)
  component_id uuid references public.unit_components(id) on delete set null,
  -- ห้องที่มอบหมาย (null = ทุกห้องในวิชา)
  rooms text[],
  published boolean not null default false,
  max_files smallint not null default 6 check (max_files between 1 and 20),
  created_at timestamptz not null default now()
);
create index assignments_course_id_idx on public.assignments (course_id);
create index assignments_component_id_idx on public.assignments (component_id);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  -- submitted = รอตรวจ · returned = ครูส่งคืนให้แก้ · graded = ตรวจแล้ว · missing = ไม่ส่ง (ครูให้ 0)
  status text not null check (status in ('submitted', 'returned', 'graded', 'missing')),
  -- [{"path": "...", "name": "รูป 1.jpg", "size": 123456, "type": "image/jpeg"}]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  note text check (note is null or length(note) <= 2000),
  submitted_at timestamptz,
  attempt smallint not null default 1,
  score numeric check (score is null or score >= 0),
  feedback text check (feedback is null or length(feedback) <= 4000),
  graded_at timestamptz,
  -- รอบก่อน ๆ ที่ครูส่งคืนให้แก้: [{"attempt", "files", "note", "submitted_at", "score", "feedback", "returned_at"}]
  history jsonb not null default '[]'::jsonb,
  unique (assignment_id, enrollment_id)
);
create index assignment_submissions_enrollment_idx on public.assignment_submissions (enrollment_id);

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

-- นักเรียนเห็นงานที่เผยแพร่แล้ว ของวิชาที่ลงทะเบียน และมอบหมายให้ห้องตัวเอง
create or replace function public.assignment_visible(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.enrollments e on e.course_id = a.course_id and e.student_id = auth.uid()
    left join public.class_roster r on r.id = e.roster_id
    where a.id = p_assignment
      and a.published
      and (a.rooms is null or r.classroom = any (a.rooms))
  );
$$;
revoke execute on function public.assignment_visible(uuid) from public, anon;
grant execute on function public.assignment_visible(uuid) to authenticated;

create policy "assignments_teacher" on public.assignments for all using (public.is_teacher()) with check (public.is_teacher());
create policy "assignments_student_read" on public.assignments for select using (public.assignment_visible(id));

create policy "assignment_submissions_teacher" on public.assignment_submissions for all using (public.is_teacher()) with check (public.is_teacher());
create policy "assignment_submissions_own_read" on public.assignment_submissions for select using (
  exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- ที่เก็บไฟล์งาน (ส่วนตัว) — รูปถูกย่อจากฝั่งมือถือก่อนอัปโหลด
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- โฟลเดอร์ <assignment_id>/<enrollment_id>/ เป็นของนักเรียนคนนั้น
create or replace function public.submission_folder_owner(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.id::text = (storage.foldername(p_name))[2]
      and e.student_id = auth.uid()
  );
$$;
revoke execute on function public.submission_folder_owner(text) from public, anon;
grant execute on function public.submission_folder_owner(text) to authenticated;

create policy "submissions_read" on storage.objects for select to authenticated using (
  bucket_id = 'submissions' and (public.is_teacher() or public.submission_folder_owner(name))
);
create policy "submissions_upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions'
  and public.submission_folder_owner(name)
  and public.assignment_visible(((storage.foldername(name))[1])::uuid)
);
create policy "submissions_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'submissions' and (public.is_teacher() or public.submission_folder_owner(name))
);

-- ----------------------------------------------------------------------------
-- คิดคะแนนช่อง K/P/A ของนักเรียนหนึ่งคนจากงานที่ผูกไว้ (ใช้ภายใน)
-- p_clear = ลบคะแนนช่องเมื่อไม่เหลืองานที่ตรวจแล้ว (ใช้ตอนเลิกผูก/ลบงาน)
-- ----------------------------------------------------------------------------
create or replace function public.assignment_sync(p_enrollment uuid, p_component uuid, p_clear boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sum numeric;
  v_max numeric;
  v_comp_max numeric;
begin
  if p_component is null then
    return;
  end if;
  select max_score into v_comp_max from public.unit_components where id = p_component;
  if v_comp_max is null then
    return;
  end if;

  select sum(s.score), sum(a.max_score) into v_sum, v_max
  from public.assignments a
  join public.assignment_submissions s on s.assignment_id = a.id and s.enrollment_id = p_enrollment
  where a.component_id = p_component and s.score is not null;

  if v_max is null or v_max = 0 then
    if p_clear then
      delete from public.student_scores
      where enrollment_id = p_enrollment and source_type = 'unit_component' and source_id = p_component;
    end if;
    return;
  end if;

  insert into public.student_scores (enrollment_id, source_type, source_id, score)
  values (p_enrollment, 'unit_component', p_component, least(v_comp_max, round(v_sum / v_max * v_comp_max)))
  on conflict (enrollment_id, source_type, source_id)
  do update set score = excluded.score, updated_at = now();
end;
$$;
revoke execute on function public.assignment_sync(uuid, uuid, boolean) from public, anon, authenticated;

-- เปลี่ยนช่องที่ผูก / คะแนนเต็ม → คิดคะแนนช่องใหม่ให้คนที่มีคะแนนงานนี้
create or replace function public.assignment_resync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment uuid;
begin
  if tg_op = 'UPDATE'
     and new.component_id is not distinct from old.component_id
     and new.max_score = old.max_score then
    return new;
  end if;

  for v_enrollment in
    select enrollment_id from public.assignment_submissions where assignment_id = old.id and score is not null
  loop
    perform public.assignment_sync(v_enrollment, old.component_id, true);
    if tg_op = 'UPDATE' and new.component_id is distinct from old.component_id then
      perform public.assignment_sync(v_enrollment, new.component_id);
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.assignment_resync() from public, anon, authenticated;

create trigger assignments_resync_update
after update of component_id, max_score on public.assignments
for each row execute function public.assignment_resync();

-- ลบแถวส่งงาน (ครูรีเซ็ตให้ส่งใหม่) → คิดคะแนนช่องใหม่
create or replace function public.assignment_submission_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.score is not null then
    perform public.assignment_sync(
      old.enrollment_id, (select component_id from public.assignments where id = old.assignment_id), true);
  end if;
  return old;
end;
$$;
revoke execute on function public.assignment_submission_deleted() from public, anon, authenticated;

create trigger assignment_submissions_after_delete
after delete on public.assignment_submissions
for each row execute function public.assignment_submission_deleted();

-- ลบงาน: ลบแถวส่งงานเองก่อน (ตอนนี้งานยังอยู่ trigger ด้านบนจึงรู้ว่าผูกช่องไหน)
create or replace function public.assignment_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.assignment_submissions where assignment_id = old.id;
  return old;
end;
$$;
revoke execute on function public.assignment_before_delete() from public, anon, authenticated;

create trigger assignments_before_delete
before delete on public.assignments
for each row execute function public.assignment_before_delete();

-- ----------------------------------------------------------------------------
-- นักเรียนส่งงาน (ส่งใหม่ทับได้จนกว่าครูจะตรวจ · ครูส่งคืนแล้วส่งรอบใหม่ได้)
-- ----------------------------------------------------------------------------
create or replace function public.assignment_submit(p_assignment uuid, p_files jsonb, p_note text default null)
returns public.assignment_submissions
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_a public.assignments;
  v_enrollment uuid;
  v_sub public.assignment_submissions;
  v_paths text[];
  v_prefix text;
begin
  select * into v_a from public.assignments where id = p_assignment;
  if not found or not public.assignment_visible(p_assignment) then
    raise exception 'ไม่พบงานนี้ หรือครูยังไม่ได้มอบหมายให้ห้องของคุณ';
  end if;

  select e.id into v_enrollment
  from public.enrollments e
  where e.course_id = v_a.course_id and e.student_id = auth.uid()
  limit 1;

  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then
    raise exception 'แนบรูปหรือไฟล์งานอย่างน้อย 1 ไฟล์';
  end if;
  if jsonb_array_length(p_files) > v_a.max_files then
    raise exception 'แนบได้ไม่เกิน % ไฟล์', v_a.max_files;
  end if;

  v_prefix := p_assignment::text || '/' || v_enrollment::text || '/';
  select array_agg(f ->> 'path') into v_paths from jsonb_array_elements(p_files) f;
  if exists (select 1 from unnest(v_paths) p where p is null or left(p, length(v_prefix)) <> v_prefix) then
    raise exception 'ไฟล์ไม่ถูกต้อง ลองแนบใหม่';
  end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'submissions' and o.name = any (v_paths))
     <> cardinality(v_paths) then
    raise exception 'อัปโหลดไฟล์ไม่ครบ ลองแนบใหม่';
  end if;

  select * into v_sub from public.assignment_submissions
  where assignment_id = p_assignment and enrollment_id = v_enrollment
  for update;

  if not found then
    insert into public.assignment_submissions (assignment_id, enrollment_id, status, files, note, submitted_at)
    values (p_assignment, v_enrollment, 'submitted', p_files, nullif(trim(p_note), ''), now())
    returning * into v_sub;
    return v_sub;
  end if;

  if v_sub.status = 'graded' then
    raise exception 'ครูตรวจงานนี้แล้ว ส่งใหม่ไม่ได้ ถ้าต้องการแก้ ขอให้ครูส่งคืน';
  end if;

  if v_sub.status = 'returned' then
    -- เก็บรอบเดิมไว้ในประวัติ แล้วเริ่มรอบใหม่ (คะแนนเดิมคงไว้จนกว่าครูจะตรวจใหม่)
    update public.assignment_submissions set
      history = history || jsonb_build_array(jsonb_build_object(
        'attempt', attempt, 'files', files, 'note', note, 'submitted_at', submitted_at,
        'score', score, 'feedback', feedback, 'returned_at', graded_at)),
      attempt = attempt + 1,
      status = 'submitted',
      files = p_files,
      note = nullif(trim(p_note), ''),
      submitted_at = now(),
      feedback = null,
      graded_at = null
    where id = v_sub.id
    returning * into v_sub;
    return v_sub;
  end if;

  -- รอตรวจ หรือครูให้ 0 เพราะยังไม่ส่ง → แทนที่ไฟล์ (คะแนนเดิมคงไว้จนกว่าครูจะตรวจ)
  update public.assignment_submissions set
    status = 'submitted', files = p_files, note = nullif(trim(p_note), ''), submitted_at = now()
  where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;
revoke execute on function public.assignment_submit(uuid, jsonb, text) from public, anon;
grant execute on function public.assignment_submit(uuid, jsonb, text) to authenticated;

-- ----------------------------------------------------------------------------
-- ครูให้คะแนน / ส่งคืนให้แก้ (ให้คะแนนคนที่ส่งเป็นกระดาษได้ ไม่ต้องมีไฟล์)
-- ----------------------------------------------------------------------------
create or replace function public.assignment_grade(
  p_assignment uuid, p_enrollment uuid, p_score numeric, p_feedback text default null, p_return boolean default false
)
returns public.assignment_submissions
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_a public.assignments;
  v_sub public.assignment_submissions;
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;
  select * into v_a from public.assignments where id = p_assignment;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;
  if not exists (select 1 from public.enrollments where id = p_enrollment and course_id = v_a.course_id) then
    raise exception 'นักเรียนคนนี้ไม่ได้อยู่ในวิชานี้';
  end if;
  if p_score is null and not p_return then
    raise exception 'ใส่คะแนนก่อนบันทึก';
  end if;
  if p_score is not null and (p_score < 0 or p_score > v_a.max_score) then
    raise exception 'คะแนนต้องอยู่ระหว่าง 0 ถึง %', v_a.max_score;
  end if;

  insert into public.assignment_submissions (assignment_id, enrollment_id, status, score, feedback, graded_at)
  values (p_assignment, p_enrollment, case when p_return then 'returned' else 'graded' end,
          p_score, nullif(trim(p_feedback), ''), now())
  on conflict (assignment_id, enrollment_id) do update set
    status = excluded.status, score = excluded.score, feedback = excluded.feedback, graded_at = excluded.graded_at
  returning * into v_sub;

  perform public.assignment_sync(p_enrollment, v_a.component_id, true);
  return v_sub;
end;
$$;
revoke execute on function public.assignment_grade(uuid, uuid, numeric, text, boolean) from public, anon;
grant execute on function public.assignment_grade(uuid, uuid, numeric, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- ให้ 0 คะแนนคนที่ยังไม่ส่ง (เฉพาะห้องที่มอบหมาย) — ส่งช้าภายหลังยังส่งได้ ครูตรวจใหม่
-- ----------------------------------------------------------------------------
create or replace function public.assignment_zero_missing(p_assignment uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_a public.assignments;
  v_enrollment uuid;
  v_count integer := 0;
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;
  select * into v_a from public.assignments where id = p_assignment;
  if not found then
    raise exception 'ไม่พบงานนี้';
  end if;

  for v_enrollment in
    select e.id
    from public.enrollments e
    left join public.class_roster r on r.id = e.roster_id
    where e.course_id = v_a.course_id
      and (v_a.rooms is null or r.classroom = any (v_a.rooms))
      and not exists (select 1 from public.assignment_submissions s where s.assignment_id = p_assignment and s.enrollment_id = e.id)
  loop
    insert into public.assignment_submissions (assignment_id, enrollment_id, status, score, graded_at)
    values (p_assignment, v_enrollment, 'missing', 0, now());
    perform public.assignment_sync(v_enrollment, v_a.component_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.assignment_zero_missing(uuid) from public, anon;
grant execute on function public.assignment_zero_missing(uuid) to authenticated;
