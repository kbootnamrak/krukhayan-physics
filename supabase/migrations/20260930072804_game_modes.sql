-- ============================================================================
-- โหมดการเล่นของเกมภารกิจ — แต่ละเกมเล่นคนละแบบ นักเรียนจะได้ไม่เบื่อ
-- runner = วิ่งข้ามด่าน มุมมองด้านข้าง (เดิม) · battle = บอสแบทเทิล ผลัดกันโจมตี
-- ครูเปลี่ยนโหมดได้ในหน้าจัดการเกม · ส่งโหมดไปกับโจทย์ใน game_payload
-- ============================================================================

alter table public.games
  add column mode text not null default 'runner' check (mode in ('runner', 'battle'));

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
    'theme', g.theme,
    'mode', g.mode,
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
