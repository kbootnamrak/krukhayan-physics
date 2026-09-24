-- ============================================================================
-- ระบบติดตามอุณหภูมิและความชื้น (ESP32 + DHT11)
-- ตารางทั้งหมดขึ้นต้นด้วย iot_ เพื่อไม่ชนกับตารางระบบคะแนนเดิม
-- ============================================================================

-- ---------------------------------------------------------------------------
-- helper: ผู้ใช้ปัจจุบันเป็นครูหรือไม่ (ใช้ชื่อเฉพาะกันชนกับฟังก์ชันเดิมในโปรเจกต์)
-- ---------------------------------------------------------------------------
create or replace function public.iot_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- RLS policy ด้านล่างเรียกฟังก์ชันนี้ authenticated จึงต้องมีสิทธิ์เรียกต่อไป
-- ส่วน anon ไม่มี policy ไหนใช้เลย ตัดออกเพื่อไม่ให้เรียกผ่าน /rest/v1/rpc ได้
revoke all on function public.iot_is_teacher() from public, anon;
grant execute on function public.iot_is_teacher() to authenticated;

-- ---------------------------------------------------------------------------
-- อุปกรณ์ (ESP32 หนึ่งตัว = หนึ่งแถว)
-- ---------------------------------------------------------------------------
create table if not exists public.iot_devices (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  location          text,
  -- เก็บเฉพาะ SHA-256 ของ device key ไม่เก็บคีย์จริง
  key_hash          text not null unique,
  key_prefix        text not null,
  owner_id          uuid references public.profiles(id) on delete set null,
  sample_interval_s integer not null default 60 check (sample_interval_s between 10 and 3600),
  offline_after_s   integer not null default 300 check (offline_after_s between 60 and 86400),
  is_active         boolean not null default true,
  last_seen_at      timestamptz,
  last_rssi         integer,
  created_at        timestamptz not null default now()
);

comment on column public.iot_devices.key_hash is 'SHA-256 hex ของ device key — คีย์จริงแสดงครั้งเดียวตอนสร้าง';
comment on column public.iot_devices.offline_after_s is 'ไม่ได้ยินจากอุปกรณ์เกินกี่วินาทีจึงถือว่าออฟไลน์';

-- ---------------------------------------------------------------------------
-- ค่าที่วัดได้
-- unique(device_id, recorded_at) ทำให้อุปกรณ์ส่งซ้ำ (retry/ข้อมูลค้างใน buffer)
-- ได้อย่างปลอดภัย — insert ซ้ำจะถูกข้าม ไม่เกิดข้อมูลซ้อน
-- ---------------------------------------------------------------------------
create table if not exists public.iot_readings (
  id            bigserial primary key,
  device_id     uuid not null references public.iot_devices(id) on delete cascade,
  recorded_at   timestamptz not null,
  temperature_c numeric(5,2),
  humidity_pct  numeric(5,2),
  heat_index_c  numeric(5,2),
  rssi          integer,
  uptime_s      bigint,
  created_at    timestamptz not null default now(),
  constraint iot_readings_unique_sample unique (device_id, recorded_at)
);

