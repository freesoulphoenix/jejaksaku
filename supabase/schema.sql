create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text not null unique,
  default_account_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  type text not null,
  balance numeric default 0,
  opening_balance numeric default 0,
  last_reconciled_at timestamptz,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint accounts_type_check check (type in ('Cash', 'Bank', 'E-Wallet', 'PayLater', 'Loan', 'Investment'))
);

alter table public.user_profiles
add constraint user_profiles_default_account_id_fkey
foreign key (default_account_id) references public.accounts(id) on delete set null;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  parent_category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  note text,
  type text default 'expense',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_tags (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete restrict,
  from_account_id uuid references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  project_tag_id uuid references public.project_tags(id) on delete set null,
  transaction_type text not null,
  amount numeric not null,
  description text,
  transaction_date date not null default current_date,
  transfer_purpose text,
  transfer_fee numeric default 0,
  money_direction text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint transactions_type_check check (transaction_type in ('expense', 'income', 'transfer')),
  constraint transactions_money_direction_check check (money_direction is null or money_direction in ('in', 'out'))
);

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

create table if not exists public.upcoming_due (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  provider text,
  category_id uuid references public.categories(id) on delete set null,
  payment_account_id uuid references public.accounts(id) on delete set null,
  amount_due numeric not null,
  due_date date not null,
  status text default 'upcoming',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint upcoming_due_status_check check (status in ('upcoming', 'paid', 'overdue'))
);

create unique index if not exists user_profiles_auth_user_id_idx
on public.user_profiles (auth_user_id)
where auth_user_id is not null;

create index if not exists user_profiles_default_account_id_idx
on public.user_profiles (default_account_id);

create unique index if not exists accounts_user_profile_name_idx
on public.accounts (user_profile_id, name);

create unique index if not exists categories_user_profile_name_type_idx
on public.categories (user_profile_id, name, type);

create unique index if not exists project_tags_user_profile_name_idx
on public.project_tags (user_profile_id, name);

create index if not exists accounts_user_profile_id_idx
on public.accounts (user_profile_id);

create index if not exists categories_user_profile_id_idx
on public.categories (user_profile_id);

create index if not exists categories_parent_category_id_idx
on public.categories (parent_category_id);

create index if not exists categories_sort_order_idx
on public.categories (user_profile_id, type, parent_category_id, sort_order);

create index if not exists project_tags_user_profile_id_idx
on public.project_tags (user_profile_id);

create index if not exists transactions_user_profile_id_idx
on public.transactions (user_profile_id);

create index if not exists transactions_transaction_date_idx
on public.transactions (transaction_date);

create index if not exists transactions_account_id_idx
on public.transactions (account_id);

create index if not exists transactions_from_account_id_idx
on public.transactions (from_account_id);

create index if not exists transactions_to_account_id_idx
on public.transactions (to_account_id);

create index if not exists transactions_category_id_idx
on public.transactions (category_id);

create index if not exists transactions_project_tag_id_idx
on public.transactions (project_tag_id);

create index if not exists upcoming_due_user_profile_id_idx
on public.upcoming_due (user_profile_id);

create index if not exists upcoming_due_due_date_idx
on public.upcoming_due (due_date);

create index if not exists upcoming_due_category_id_idx
on public.upcoming_due (category_id);

create index if not exists upcoming_due_payment_account_id_idx
on public.upcoming_due (payment_account_id);

create index if not exists account_reconciliations_user_profile_id_idx
on public.account_reconciliations (user_profile_id);

create index if not exists account_reconciliations_account_id_idx
on public.account_reconciliations (account_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_project_tags_updated_at on public.project_tags;
create trigger set_project_tags_updated_at
before update on public.project_tags
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_upcoming_due_updated_at on public.upcoming_due;
create trigger set_upcoming_due_updated_at
before update on public.upcoming_due
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.project_tags enable row level security;
alter table public.transactions enable row level security;
alter table public.upcoming_due enable row level security;
alter table public.account_reconciliations enable row level security;

drop policy if exists "Development access for user profiles" on public.user_profiles;
create policy "Development access for user profiles" on public.user_profiles
for all
using (true)
with check (true);

drop policy if exists "Development access for accounts" on public.accounts;
create policy "Development access for accounts" on public.accounts
for all
using (true)
with check (true);

drop policy if exists "Development access for categories" on public.categories;
create policy "Development access for categories" on public.categories
for all
using (true)
with check (true);

drop policy if exists "Development access for project tags" on public.project_tags;
create policy "Development access for project tags" on public.project_tags
for all
using (true)
with check (true);

drop policy if exists "Development access for transactions" on public.transactions;
create policy "Development access for transactions" on public.transactions
for all
using (true)
with check (true);

drop policy if exists "Development access for upcoming due" on public.upcoming_due;
create policy "Development access for upcoming due" on public.upcoming_due
for all
using (true)
with check (true);

drop policy if exists "Development access for account reconciliations" on public.account_reconciliations;
create policy "Development access for account reconciliations" on public.account_reconciliations
for all
using (true)
with check (true);

-- Multi-currency balances and immutable transaction rates
begin;
alter table public.accounts
  add column if not exists currency_code text not null default 'IDR',
  add column if not exists bank_name text;
alter table public.transactions
  add column if not exists primary_currency text not null default 'IDR',
  add column if not exists original_currency text,
  add column if not exists original_amount numeric,
  add column if not exists exchange_rate numeric,
  add column if not exists rate_mode text,
  add column if not exists rate_updated_at timestamptz,
  add column if not exists account_amount numeric,
  add column if not exists destination_amount numeric,
  add column if not exists primary_transfer_fee numeric;
-- Columns and constraints may already exist when this migration is rerun.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_fx_positive'
  ) then
    alter table public.transactions add constraint transactions_fx_positive check (
      (exchange_rate is null or exchange_rate > 0) and
      (original_amount is null or original_amount > 0) and
      (account_amount is null or account_amount > 0) and
      (destination_amount is null or destination_amount > 0)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_rate_mode'
  ) then
    alter table public.transactions add constraint transactions_rate_mode
      check (rate_mode is null or rate_mode in ('automatic', 'manual'));
  end if;
