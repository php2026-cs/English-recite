create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Shanghai',
  daily_new_meaning_limit integer not null default 20,
  desired_retention numeric not null default 0.9,
  notification_enabled boolean not null default false,
  notification_time time not null default '20:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_words (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  normalized_word text not null,
  phonetic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, normalized_word)
);

create table if not exists public.user_meanings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.user_words(id) on delete cascade,
  part_of_speech text not null,
  chinese_meaning text not null,
  selected_for_study boolean not null default true,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.meaning_review_states (
  meaning_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('new', 'learning', 'review', 'relearning')),
  due_at timestamptz not null,
  last_review_at timestamptz,
  stability numeric,
  difficulty numeric,
  reps integer not null default 0,
  lapses integer not null default 0,
  elapsed_days integer,
  scheduled_days integer,
  fsrs_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null,
  meaning_id uuid not null,
  mode text not null check (mode in ('zh-to-en', 'en-to-zh')),
  result text check (result in ('again', 'hard', 'good', 'easy')),
  correct boolean not null default false,
  reviewed_at timestamptz not null default now(),
  previous_due_at timestamptz,
  next_due_at timestamptz,
  response_time_ms integer,
  created_at timestamptz not null default now()
);
