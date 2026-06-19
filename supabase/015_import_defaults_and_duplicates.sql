alter table public.statement_imports
add column if not exists file_size bigint;

alter table public.statement_imports
add column if not exists file_hash text;

create index if not exists statement_imports_file_hash_idx
on public.statement_imports (user_profile_id, file_hash)
where file_hash is not null;

create index if not exists statement_imports_file_fingerprint_idx
on public.statement_imports (user_profile_id, file_name, file_size, bank_name)
where file_size is not null;

create or replace function public.seed_dompetdaily_defaults_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_profile_id, name, type)
  values
    (new.id, 'Cash', 'Cash'),
    (new.id, 'BCA', 'Bank'),
    (new.id, 'BRI', 'Bank'),
    (new.id, 'Mandiri', 'Bank'),
    (new.id, 'BNI', 'Bank'),
    (new.id, 'Jago', 'Bank'),
    (new.id, 'GoPay', 'E-Wallet'),
    (new.id, 'OVO', 'E-Wallet'),
    (new.id, 'ShopeePay', 'E-Wallet'),
    (new.id, 'DANA', 'E-Wallet'),
    (new.id, 'LinkAja', 'E-Wallet')
  on conflict (user_profile_id, name) do nothing;

  insert into public.categories (user_profile_id, name, type, sort_order)
  values
    (new.id, 'Food & Drink', 'expense', 1),
    (new.id, 'Groceries', 'expense', 2),
    (new.id, 'Transport', 'expense', 3),
    (new.id, 'Bills & Utilities', 'expense', 4),
    (new.id, 'Residential', 'expense', 5),
    (new.id, 'Subscription', 'expense', 6),
    (new.id, 'Shopping', 'expense', 7),
    (new.id, 'Health', 'expense', 8),
    (new.id, 'Personal Care', 'expense', 9),
    (new.id, 'Entertainment', 'expense', 10),
    (new.id, 'Travel', 'expense', 11),
    (new.id, 'Education', 'expense', 12),
    (new.id, 'Music Project', 'expense', 13),
    (new.id, 'Business', 'expense', 14),
    (new.id, 'Other', 'expense', 15),
    (new.id, 'Insurance', 'expense', 16),
    (new.id, 'Family', 'expense', 17)
  on conflict (user_profile_id, name, type) do nothing;

  insert into public.categories (user_profile_id, name, type, parent_category_id, sort_order)
  select new.id, defaults.child_name, 'expense', parents.id, defaults.sort_order
  from (values
    ('Food & Drink', 'Dining Out', 1),
    ('Food & Drink', 'Coffee & Snacks', 2),
    ('Food & Drink', 'Delivery', 3),
    ('Groceries', 'Household Groceries', 1),
    ('Groceries', 'Fresh Produce', 2),
    ('Transport', 'Fuel', 1),
    ('Transport', 'Ride Hailing', 2),
    ('Transport', 'Public Transport', 3),
    ('Transport', 'Parking & Tolls', 4),
    ('Transport', 'Vehicle Maintenance', 5),
    ('Bills & Utilities', 'Electricity', 1),
    ('Bills & Utilities', 'Water', 2),
    ('Bills & Utilities', 'Internet & Phone', 3),
    ('Bills & Utilities', 'Residential Maintenance', 4),
    ('Bills & Utilities', 'Residential Utilities Package', 5),
    ('Residential', 'Rent', 1),
    ('Residential', 'Mortgage', 2),
    ('Residential', 'Repairs & Furnishing', 3),
    ('Subscription', 'Apps & Software', 1),
    ('Subscription', 'Media Streaming', 2),
    ('Subscription', 'Cloud Storage', 3),
    ('Shopping', 'Clothing', 1),
    ('Shopping', 'Gadgets', 2),
    ('Shopping', 'Home Goods', 3),
    ('Shopping', 'Hobbies', 4),
    ('Health', 'Doctor & Medicine', 1),
    ('Health', 'Fitness', 2),
    ('Health', 'Insurance', 3),
    ('Personal Care', 'Grooming', 1),
    ('Personal Care', 'Skincare', 2),
    ('Personal Care', 'Laundry', 3),
    ('Entertainment', 'Movies & Events', 1),
    ('Entertainment', 'Books', 2),
    ('Entertainment', 'Weekend Fun', 3),
    ('Entertainment', 'Leisure', 4),
    ('Travel', 'Flight', 1),
    ('Travel', 'Hotel', 2),
    ('Travel', 'Local Transport', 3),
    ('Travel', 'Activities', 4),
    ('Education', 'Course', 1),
    ('Education', 'Books & Learning', 2),
    ('Education', 'Certification', 3),
    ('Music Project', 'Gear', 1),
    ('Music Project', 'Studio', 2),
    ('Music Project', 'Distribution', 3),
    ('Music Project', 'Promotion', 4),
    ('Business', 'Supplies', 1),
    ('Business', 'Client Meals', 2),
    ('Business', 'Tools & Services', 3),
    ('Other', 'Miscellaneous', 1),
    ('Insurance', 'Life Insurance', 1),
    ('Insurance', 'Health Insurance', 2),
    ('Family', 'Parent Support', 1),
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
    (new.id, 'Daily Life'),
    (new.id, 'Residential'),
    (new.id, 'Music'),
    (new.id, 'Business'),
    (new.id, 'Travel'),
    (new.id, 'Running'),
    (new.id, 'Family'),
    (new.id, 'Other')
  on conflict (user_profile_id, name) do nothing;

  return new;
end;
$$;

insert into public.accounts (user_profile_id, name, type)
select profiles.id, 'Cash', 'Cash'
from public.user_profiles profiles
on conflict (user_profile_id, name) do nothing;

insert into public.categories (user_profile_id, name, type, sort_order)
select profiles.id, defaults.name, 'expense', defaults.sort_order
from public.user_profiles profiles
cross join (values
  ('Insurance', 16),
  ('Family', 17)
) as defaults(name, sort_order)
on conflict (user_profile_id, name, type) do nothing;

insert into public.categories (user_profile_id, name, type, parent_category_id, sort_order)
select profiles.id, defaults.child_name, 'expense', parents.id, defaults.sort_order
from public.user_profiles profiles
cross join (values
  ('Insurance', 'Life Insurance', 1),
  ('Insurance', 'Health Insurance', 2),
  ('Family', 'Parent Support', 1),
  ('Family', 'Kids Education', 2)
) as defaults(parent_name, child_name, sort_order)
join public.categories parents
  on parents.user_profile_id = profiles.id
 and parents.name = defaults.parent_name
 and parents.type = 'expense'
 and parents.parent_category_id is null
on conflict (user_profile_id, name, type) do nothing;

notify pgrst, 'reload schema';
