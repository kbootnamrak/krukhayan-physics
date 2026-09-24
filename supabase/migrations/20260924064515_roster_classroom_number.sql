-- ห้องและเลขที่จากไฟล์ของระบบทะเบียนโรงเรียน
-- ใช้เรียงรายชื่อในตารางคะแนนและไฟล์ Excel ให้ตรงกับสมุดคะแนน (เรียงตามห้อง แล้วตามเลขที่)
-- เป็นค่าว่างได้ เพราะไฟล์แบบย่อ (รหัสนักเรียน + ชื่อ-สกุล) ไม่มีสองคอลัมน์นี้
alter table public.class_roster
  add column if not exists classroom text,
  add column if not exists class_number integer check (class_number is null or class_number > 0);

comment on column public.class_roster.classroom is 'เช่น ม.6/1 — มาจาก ระดับชั้น + ห้อง ในไฟล์นำเข้า';
comment on column public.class_roster.class_number is 'เลขที่ในห้อง';
