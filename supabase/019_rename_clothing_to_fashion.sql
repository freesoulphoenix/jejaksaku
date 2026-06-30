with duplicate_pairs as (
  select
    clothing.id as clothing_id,
    fashion.id as fashion_id,
    shopping.id as shopping_id,
    clothing.sort_order as clothing_sort_order
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
update public.categories fashion
set
  parent_category_id = duplicate_pairs.shopping_id,
  sort_order = coalesce(nullif(fashion.sort_order, 0), duplicate_pairs.clothing_sort_order)
from duplicate_pairs
where fashion.id = duplicate_pairs.fashion_id;

with duplicate_pairs as (
  select
    clothing.id as clothing_id,
    fashion.id as fashion_id
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
update public.transactions
set category_id = duplicate_pairs.fashion_id
from duplicate_pairs
where transactions.category_id = duplicate_pairs.clothing_id;

with duplicate_pairs as (
  select
    clothing.id as clothing_id,
    fashion.id as fashion_id
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
update public.upcoming_due
set category_id = duplicate_pairs.fashion_id
from duplicate_pairs
where upcoming_due.category_id = duplicate_pairs.clothing_id;

with duplicate_pairs as (
  select
    clothing.id as clothing_id,
    fashion.id as fashion_id
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
update public.imported_transactions
set category_id = duplicate_pairs.fashion_id
from duplicate_pairs
where imported_transactions.category_id = duplicate_pairs.clothing_id;

with duplicate_pairs as (
  select
    clothing.id as clothing_id,
    fashion.id as fashion_id
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
update public.categories
set parent_category_id = duplicate_pairs.fashion_id
from duplicate_pairs
where categories.parent_category_id = duplicate_pairs.clothing_id;

with duplicate_pairs as (
  select clothing.id as clothing_id
  from public.categories clothing
  join public.categories shopping
    on shopping.id = clothing.parent_category_id
   and shopping.name = 'Shopping'
  join public.categories fashion
    on fashion.user_profile_id = clothing.user_profile_id
   and fashion.type = clothing.type
   and fashion.name = 'Fashion'
  where clothing.name = 'Clothing'
)
delete from public.categories
using duplicate_pairs
where categories.id = duplicate_pairs.clothing_id;

update public.categories clothing
set name = 'Fashion'
from public.categories shopping
where clothing.parent_category_id = shopping.id
  and shopping.name = 'Shopping'
  and clothing.name = 'Clothing'
  and not exists (
    select 1
    from public.categories fashion
    where fashion.user_profile_id = clothing.user_profile_id
      and fashion.type = clothing.type
      and fashion.name = 'Fashion'
  );

notify pgrst, 'reload schema';
