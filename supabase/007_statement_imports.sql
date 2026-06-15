create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_url text,
  import_status text default 'uploaded',
  created_at timestamptz default now(),
  constraint statement_imports_status_check check (
    import_status in ('uploaded', 'pending', 'failed')
  )
);

create index if not exists statement_imports_user_profile_id_idx
on public.statement_imports (user_profile_id);

create index if not exists statement_imports_created_at_idx
on public.statement_imports (created_at);

alter table public.statement_imports enable row level security;

drop policy if exists "Development access for statement imports" on public.statement_imports;
create policy "Development access for statement imports" on public.statement_imports
for all
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('statements', 'statements', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Development statement uploads" on storage.objects;
create policy "Development statement uploads" on storage.objects
for insert
with check (bucket_id = 'statements');

drop policy if exists "Development statement reads" on storage.objects;
create policy "Development statement reads" on storage.objects
for select
using (bucket_id = 'statements');

drop policy if exists "Development statement deletes" on storage.objects;
create policy "Development statement deletes" on storage.objects
for delete
using (bucket_id = 'statements');
