-- Feature overhaul: settings, reminders, encrypted private content, and support tables

alter table public.journeys
  add column if not exists talking_since date,
  add column if not exists allow_private_deletes boolean not null default false;

alter table public.profiles
  add column if not exists bio text,
  add column if not exists counter_label text,
  add column if not exists reminder_time time not null default '21:00:00',
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists push_enabled boolean not null default false,
  add column if not exists is_claimed boolean not null default true;

alter table public.journal_entries
  add column if not exists body_encrypted text,
  add column if not exists body_iv text,
  add column if not exists body_salt text,
  add column if not exists body_kdf_iter integer,
  add column if not exists body_key_version text;

alter table public.unsent_thoughts
  add column if not exists text_encrypted text,
  add column if not exists text_iv text,
  add column if not exists text_salt text,
  add column if not exists text_kdf_iter integer,
  add column if not exists text_key_version text;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create table if not exists public.checkin_miss_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  missed_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null
);

create table if not exists public.personal_duas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  arabic text not null,
  transliteration text not null default '',
  english text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thinking_pings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.checkin_miss_log enable row level security;
alter table public.personal_duas enable row level security;
alter table public.thinking_pings enable row level security;

drop policy if exists "push_subscriptions_self_select" on public.push_subscriptions;
create policy "push_subscriptions_self_select" on public.push_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_self_insert" on public.push_subscriptions;
create policy "push_subscriptions_self_insert" on public.push_subscriptions
for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_self_update" on public.push_subscriptions;
create policy "push_subscriptions_self_update" on public.push_subscriptions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkin_miss_log_self_rw" on public.checkin_miss_log;
create policy "checkin_miss_log_self_rw" on public.checkin_miss_log
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "personal_duas_self_rw" on public.personal_duas;
create policy "personal_duas_self_rw" on public.personal_duas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "thinking_pings_journey_select" on public.thinking_pings;
create policy "thinking_pings_journey_select" on public.thinking_pings
for select using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.journey_id = thinking_pings.journey_id
));

drop policy if exists "thinking_pings_sender_insert" on public.thinking_pings;
create policy "thinking_pings_sender_insert" on public.thinking_pings
for insert with check (auth.uid() = sender_id);

