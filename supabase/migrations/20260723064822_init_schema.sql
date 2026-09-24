
-- Profiles: extends auth.users, marks teacher vs student
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('teacher','student')) default 'student',
  student_code text unique, -- เลขประจำตัวนักเรียน
  created_at timestamptz not null default now()
);

-- Subjects: ฟิสิกส์5, ฟิสิกส์6, วิทย์กายภาพ1, วิทย์กายภาพ2 ฯลฯ
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null,        -- e.g. 'PHYS5'
  name text not null,        -- e.g. 'ฟิสิกส์ 5'
  created_at timestamptz not null default now()
);

-- Terms: ปีการศึกษา + เทอม
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null, -- e.g. 2569
  semester int not null check (semester in (1,2)),
  is_active boolean not null default false,
  unique (academic_year, semester)
);

-- Courses: instance of a subject taught in a given term
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  unique (subject_id, term_id)
);

-- Enrollments: student <-> course
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  unique (course_id, student_id)
);

-- Score items: assignments/quizzes/exams within a course
create table public.score_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,       -- e.g. 'สอบกลางภาค'
  max_score numeric not null default 100,
  created_at timestamptz not null default now()
);

-- Scores: individual score per student per score item
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  score_item_id uuid not null references public.score_items(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  score numeric,
  updated_at timestamptz not null default now(),
  unique (score_item_id, enrollment_id)
);

-- Materials: สื่อการสอน per course
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  file_url text,
  link_url text,
  created_at timestamptz not null default now()
);

-- helper: is current user a teacher
create or replace function public.is_teacher()
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.terms enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.score_items enable row level security;
alter table public.scores enable row level security;
alter table public.materials enable row level security;

create policy "profiles_select_own_or_teacher" on public.profiles
  for select using (id = auth.uid() or public.is_teacher());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "subjects_read_all" on public.subjects for select using (auth.uid() is not null);
create policy "subjects_write_teacher" on public.subjects for all using (public.is_teacher()) with check (public.is_teacher());

create policy "terms_read_all" on public.terms for select using (auth.uid() is not null);
create policy "terms_write_teacher" on public.terms for all using (public.is_teacher()) with check (public.is_teacher());

create policy "courses_read_all" on public.courses for select using (auth.uid() is not null);
create policy "courses_write_teacher" on public.courses for all using (public.is_teacher()) with check (public.is_teacher());

create policy "materials_read_all" on public.materials for select using (auth.uid() is not null);
create policy "materials_write_teacher" on public.materials for all using (public.is_teacher()) with check (public.is_teacher());

create policy "enrollments_select_own_or_teacher" on public.enrollments
  for select using (student_id = auth.uid() or public.is_teacher());
create policy "enrollments_write_teacher" on public.enrollments
  for all using (public.is_teacher()) with check (public.is_teacher());

create policy "score_items_read_all" on public.score_items for select using (auth.uid() is not null);
create policy "score_items_write_teacher" on public.score_items for all using (public.is_teacher()) with check (public.is_teacher());

create policy "scores_select_own_or_teacher" on public.scores
  for select using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      where e.id = scores.enrollment_id and e.student_id = auth.uid()
    )
  );
create policy "scores_write_teacher" on public.scores
  for all using (public.is_teacher()) with check (public.is_teacher());
