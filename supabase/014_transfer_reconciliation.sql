alter table public.accounts
add column if not exists opening_balance numeric default 0;

alter table public.accounts
add column if not exists last_reconciled_at timestamptz;

update public.accounts
set opening_balance = coalesce(balance, 0)
where opening_balance is null;

alter table public.transactions
add column if not exists from_account_id uuid references public.accounts(id) on delete set null;

alter table public.transactions
add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

alter table public.transactions
add column if not exists transfer_purpose text;

alter table public.transactions
add column if not exists transfer_fee numeric default 0;

alter table public.transactions
add column if not exists money_direction text;

alter table public.transactions
drop constraint if exists transactions_type_check;

alter table public.transactions
add constraint transactions_type_check check (
  transaction_type in ('expense', 'income', 'transfer')
);

alter table public.transactions
drop constraint if exists transactions_money_direction_check;

alter table public.transactions
add constraint transactions_money_direction_check check (
  money_direction is null or money_direction in ('in', 'out')
);

create index if not exists transactions_from_account_id_idx
on public.transactions (from_account_id);

create index if not exists transactions_to_account_id_idx
on public.transactions (to_account_id);

create table if not exists public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  calculated_balance numeric not null default 0,
  reconciled_balance numeric not null default 0,
  difference numeric not null default 0,
  notes text,
  reconciled_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists account_reconciliations_user_profile_id_idx
on public.account_reconciliations (user_profile_id);

create index if not exists account_reconciliations_account_id_idx
on public.account_reconciliations (account_id);

alter table public.account_reconciliations enable row level security;

drop policy if exists "Users manage their account reconciliations" on public.account_reconciliations;
create policy "Users manage their account reconciliations" on public.account_reconciliations
for all
using (
  exists (
    select 1
    from public.user_profiles
    where user_profiles.id = account_reconciliations.user_profile_id
      and user_profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_profiles
    where user_profiles.id = account_reconciliations.user_profile_id
      and user_profiles.auth_user_id = auth.uid()
  )
);

alter table public.imported_transactions
add column if not exists from_account_id uuid references public.accounts(id) on delete set null;

alter table public.imported_transactions
add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

alter table public.imported_transactions
add column if not exists transfer_purpose text;

alter table public.imported_transactions
add column if not exists transfer_fee numeric default 0;

alter table public.imported_transactions
add column if not exists money_direction text;

update public.imported_transactions
set money_direction = case
  when amount < 0 then 'out'
  when amount > 0 then 'in'
  else money_direction
end
where money_direction is null;

alter table public.imported_transactions
drop constraint if exists imported_transactions_money_direction_check;

alter table public.imported_transactions
add constraint imported_transactions_money_direction_check check (
  money_direction is null or money_direction in ('in', 'out')
);

create index if not exists imported_transactions_from_account_id_idx
on public.imported_transactions (from_account_id);

create index if not exists imported_transactions_to_account_id_idx
on public.imported_transactions (to_account_id);

notify pgrst, 'reload schema';
