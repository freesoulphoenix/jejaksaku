update public.categories old_category
set name = 'Internet & CableTV',
    sort_order = 3
where old_category.name = 'Internet & Phone'
  and old_category.type = 'expense'
  and not exists (
    select 1
    from public.categories existing_category
    where existing_category.user_profile_id = old_category.user_profile_id
      and existing_category.name = 'Internet & CableTV'
      and existing_category.type = 'expense'
  );

update public.transactions transaction
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Internet & CableTV'
 and replacement.type = 'expense'
where transaction.category_id = old_category.id
  and old_category.name = 'Internet & Phone'
  and old_category.type = 'expense';

update public.upcoming_due due_item
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Internet & CableTV'
 and replacement.type = 'expense'
where due_item.category_id = old_category.id
  and old_category.name = 'Internet & Phone'
  and old_category.type = 'expense';

update public.imported_transactions imported_transaction
set category_id = replacement.id
from public.categories old_category
join public.categories replacement
  on replacement.user_profile_id = old_category.user_profile_id
 and replacement.name = 'Internet & CableTV'
 and replacement.type = 'expense'
where imported_transaction.category_id = old_category.id
  and old_category.name = 'Internet & Phone'
  and old_category.type = 'expense';

delete from public.categories
where name = 'Internet & Phone'
  and type = 'expense';

update public.categories
set sort_order = 3
where name = 'Internet & CableTV'
  and type = 'expense';

insert into public.categories (user_profile_id, name, type, parent_category_id, sort_order)
select profiles.id, 'Mobile Phone & Data', 'expense', parents.id, 4
from public.user_profiles profiles
join public.categories parents
  on parents.user_profile_id = profiles.id
 and parents.name = 'Bills & Utilities'
 and parents.type = 'expense'
 and parents.parent_category_id is null
on conflict (user_profile_id, name, type) do nothing;

update public.categories
set sort_order = 4
where name = 'Mobile Phone & Data'
  and type = 'expense';

delete from public.categories category
where category.name in ('Residential Maintenance', 'Residential Utilities Package')
  and category.type = 'expense'
  and exists (
    select 1
    from public.categories parent
    where parent.id = category.parent_category_id
      and parent.name = 'Bills & Utilities'
  )
  and not exists (select 1 from public.transactions where category_id = category.id)
  and not exists (select 1 from public.upcoming_due where category_id = category.id)
  and not exists (select 1 from public.imported_transactions where category_id = category.id);

create or replace function public.seed_dompetdaily_defaults_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_profile_id, name, type)
  values
    (new.id, 'Cash', 'Cash'), (new.id, 'BCA', 'Bank'), (new.id, 'BRI', 'Bank'),
    (new.id, 'Mandiri', 'Bank'), (new.id, 'BNI', 'Bank'), (new.id, 'Jago', 'Bank'),
    (new.id, 'GoPay', 'E-Wallet'), (new.id, 'OVO', 'E-Wallet'),
    (new.id, 'ShopeePay', 'E-Wallet'), (new.id, 'DANA', 'E-Wallet'),
    (new.id, 'LinkAja', 'E-Wallet')
  on conflict (user_profile_id, name) do nothing;

  insert into public.categories (user_profile_id, name, type, sort_order)
  select new.id, defaults.name, 'expense', defaults.sort_order
  from (values
    ('Food & Drink', 1), ('Groceries', 2), ('Transport', 3),
    ('Bills & Utilities', 4), ('Residential', 5), ('Subscription', 6),
    ('Shopping', 7), ('Health', 8), ('Personal Care', 9),
    ('Entertainment', 10), ('Travel', 11), ('Education', 12),
    ('Music Project', 13), ('Business', 14), ('Other', 15),
    ('Insurance', 16), ('Family', 17)
  ) as defaults(name, sort_order)
  on conflict (user_profile_id, name, type) do nothing;

  insert into public.categories (user_profile_id, name, type, parent_category_id, sort_order)
  select new.id, defaults.child_name, 'expense', parents.id, defaults.sort_order
  from (values
    ('Food & Drink', 'Dining Out', 1), ('Food & Drink', 'Coffee & Snacks', 2),
    ('Food & Drink', 'Delivery', 3), ('Groceries', 'Household Groceries', 1),
    ('Groceries', 'Fresh Produce', 2), ('Transport', 'Fuel', 1),
    ('Transport', 'Ride Hailing', 2), ('Transport', 'Public Transport', 3),
    ('Transport', 'Parking & Tolls', 4), ('Transport', 'Vehicle Maintenance', 5),
    ('Bills & Utilities', 'Electricity', 1), ('Bills & Utilities', 'Water', 2),
    ('Bills & Utilities', 'Internet & CableTV', 3), ('Bills & Utilities', 'Mobile Phone & Data', 4),
    ('Residential', 'Rent', 1), ('Residential', 'Mortgage', 2),
    ('Residential', 'Repairs & Furnishing', 3), ('Subscription', 'Apps & Software', 1),
    ('Subscription', 'Media Streaming', 2), ('Subscription', 'Cloud Storage', 3),
    ('Shopping', 'Fashion', 1), ('Shopping', 'Gadgets', 2),
    ('Shopping', 'Home Goods', 3), ('Shopping', 'Hobbies', 4),
    ('Health', 'Doctor & Medicine', 1), ('Health', 'Fitness', 2),
    ('Health', 'Insurance', 3), ('Personal Care', 'Grooming', 1),
    ('Personal Care', 'Skincare', 2), ('Personal Care', 'Laundry', 3),
    ('Entertainment', 'Movies', 1), ('Entertainment', 'Books', 2),
    ('Entertainment', 'Weekend Fun', 3), ('Entertainment', 'Leisure', 4),
    ('Travel', 'Flight', 1), ('Travel', 'Hotel', 2),
    ('Travel', 'Local Transport', 3), ('Travel', 'Activities', 4),
    ('Education', 'Course', 1), ('Education', 'Books & Learning', 2),
    ('Education', 'Certification', 3), ('Music Project', 'Gear', 1),
    ('Music Project', 'Studio', 2), ('Music Project', 'Distribution', 3),
    ('Music Project', 'Promotion', 4), ('Business', 'Supplies', 1),
    ('Business', 'Client Meals', 2), ('Business', 'Tools & Services', 3),
    ('Other', 'Miscellaneous', 1), ('Insurance', 'Life Insurance', 1),
    ('Insurance', 'Health Insurance', 2), ('Family', 'Parent Support', 1),
    ('Family', 'Kids Education', 2)
  ) as defaults(parent_name, child_name, sort_order)
  join public.categories parents
    on parents.user_profile_id = new.id
   and parents.name = defaults.parent_name
   and parents.type = 'expense'
   and parents.parent_category_id is null
  on conflict (user_profile_id, name, type) do nothing;

  insert into public.project_tags (user_profile_id, name)
  values
    (new.id, 'Daily Life'), (new.id, 'Residential'), (new.id, 'Music'),
    (new.id, 'Business'), (new.id, 'Travel'), (new.id, 'Running'),
    (new.id, 'Family'), (new.id, 'Other')
  on conflict (user_profile_id, name) do nothing;

  return new;
end;
$$;
