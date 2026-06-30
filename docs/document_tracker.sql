-- Document tracker: tracks per-user application documents, optionally linked to a scholarship.
-- scholarships.id is uuid (confirmed via REST sample row), so scholarship_id matches that type.

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid references public.scholarships(id) on delete set null,
  name text not null,
  doc_type text,
  status text not null default 'needed',
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.application_documents enable row level security;

create policy "Users can select their own documents"
  on public.application_documents
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on public.application_documents
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own documents"
  on public.application_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on public.application_documents
  for delete
  using (auth.uid() = user_id);
