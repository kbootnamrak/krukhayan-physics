-- ============================================================================
-- ไฟล์งานจากครู + ส่งงานเป็นลิงก์ + ประหยัดพื้นที่เก็บไฟล์
--
-- * attachments: ไฟล์ใบงาน/เอกสารที่ครูแนบให้นักเรียน — อัปโหลดไฟล์ (bucket "assignment-files")
--   หรือวางลิงก์ Google Drive ฯลฯ (ไม่กินพื้นที่) · นักเรียนเปิดได้เมื่อเห็นงานนั้น
-- * submit_mode: ครูเลือกต่องานว่านักเรียนส่งเป็น ไฟล์/รูป, ลิงก์ (Google Drive, Docs, Canva ฯลฯ) หรือได้ทั้งสองแบบ
--   งาน PDF ใหญ่ ๆ ตั้งเป็น "ลิงก์เท่านั้น" → ไม่กินพื้นที่ Supabase เลย
-- * ไฟล์ในงานเก็บเป็น {"path": ...} (อยู่ใน storage) หรือ {"url": ...} (ลิงก์ภายนอก)
-- * files_purged_at: ครูลบไฟล์ของงานเก่าออกจาก storage แล้ว (คะแนนและความเห็นยังอยู่)
-- * submissions_storage_bytes(): พื้นที่ที่ไฟล์งานทั้งของครูและนักเรียนใช้ไป (ครูดูในแท็บ งาน)
-- ============================================================================

alter table public.assignments
  add column attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  add column submit_mode text not null default 'both' check (submit_mode in ('files', 'links', 'both')),
  add column files_purged_at timestamptz;

-- งานนี้รับไฟล์อัปโหลดหรือไม่ (ใช้ในนโยบายอัปโหลดของ storage)
create or replace function public.assignment_accepts_files(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments
    where id = p_assignment and submit_mode <> 'links' and files_purged_at is null
  );
$$;
revoke execute on function public.assignment_accepts_files(uuid) from public, anon;
grant execute on function public.assignment_accepts_files(uuid) to authenticated;

drop policy "submissions_upload" on storage.objects;
create policy "submissions_upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions'
  and public.submission_folder_owner(name)
  and public.assignment_visible(((storage.foldername(name))[1])::uuid)
  and public.assignment_accepts_files(((storage.foldername(name))[1])::uuid)
);

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
  v_urls text[];
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
    raise exception 'แนบงานอย่างน้อย 1 รายการ';
  end if;
  if jsonb_array_length(p_files) > v_a.max_files then
    raise exception 'แนบได้ไม่เกิน % รายการ', v_a.max_files;
  end if;
  -- แต่ละรายการต้องเป็นไฟล์ (path) หรือลิงก์ (url) อย่างใดอย่างหนึ่ง
  if exists (select 1 from jsonb_array_elements(p_files) f where (f ? 'path') = (f ? 'url')) then
    raise exception 'รายการงานไม่ถูกต้อง ลองแนบใหม่';
  end if;

  select coalesce(array_agg(f ->> 'path') filter (where f ? 'path'), '{}'),
         coalesce(array_agg(f ->> 'url') filter (where f ? 'url'), '{}')
    into v_paths, v_urls
  from jsonb_array_elements(p_files) f;

  if cardinality(v_paths) > 0 and v_a.submit_mode = 'links' then
    raise exception 'งานนี้ครูให้ส่งเป็นลิงก์เท่านั้น';
  end if;
  if cardinality(v_urls) > 0 and v_a.submit_mode = 'files' then
    raise exception 'งานนี้ครูให้ส่งเป็นรูป/ไฟล์เท่านั้น';
  end if;
  if exists (select 1 from unnest(v_urls) u where u !~* '^https?://[^[:space:]]+$' or length(u) > 2000) then
    raise exception 'ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://';
  end if;

  v_prefix := p_assignment::text || '/' || v_enrollment::text || '/';
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

  -- รอตรวจ หรือครูให้ 0 เพราะยังไม่ส่ง → แทนที่รายการ (คะแนนเดิมคงไว้จนกว่าครูจะตรวจ)
  update public.assignment_submissions set
    status = 'submitted', files = p_files, note = nullif(trim(p_note), ''), submitted_at = now()
  where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- ----------------------------------------------------------------------------
-- ที่เก็บไฟล์งานของครู (ส่วนตัว) — โฟลเดอร์ <assignment_id>/
-- ครูอัปโหลด/ลบ · นักเรียนเปิดได้เมื่องานนั้นมอบหมายให้ห้องตัวเองแล้ว
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-files', 'assignment-files', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do nothing;

create policy "assignment_files_read" on storage.objects for select to authenticated using (
  bucket_id = 'assignment-files'
  and (public.is_teacher() or public.assignment_visible(((storage.foldername(name))[1])::uuid))
);
create policy "assignment_files_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'assignment-files' and public.is_teacher()
);
create policy "assignment_files_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'assignment-files' and public.is_teacher()
);

-- พื้นที่ที่ไฟล์งานใช้ไปทั้งหมด (ไบต์) — ครูเท่านั้น
create or replace function public.submissions_storage_bytes()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;
  return (
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
    from storage.objects o
    where o.bucket_id in ('submissions', 'assignment-files')
  );
end;
$$;
revoke execute on function public.submissions_storage_bytes() from public, anon;
grant execute on function public.submissions_storage_bytes() to authenticated;
