with duplicate_pairs as (
  select
    debt.id as debt_id,
    liability.id as liability_id
  from public.categories debt
  join public.categories liability
    on liability.user_profile_id = debt.user_profile_id
   and liability.type = debt.type
   and liability.name = 'Liability'
   and liability.parent_category_id is null
  where debt.name = 'Debt'
    and debt.type = 'expense'
    and debt.parent_category_id is null
)
update public.transactions
set category_id = duplicate_pairs.liability_id
from duplicate_pairs
where transactions.category_id = duplicate_pairs.debt_id;

with duplicate_pairs as (
  select
    debt.id as debt_id,
    liability.id as liability_id
  from public.categories debt
  join public.categories liability
    on liability.user_profile_id = debt.user_profile_id
   and liability.type = debt.type
   and liability.name = 'Liability'
   and liability.parent_category_id is null
  where debt.name = 'Debt'
    and debt.type = 'expense'
    and debt.parent_category_id is null
)
update public.upcoming_due
set category_id = duplicate_pairs.liability_id
from duplicate_pairs
where upcoming_due.category_id = duplicate_pairs.debt_id;

with duplicate_pairs as (
  select
    debt.id as debt_id,
    liability.id as liability_id
  from public.categories debt
  join public.categories liability
    on liability.user_profile_id = debt.user_profile_id
   and liability.type = debt.type
   and liability.name = 'Liability'
   and liability.parent_category_id is null
  where debt.name = 'Debt'
    and debt.type = 'expense'
    and debt.parent_category_id is null
)
update public.imported_transactions
set category_id = duplicate_pairs.liability_id
from duplicate_pairs
where imported_transactions.category_id = duplicate_pairs.debt_id;

with duplicate_pairs as (
  select
    debt.id as debt_id,
    liability.id as liability_id
  from public.categories debt
  join public.categories liability
    on liability.user_profile_id = debt.user_profile_id
   and liability.type = debt.type
   and liability.name = 'Liability'
   and liability.parent_category_id is null
  where debt.name = 'Debt'
    and debt.type = 'expense'
    and debt.parent_category_id is null
)
update public.categories
set parent_category_id = duplicate_pairs.liability_id
from duplicate_pairs
where categories.parent_category_id = duplicate_pairs.debt_id;

with duplicate_pairs as (
  select debt.id as debt_id
  from public.categories debt
  join public.categories liability
    on liability.user_profile_id = debt.user_profile_id
   and liability.type = debt.type
   and liability.name = 'Liability'
   and liability.parent_category_id is null
  where debt.name = 'Debt'
    and debt.type = 'expense'
    and debt.parent_category_id is null
)
delete from public.categories
using duplicate_pairs
where categories.id = duplicate_pairs.debt_id;

update public.categories debt
set name = 'Liability'
where debt.name = 'Debt'
  and debt.type = 'expense'
  and debt.parent_category_id is null
  and not exists (
    select 1
    from public.categories liability
    where liability.user_profile_id = debt.user_profile_id
      and liability.type = debt.type
      and liability.name = 'Liability'
      and liability.parent_category_id is null
  );

notify pgrst, 'reload schema';
