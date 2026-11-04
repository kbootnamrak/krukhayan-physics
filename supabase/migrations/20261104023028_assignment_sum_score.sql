-- ============================================================================
-- คะแนนงานเข้าช่อง K/P/A แบบ "บวกสะสม" (แทนการเทียบสัดส่วน)
--
-- เดิม: ช่อง = round(คะแนนงานที่ตรวจแล้วรวม / คะแนนเต็มของงานเหล่านั้น × คะแนนเต็มของช่อง)
--       งานแรกเต็ม 2.5 ได้ 2.5 → P กลายเป็น 10/10 ทั้งที่ยังมีงานอื่นอีก
-- ใหม่: ช่อง = ผลรวมคะแนนงานที่ผูกช่องนี้ (ไม่เกินคะแนนเต็มของช่อง) ไม่ปัดเศษ
--       ใบงาน 2.5 + โจทย์ 1 + ท้ายบท 3 ... บวกกันขึ้นไปจนเต็มช่อง · งานที่ยังไม่ตรวจ/ไม่ส่ง = ยังไม่ได้คะแนน
-- แล้วคิดคะแนนช่องใหม่ให้ทุกคนที่มีคะแนนงานอยู่แล้ว
-- ============================================================================

create or replace function public.assignment_sync(p_enrollment uuid, p_component uuid, p_clear boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sum numeric;
  v_comp_max numeric;
begin
  if p_component is null then
    return;
  end if;
  select max_score into v_comp_max from public.unit_components where id = p_component;
  if v_comp_max is null then
    return;
  end if;

  select sum(s.score) into v_sum
  from public.assignments a
  join public.assignment_submissions s on s.assignment_id = a.id and s.enrollment_id = p_enrollment
  where a.component_id = p_component and s.score is not null;

  if v_sum is null then
    if p_clear then
      delete from public.student_scores
      where enrollment_id = p_enrollment and source_type = 'unit_component' and source_id = p_component;
    end if;
    return;
  end if;

  insert into public.student_scores (enrollment_id, source_type, source_id, score)
  values (p_enrollment, 'unit_component', p_component, least(v_comp_max, v_sum))
  on conflict (enrollment_id, source_type, source_id)
  do update set score = excluded.score, updated_at = now();
end;
$$;
revoke execute on function public.assignment_sync(uuid, uuid, boolean) from public, anon, authenticated;

-- คิดคะแนนช่องใหม่ตามวิธีใหม่ ให้ทุกคนที่มีคะแนนงานในช่องที่ผูกไว้
do $$
declare
  v record;
begin
  for v in
    select distinct s.enrollment_id, a.component_id
    from public.assignment_submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.component_id is not null and s.score is not null
  loop
    perform public.assignment_sync(v.enrollment_id, v.component_id, true);
  end loop;
end;
$$;
