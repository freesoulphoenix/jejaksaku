insert into public.categories (user_profile_id, name, type, parent_category_id, sort_order)
select profiles.id, 'Movies', 'expense', entertainment.id, 1
from public.user_profiles profiles
join public.categories entertainment
  on entertainment.user_profile_id = profiles.id
 and entertainment.name = 'Entertainment'
 and entertainment.type = 'expense'
 and entertainment.parent_category_id is null
on conflict (user_profile_id, name, type) do update
set parent_category_id = excluded.parent_category_id,
    sort_order = excluded.sort_order;
