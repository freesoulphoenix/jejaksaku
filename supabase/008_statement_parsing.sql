alter table public.statement_imports
add column if not exists bank_name text;

alter table public.transactions
add column if not exists imported_transaction_id uuid;

create table if not exists public.imported_transactions (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  statement_import_id uuid not null references public.statement_imports(id) on delete cascade,
  transaction_date date not null,
  description text not null,
  amount numeric not null,
  import_status text default 'pending',
  created_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz default now(),
  constraint imported_transactions_status_check check (
    import_status in ('pending', 'selected', 'imported', 'matched', 'ignored', 'duplicate')
  )
);

alter table public.transactions
drop constraint if exists transactions_imported_transaction_id_fkey;

alter table public.transactions
add constraint transactions_imported_transaction_id_fkey
foreign key (imported_transaction_id) references public.imported_transactions(id) on delete set null;

create unique index if not exists transactions_imported_transaction_id_unique_idx
on public.transactions (imported_transaction_id)
where imported_transaction_id is not null;

create index if not exists imported_transactions_user_profile_id_idx
on public.imported_transactions (user_profile_id);

create index if not exists imported_transactions_statement_import_id_idx
on public.imported_transactions (statement_import_id);

create index if not exists imported_transactions_transaction_date_idx
on public.imported_transactions (transaction_date);

create unique index if not exists imported_transactions_unique_source_idx
on public.imported_transactions (statement_import_id, transaction_date, description, amount);

alter table public.imported_transactions enable row level security;

drop policy if exists "Development access for imported transactions" on public.imported_transactions;
create policy "Development access for imported transactions" on public.imported_transactions
for all
using (true)
with check (true);
