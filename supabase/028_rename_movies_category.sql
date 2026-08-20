update public.categories old_category
set name = 'Movies',
    sort_order = 1
where old_category.name = 'Movies & Events'
  and old_category.type = 'expense'
  and not exists (
    select 1
    from public.categories existing_category
    where existing_category.user_profile_id = old_category.user_profile_id
      and existing_category.name = 'Movies'
      and existing_category.type = 'expense'
  );

update public.transactions transaction
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Movies'
 and replacement.type = 'expense'
where transaction.category_id = old_category.id
  and old_category.name = 'Movies & Events'
  and old_category.type = 'expense';

update public.upcoming_due due_item
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Movies'
 and replacement.type = 'expense'
where due_item.category_id = old_category.id
  and old_category.name = 'Movies & Events'
  and old_category.type = 'expense';

update public.imported_transactions imported_transaction
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Movies'
 and replacement.type = 'expense'
where imported_transaction.category_id = old_category.id
  and old_category.name = 'Movies & Events'
  and old_category.type = 'expense';

delete from public.categories
where name = 'Movies & Events'
  and type = 'expense';

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.seed_dompetdaily_defaults_for_profile()'::regprocedure)
  into function_definition;

  function_definition := replace(
    function_definition,
    '(''Entertainment'', ''Movies & Events'', 1)',
    '(''Entertainment'', ''Movies'', 1)'
  );

  execute function_definition;
end;
$$;
