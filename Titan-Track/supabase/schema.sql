-- Titan Track Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  split text not null,
  duration_minutes integer not null default 1,
  total_volume numeric not null default 0,
  completed boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  exercise_name text not null,
  body_part text not null,
  category text not null,
  set_index integer not null,
  reps integer not null,
  weight numeric not null,
  rpe numeric not null,
  rest_seconds integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body_part text not null,
  category text not null,
  primary_splits text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body_part text not null,
  category text not null,
  primary_splits text[] not null default '{}',
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_splits (
  user_id uuid not null references auth.users(id) on delete cascade,
  split text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, split)
);

create table if not exists public.personal_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  date date not null,
  weight numeric not null,
  reps integer not null,
  estimated_1rm numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  type text not null,
  target numeric not null,
  progress numeric not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bodyweight_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_cache (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

create table if not exists public.backup_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.exercises enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.workout_splits enable row level security;
alter table public.personal_records enable row level security;
alter table public.goals enable row level security;
alter table public.settings enable row level security;
alter table public.bodyweight_history enable row level security;
alter table public.analytics_cache enable row level security;
alter table public.backup_snapshots enable row level security;

-- Helper policy pattern: each user can only access their own rows.
create policy "workouts_owner_select" on public.workouts for select using (auth.uid() = user_id);
create policy "workouts_owner_insert" on public.workouts for insert with check (auth.uid() = user_id);
create policy "workouts_owner_update" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workouts_owner_delete" on public.workouts for delete using (auth.uid() = user_id);

create policy "workout_sets_owner_select" on public.workout_sets for select using (auth.uid() = user_id);
create policy "workout_sets_owner_insert" on public.workout_sets for insert with check (auth.uid() = user_id);
create policy "workout_sets_owner_update" on public.workout_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sets_owner_delete" on public.workout_sets for delete using (auth.uid() = user_id);

create policy "exercises_owner_select" on public.exercises for select using (auth.uid() = user_id);
create policy "exercises_owner_insert" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_owner_update" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_owner_delete" on public.exercises for delete using (auth.uid() = user_id);

create policy "custom_exercises_owner_select" on public.custom_exercises for select using (auth.uid() = user_id);
create policy "custom_exercises_owner_insert" on public.custom_exercises for insert with check (auth.uid() = user_id);
create policy "custom_exercises_owner_update" on public.custom_exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_exercises_owner_delete" on public.custom_exercises for delete using (auth.uid() = user_id);

create policy "workout_splits_owner_select" on public.workout_splits for select using (auth.uid() = user_id);
create policy "workout_splits_owner_insert" on public.workout_splits for insert with check (auth.uid() = user_id);
create policy "workout_splits_owner_update" on public.workout_splits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_splits_owner_delete" on public.workout_splits for delete using (auth.uid() = user_id);

create policy "personal_records_owner_select" on public.personal_records for select using (auth.uid() = user_id);
create policy "personal_records_owner_insert" on public.personal_records for insert with check (auth.uid() = user_id);
create policy "personal_records_owner_update" on public.personal_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_records_owner_delete" on public.personal_records for delete using (auth.uid() = user_id);

create policy "goals_owner_select" on public.goals for select using (auth.uid() = user_id);
create policy "goals_owner_insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_owner_update" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_owner_delete" on public.goals for delete using (auth.uid() = user_id);

create policy "settings_owner_select" on public.settings for select using (auth.uid() = user_id);
create policy "settings_owner_insert" on public.settings for insert with check (auth.uid() = user_id);
create policy "settings_owner_update" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_owner_delete" on public.settings for delete using (auth.uid() = user_id);

create policy "bodyweight_owner_select" on public.bodyweight_history for select using (auth.uid() = user_id);
create policy "bodyweight_owner_insert" on public.bodyweight_history for insert with check (auth.uid() = user_id);
create policy "bodyweight_owner_update" on public.bodyweight_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bodyweight_owner_delete" on public.bodyweight_history for delete using (auth.uid() = user_id);

create policy "analytics_owner_select" on public.analytics_cache for select using (auth.uid() = user_id);
create policy "analytics_owner_insert" on public.analytics_cache for insert with check (auth.uid() = user_id);
create policy "analytics_owner_update" on public.analytics_cache for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analytics_owner_delete" on public.analytics_cache for delete using (auth.uid() = user_id);

create policy "backup_owner_select" on public.backup_snapshots for select using (auth.uid() = user_id);
create policy "backup_owner_insert" on public.backup_snapshots for insert with check (auth.uid() = user_id);
create policy "backup_owner_update" on public.backup_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backup_owner_delete" on public.backup_snapshots for delete using (auth.uid() = user_id);

-- Optional sync helpers to seed workout set rows from a workout payload.
create index if not exists idx_workouts_user_updated on public.workouts(user_id, updated_at desc);
create index if not exists idx_workout_sets_workout on public.workout_sets(workout_id, set_index);
create index if not exists idx_goals_user_updated on public.goals(user_id, updated_at desc);
create index if not exists idx_custom_exercises_user_updated on public.custom_exercises(user_id, updated_at desc);
create index if not exists idx_bodyweight_user_updated on public.bodyweight_history(user_id, updated_at desc);
