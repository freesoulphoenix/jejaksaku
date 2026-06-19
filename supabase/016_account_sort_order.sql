alter table public.accounts
add column if not exists sort_order integer;

with ordered_accounts as (
  select
    id,
    row_number() over (
      partition by user_profile_id, type
      order by name
    ) as next_sort_order
  from public.accounts
  where sort_order is null
)
update public.accounts
set sort_order = ordered_accounts.next_sort_order
from ordered_accounts
where accounts.id = ordered_accounts.id;

alter table public.accounts
alter column sort_order set default 0;

create index if not exists accounts_sort_order_idx
on public.accounts (user_profile_id, type, sort_order);

notify pgrst, 'reload schema';
