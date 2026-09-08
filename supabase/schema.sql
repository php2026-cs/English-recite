-- 用户学习数据云同步表（本阶段以 SQL 形式预留，需在 Supabase 中执行）

create table if not exists public.review_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  meaning_id text,
  mode text not null check (mode in ('zh-to-en', 'en-to-zh')),
  result text check (result in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default now()
);

create index if not exists review_records_user_reviewed_idx
  on public.review_records (user_id, reviewed_at);

create table if not exists public.meaning_review_states (
  meaning_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('new', 'learning', 'review', 'relearning')),
  due_at timestamptz not null,
  last_review_at timestamptz,
  stability double precision,
  difficulty double precision,
  reps integer not null default 0,
  lapses integer not null default 0,
  elapsed_days double precision,
  scheduled_days double precision,
  fsrs_data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, meaning_id)
);

create index if not exists meaning_review_states_due_idx
  on public.meaning_review_states (user_id, due_at);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_date date not null,
  notification_type text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, notification_date, notification_type)
);

alter table public.review_records enable row level security;
alter table public.meaning_review_states enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_logs enable row level security;

create policy "users_read_own_review_records"
  on public.review_records for select
  using (auth.uid() = user_id);

create policy "users_insert_own_review_records"
  on public.review_records for insert
  with check (auth.uid() = user_id);

create policy "users_read_own_review_states"
  on public.meaning_review_states for select
  using (auth.uid() = user_id);

create policy "users_upsert_own_review_states"
  on public.meaning_review_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_manage_own_push_subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_read_own_notification_logs"
  on public.notification_logs for select
  using (auth.uid() = user_id);