end;
$$;
commit;

-- Correction of currency labels inherited from migration 031
begin;

-- Migration 031 had no record of the browser's original currency preference.
-- Mark its inherited IDR labels as unconfirmed, without guessing a replacement.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts'
      and column_name = 'currency_confirmed'
  ) then
    alter table public.accounts add column currency_confirmed boolean not null default true;
    update public.accounts set currency_confirmed = false
    where currency_code = 'IDR' and created_at < '2026-10-11 04:29:59+00'::timestamptz;
  end if;
end;
$$;

-- This corrects labels; it never converts or recalculates monetary values.
-- RLS and explicit profile checks restrict it to the signed-in user's accounts.
create or replace function public.correct_account_currency_labels(account_ids uuid[], target_currency text)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
  requested_count integer;
  corrected_count integer;
begin
  select id into owner_id from public.user_profiles where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in to correct currency labels.'; end if;
  if target_currency not in ('IDR','USD','EUR','GBP','JPY','CNY','SGD','MYR','THB','PHP','VND','KRW','INR','AUD','NZD','CAD','CHF','HKD','TWD','AED','SAR','BRL','MXN','ZAR') or target_currency is null then
    raise exception 'Select a supported currency.';
  end if;
  select count(distinct id) into requested_count from unnest(account_ids) as selected(id);
  if requested_count = 0 or requested_count <> (
    select count(*) from public.accounts where id = any(account_ids) and user_profile_id = owner_id
  ) then raise exception 'Selected accounts are unavailable.'; end if;

  perform id from public.accounts where id = any(account_ids) order by id for update;
  perform id from public.transactions where user_profile_id = owner_id
    and (account_id = any(account_ids) or from_account_id = any(account_ids) or to_account_id = any(account_ids))
    order by id for update;

  if exists (
    select 1 from public.transactions t where t.user_profile_id = owner_id
      and (t.account_id = any(account_ids) or t.from_account_id = any(account_ids) or t.to_account_id = any(account_ids))
      and (t.original_amount is not null or t.exchange_rate is not null or t.account_amount is not null or t.destination_amount is not null)
  ) then raise exception 'These activities already have explicit currency amounts or rates; their currency labels cannot be corrected automatically.'; end if;

  if exists (
    select 1 from public.transactions t
    join public.accounts a on a.id in (t.from_account_id, t.to_account_id)
    where t.user_profile_id = owner_id and t.transaction_type = 'transfer'
      and (t.account_id = any(account_ids) or t.from_account_id = any(account_ids) or t.to_account_id = any(account_ids))
      and not (a.id = any(account_ids)) and a.currency_code <> target_currency
  ) then raise exception 'Correct both accounts connected by a transfer together in Currency Settings.'; end if;

  update public.transactions set primary_currency = target_currency
  where user_profile_id = owner_id
    and (account_id = any(account_ids) or from_account_id = any(account_ids) or to_account_id = any(account_ids));
  get diagnostics corrected_count = row_count;
  update public.accounts set currency_code = target_currency, currency_confirmed = true
  where user_profile_id = owner_id and id = any(account_ids);
  return corrected_count;
end;
$$;

revoke all on function public.correct_account_currency_labels(uuid[], text) from public, anon;
grant execute on function public.correct_account_currency_labels(uuid[], text) to authenticated;
commit;

-- Same bank, separate currency balances and transfer rates
begin;

-- A bank can have multiple balances with the same name, one per currency.
create unique index if not exists accounts_user_profile_name_currency_idx
  on public.accounts (user_profile_id, name, currency_code);
drop index if exists public.accounts_user_profile_name_idx;

-- Update only the accounts INSERT in the existing seeder. Preserve its current
-- categories, project tags and other defaults, including on repeated runs.
do $$
declare
  definition text;
begin
  if to_regprocedure('public.seed_dompetdaily_defaults_for_profile()') is not null then
    select pg_get_functiondef('public.seed_dompetdaily_defaults_for_profile()'::regprocedure) into definition;
    definition := regexp_replace(definition,
      '(insert[[:space:]]+into[[:space:]]+public[.]accounts[^;]*on[[:space:]]+conflict[[:space:]]*)\([[:space:]]*user_profile_id[[:space:]]*,[[:space:]]*name[[:space:]]*\)',
      '\1(user_profile_id, name, currency_code)', 'i');
    execute definition;
  end if;
end;
$$;

alter table public.transactions
  add column if not exists transfer_exchange_rate numeric,
  add column if not exists transfer_rate_mode text,
  add column if not exists transfer_rate_updated_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_transfer_exchange_rate_check') then
    alter table public.transactions add constraint transactions_transfer_exchange_rate_check
      check (transfer_exchange_rate is null or transfer_exchange_rate > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_transfer_rate_mode_check') then
    alter table public.transactions add constraint transactions_transfer_rate_mode_check
      check (transfer_rate_mode is null or transfer_rate_mode in ('automatic', 'manual'));
  end if;
end;
$$;
commit;
