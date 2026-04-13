create extension if not exists pgcrypto;

create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
before update on public.settings
for each row
execute function public.touch_updated_at();

create table if not exists public.metrics_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  event_name text not null,
  event_desc text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists metrics_events_event_name_idx
  on public.metrics_events (event_name);

create index if not exists metrics_events_created_at_idx
  on public.metrics_events (created_at desc);

insert into public.settings (id, data)
values
  (
    'tracking_config',
    '{
      "pixels": [],
      "gtags": [],
      "pushcuts": []
    }'::jsonb
  ),
  (
    'api_keys',
    '{
      "publicKey": "",
      "secretKey": ""
    }'::jsonb
  ),
  (
    'admin_auth',
    '{
      "email": "saidlabsglobal@gmail.com",
      "password": "530348Home10"
    }'::jsonb
  )
on conflict (id) do nothing;
