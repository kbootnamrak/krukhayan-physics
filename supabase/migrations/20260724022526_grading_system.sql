
-- หน่วยการเรียนรู้ (คะแนนระหว่างเรียน) ต่อ course
create table public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,          -- e.g. 'หน่วยที่ 1 การเคลื่อนที่'
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- แต่ละหน่วยแยกเป็น K / P / A พร้อมคะแนนเต็มที่กำหนดได้
create table public.unit_components (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.course_units(id) on delete cascade,
  category text not null check (category in ('K','P','A')),
  max_score numeric not null default 10,
  created_at timestamptz not null default now(),
  unique (unit_id, category)
);

-- คะแนนสอบกลางภาค/ปลายภาค ต่อ course
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  exam_type text not null check (exam_type in ('midterm','final')),
  max_score numeric not null default 100,
  created_at timestamptz not null default now(),
  unique (course_id, exam_type)
);

-- คะแนนรายบุคคล (รวมทั้ง unit_component และ exam ในตารางเดียว)
create table public.student_scores (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  source_type text not null check (source_type in ('unit_component','exam')),
  source_id uuid not null, -- references unit_components.id or exams.id depending on source_type
  score numeric,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, source_type, source_id)
);

-- เกณฑ์การตัดเกรด ต่อ course (ทำให้ปรับได้แต่ละวิชา/เทอม)
create table public.grade_scales (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  min_percent numeric not null,  -- ขั้นต่ำของ % ที่ได้เกรดนี้
  grade text not null,           -- '4','3.5','3',...,'0'
  sort_order int not null default 0
);

alter table public.course_units enable row level security;
alter table public.unit_components enable row level security;
alter table public.exams enable row level security;
alter table public.student_scores enable row level security;
alter table public.grade_scales enable row level security;

create policy "course_units_read_all" on public.course_units for select using (auth.uid() is not null);
create policy "course_units_write_teacher" on public.course_units for all using (public.is_teacher()) with check (public.is_teacher());

create policy "unit_components_read_all" on public.unit_components for select using (auth.uid() is not null);
create policy "unit_components_write_teacher" on public.unit_components for all using (public.is_teacher()) with check (public.is_teacher());

create policy "exams_read_all" on public.exams for select using (auth.uid() is not null);
create policy "exams_write_teacher" on public.exams for all using (public.is_teacher()) with check (public.is_teacher());

create policy "grade_scales_read_all" on public.grade_scales for select using (auth.uid() is not null);
create policy "grade_scales_write_teacher" on public.grade_scales for all using (public.is_teacher()) with check (public.is_teacher());

create policy "student_scores_select_own_or_teacher" on public.student_scores
  for select using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      where e.id = student_scores.enrollment_id and e.student_id = auth.uid()
    )
  );
create policy "student_scores_write_teacher" on public.student_scores
  for all using (public.is_teacher()) with check (public.is_teacher());

-- ตารางเก่า score_items / scores ไม่ใช้แล้ว แทนที่ด้วยระบบใหม่นี้
drop table if exists public.scores;
drop table if exists public.score_items;
