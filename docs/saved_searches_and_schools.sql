-- Smart Matching overhaul: saved_searches + saved_schools.
-- Neither table existed yet (confirmed via REST probing on 2026-06-27 —
-- only a generic `saved_results` table and the unrelated
-- `user_saved_scholarships` existed). Run this in the Supabase SQL editor.

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_name text not null,
  answers jsonb not null,
  results_count integer,
  created_at timestamptz default now()
);

alter table public.saved_searches enable row level security;

create policy "Users can select their own saved searches"
  on public.saved_searches for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved searches"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saved searches"
  on public.saved_searches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved searches"
  on public.saved_searches for delete
  using (auth.uid() = user_id);

create table public.saved_schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, school_id)
);

alter table public.saved_schools enable row level security;

create policy "Users can select their own saved schools"
  on public.saved_schools for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved schools"
  on public.saved_schools for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved schools"
  on public.saved_schools for delete
  using (auth.uid() = user_id);
