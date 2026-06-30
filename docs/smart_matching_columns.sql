-- Smart Matching questionnaire: new profile columns.
-- Run this in the Supabase SQL editor (or via the CLI) before using the
-- redesigned /profile-setup screen — it writes to these columns in addition
-- to the existing degree_level, field_of_study, country, gpa, target_state.

alter table public.profiles add column if not exists enrollment_type text;
alter table public.profiles add column if not exists gpa_range text;
alter table public.profiles add column if not exists extracurriculars text;
alter table public.profiles add column if not exists preferred_locations text[];
alter table public.profiles add column if not exists max_budget text;
alter table public.profiles add column if not exists campus_size text;
alter table public.profiles add column if not exists demographics text[];
alter table public.profiles add column if not exists admission_timeline text;
alter table public.profiles add column if not exists hard_constraints text;