create index if not exists iot_readings_device_time_idx
  on public.iot_readings (device_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- เกณฑ์แจ้งเตือน — หนึ่งแถวต่อหนึ่งอุปกรณ์ต่อหนึ่งค่าที่วัด
-- ---------------------------------------------------------------------------
create table if not exists public.iot_alert_rules (
  id                   uuid primary key default gen_random_uuid(),
  device_id            uuid not null references public.iot_devices(id) on delete cascade,
  metric               text not null check (metric in ('temperature_c', 'humidity_pct')),
  min_value            numeric(5,2),
  max_value            numeric(5,2),
  -- ค่าหน่วง: ต้องกลับเข้ามาในกรอบเกินขอบเขตนี้จึงนับว่า "กลับสู่ปกติ"
  -- ป้องกันการแจ้งเตือนรัวเมื่อค่าแกว่งรอบ ๆ เกณฑ์พอดี
  hysteresis           numeric(5,2) not null default 0.5 check (hysteresis >= 0),
  -- ต้องผิดเกณฑ์ติดกันกี่ครั้งจึงแจ้งเตือน (กันค่าสวิงชั่วขณะ/เซนเซอร์อ่านพลาด)
  consecutive_required integer not null default 2 check (consecutive_required between 1 and 20),
  -- ระยะพักก่อนเตือนซ้ำเรื่องเดิม
  cooldown_minutes     integer not null default 15 check (cooldown_minutes between 0 and 1440),
  enabled              boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint iot_alert_rules_unique_metric unique (device_id, metric),
  constraint iot_alert_rules_has_bound check (min_value is not null or max_value is not null),
  constraint iot_alert_rules_order check (
    min_value is null or max_value is null or min_value < max_value
  )
);

-- ---------------------------------------------------------------------------
-- สถานะปัจจุบันของแต่ละเกณฑ์ (ใช้ทำ hysteresis / cooldown / กันเตือนซ้ำ)
-- ---------------------------------------------------------------------------
create table if not exists public.iot_alert_states (
  rule_id          uuid primary key references public.iot_alert_rules(id) on delete cascade,
  status           text not null default 'ok' check (status in ('ok', 'low', 'high')),
  breach_count     integer not null default 0,
  last_notified_at timestamptz,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ประวัติการแจ้งเตือน
-- ---------------------------------------------------------------------------
create table if not exists public.iot_alerts (
  id           bigserial primary key,
  device_id    uuid not null references public.iot_devices(id) on delete cascade,
  rule_id      uuid references public.iot_alert_rules(id) on delete set null,
  metric       text,
  kind         text not null check (kind in ('low', 'high', 'recovered', 'offline', 'online')),
  value        numeric(6,2),
  threshold    numeric(6,2),
  message      text not null,
  notified     boolean not null default false,
  notify_error text,
  created_at   timestamptz not null default now()
);

create index if not exists iot_alerts_device_time_idx
  on public.iot_alerts (device_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ผู้รับแจ้งเตือนทาง LINE (device_id เป็น null = รับทุกอุปกรณ์)
-- ---------------------------------------------------------------------------
create table if not exists public.iot_line_recipients (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid references public.iot_devices(id) on delete cascade,
  target_type text not null default 'user' check (target_type in ('user', 'group', 'room')),
  target_id   text not null,
  label       text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  -- nulls not distinct: device_id = null (รับทุกอุปกรณ์) ต้องชนกันเองได้ด้วย
  -- มิฉะนั้น upsert จาก webhook ของ LINE จะสร้างแถวซ้ำทุกครั้งที่ผู้ใช้ทักบอท
  constraint iot_line_recipients_unique_target unique nulls not distinct (device_id, target_id)
);

-- ---------------------------------------------------------------------------
-- วิวสรุป: ค่าล่าสุดของแต่ละอุปกรณ์ + สถานะออนไลน์
-- security_invoker = RLS ของผู้เรียกมีผลกับวิวนี้ด้วย
-- ---------------------------------------------------------------------------
create or replace view public.iot_device_latest
with (security_invoker = true) as
select
  d.id            as device_id,
  d.name,
  d.location,
  d.is_active,
  d.last_seen_at,
  d.offline_after_s,
  (d.last_seen_at is null or d.last_seen_at < now() - make_interval(secs => d.offline_after_s))
                  as is_offline,
  r.recorded_at,
  r.temperature_c,
  r.humidity_pct,
  r.heat_index_c,
  r.rssi
from public.iot_devices d
left join lateral (
  select recorded_at, temperature_c, humidity_pct, heat_index_c, rssi
  from public.iot_readings
  where device_id = d.id
  order by recorded_at desc
  limit 1
) r on true;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * อุปกรณ์ + ค่าที่วัดได้  : ผู้ล็อกอินทุกคนอ่านได้ (ใช้ทำจอแสดงผลในห้องเรียน)
--   * เกณฑ์ + ประวัติแจ้งเตือน : ผู้ล็อกอินทุกคนอ่านได้ ครูเท่านั้นที่แก้ได้
--   * ผู้รับแจ้งเตือน LINE     : ครูเท่านั้น (มี LINE user id อยู่ข้างใน)
--   * การเขียนข้อมูลจากอุปกรณ์ : ผ่าน API route ด้วย service role → ข้าม RLS
-- ---------------------------------------------------------------------------
alter table public.iot_devices         enable row level security;
alter table public.iot_readings        enable row level security;
alter table public.iot_alert_rules     enable row level security;
alter table public.iot_alert_states    enable row level security;
alter table public.iot_alerts          enable row level security;
alter table public.iot_line_recipients enable row level security;

drop policy if exists iot_devices_select on public.iot_devices;
create policy iot_devices_select on public.iot_devices
  for select to authenticated using (true);

drop policy if exists iot_devices_write on public.iot_devices;
create policy iot_devices_write on public.iot_devices
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

drop policy if exists iot_readings_select on public.iot_readings;
create policy iot_readings_select on public.iot_readings
  for select to authenticated using (true);

drop policy if exists iot_readings_write on public.iot_readings;
create policy iot_readings_write on public.iot_readings
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

drop policy if exists iot_alert_rules_select on public.iot_alert_rules;
create policy iot_alert_rules_select on public.iot_alert_rules
  for select to authenticated using (true);

drop policy if exists iot_alert_rules_write on public.iot_alert_rules;
create policy iot_alert_rules_write on public.iot_alert_rules
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

drop policy if exists iot_alert_states_all on public.iot_alert_states;
create policy iot_alert_states_all on public.iot_alert_states
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

drop policy if exists iot_alerts_select on public.iot_alerts;
create policy iot_alerts_select on public.iot_alerts
  for select to authenticated using (true);

drop policy if exists iot_alerts_write on public.iot_alerts;
create policy iot_alerts_write on public.iot_alerts
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

drop policy if exists iot_line_recipients_all on public.iot_line_recipients;
create policy iot_line_recipients_all on public.iot_line_recipients
  for all to authenticated
  using (public.iot_is_teacher()) with check (public.iot_is_teacher());

-- ---------------------------------------------------------------------------
-- การล้างข้อมูลเก่า — เรียกเองหรือใช้ pg_cron
--   select cron.schedule('iot-purge', '0 3 * * *', $$select public.iot_purge_old_readings(90)$$);
-- ---------------------------------------------------------------------------
create or replace function public.iot_purge_old_readings(keep_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.iot_readings
  where recorded_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;

  delete from public.iot_alerts
  where created_at < now() - make_interval(days => keep_days * 4);

  return removed;
end;
$$;

revoke all on function public.iot_purge_old_readings(integer) from public, anon, authenticated;
