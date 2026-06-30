alter table public.user_profiles
add column if not exists default_account_id uuid;

alter table public.user_profiles
drop constraint if exists user_profiles_default_account_id_fkey;

alter table public.user_profiles
add constraint user_profiles_default_account_id_fkey
foreign key (default_account_id) references public.accounts(id) on delete set null;

create index if not exists user_profiles_default_account_id_idx
on public.user_profiles (default_account_id);

with ranked_accounts as (
  select distinct on (accounts.user_profile_id)
    accounts.user_profile_id,
    accounts.id
  from public.accounts accounts
  order by
    accounts.user_profile_id,
    case
      when accounts.name = 'Cash' then 0
      when accounts.type = 'Cash' then 1
      when accounts.type = 'Bank' then 2
      when accounts.type = 'E-Wallet' then 3
      else 4
    end,
    coalesce(accounts.sort_order, 999999),
    accounts.name
)
update public.user_profiles profiles
set default_account_id = ranked_accounts.id
from ranked_accounts
where profiles.id = ranked_accounts.user_profile_id
  and profiles.default_account_id is null;

notify pgrst, 'reload schema';
