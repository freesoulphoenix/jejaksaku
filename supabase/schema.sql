create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  type text not null,
  balance numeric default 0,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint accounts_type_check check (type in ('Cash', 'Bank', 'E-Wallet', 'PayLater', 'Loan', 'Investment'))
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  type text default 'expense',
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
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  project_tag_id uuid references public.project_tags(id) on delete set null,
  transaction_type text not null,
  amount numeric not null,
  description text,
  transaction_date date not null default current_date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint transactions_type_check check (transaction_type in ('expense', 'income', 'transfer'))
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

create index if not exists project_tags_user_profile_id_idx
on public.project_tags (user_profile_id);

create index if not exists transactions_user_profile_id_idx
on public.transactions (user_profile_id);

create index if not exists transactions_transaction_date_idx
on public.transactions (transaction_date);

create index if not exists transactions_account_id_idx
on public.transactions (account_id);

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
