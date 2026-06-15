alter table public.categories
add column if not exists parent_category_id uuid references public.categories(id) on delete cascade;

create index if not exists categories_parent_category_id_idx
on public.categories (parent_category_id);

update public.categories categories
set name = 'Residential'
where categories.name = 'Apartment'
  and categories.type = 'expense'
  and not exists (
    select 1
    from public.categories existing
    where existing.user_profile_id = categories.user_profile_id
      and existing.name = 'Residential'
      and existing.type = categories.type
  );

create or replace function public.seed_dompetdaily_defaults_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_profile_id, name, type)
  values
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

  insert into public.categories (user_profile_id, name, type)
  values
    (new.id, 'Food & Drink', 'expense'),
    (new.id, 'Groceries', 'expense'),
    (new.id, 'Transport', 'expense'),
    (new.id, 'Bills & Utilities', 'expense'),
    (new.id, 'Residential', 'expense'),
    (new.id, 'Subscription', 'expense'),
    (new.id, 'Shopping', 'expense'),
    (new.id, 'Health', 'expense'),
    (new.id, 'Personal Care', 'expense'),
    (new.id, 'Entertainment', 'expense'),
    (new.id, 'Travel', 'expense'),
    (new.id, 'Education', 'expense'),
    (new.id, 'Music Project', 'expense'),
    (new.id, 'Business', 'expense'),
    (new.id, 'Other', 'expense')
  on conflict (user_profile_id, name, type) do nothing;

  insert into public.categories (user_profile_id, name, type, parent_category_id)
  select new.id, defaults.child_name, 'expense', parents.id
  from (values
    ('Food & Drink', 'Dining Out'),
    ('Food & Drink', 'Coffee & Snacks'),
    ('Food & Drink', 'Delivery'),
    ('Groceries', 'Household Groceries'),
    ('Groceries', 'Fresh Produce'),
    ('Transport', 'Fuel'),
    ('Transport', 'Ride Hailing'),
    ('Transport', 'Public Transport'),
    ('Transport', 'Parking & Tolls'),
    ('Transport', 'Vehicle Maintenance'),
    ('Bills & Utilities', 'Electricity'),
    ('Bills & Utilities', 'Water'),
    ('Bills & Utilities', 'Internet & Phone'),
    ('Bills & Utilities', 'Residential Maintenance'),
    ('Bills & Utilities', 'Residential Utilities Package'),
    ('Residential', 'Rent'),
    ('Residential', 'Mortgage'),
    ('Residential', 'Repairs & Furnishing'),
    ('Subscription', 'Apps & Software'),
    ('Subscription', 'Media Streaming'),
    ('Subscription', 'Cloud Storage'),
    ('Shopping', 'Clothing'),
    ('Shopping', 'Gadgets'),
    ('Shopping', 'Home Goods'),
    ('Shopping', 'Hobbies'),
    ('Health', 'Doctor & Medicine'),
    ('Health', 'Fitness'),
    ('Health', 'Insurance'),
    ('Personal Care', 'Grooming'),
    ('Personal Care', 'Skincare'),
    ('Personal Care', 'Laundry'),
    ('Entertainment', 'Movies & Events'),
    ('Entertainment', 'Books'),
    ('Entertainment', 'Weekend Fun'),
    ('Entertainment', 'Leisure'),
    ('Travel', 'Flight'),
    ('Travel', 'Hotel'),
    ('Travel', 'Local Transport'),
    ('Travel', 'Activities'),
    ('Education', 'Course'),
    ('Education', 'Books & Learning'),
    ('Education', 'Certification'),
    ('Music Project', 'Gear'),
    ('Music Project', 'Studio'),
    ('Music Project', 'Distribution'),
    ('Music Project', 'Promotion'),
    ('Business', 'Supplies'),
    ('Business', 'Client Meals'),
    ('Business', 'Tools & Services'),
    ('Other', 'Miscellaneous')
  ) as defaults(parent_name, child_name)
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

insert into public.categories (user_profile_id, name, type)
select profiles.id, defaults.name, 'expense'
from public.user_profiles profiles
cross join (values
  ('Food & Drink'),
  ('Groceries'),
  ('Transport'),
  ('Bills & Utilities'),
  ('Residential'),
  ('Subscription'),
  ('Shopping'),
  ('Health'),
  ('Personal Care'),
  ('Entertainment'),
  ('Travel'),
  ('Education'),
  ('Music Project'),
  ('Business'),
  ('Other')
) as defaults(name)
on conflict (user_profile_id, name, type) do nothing;

insert into public.categories (user_profile_id, name, type, parent_category_id)
select profiles.id, defaults.child_name, 'expense', parents.id
from public.user_profiles profiles
cross join (values
  ('Food & Drink', 'Dining Out'),
  ('Food & Drink', 'Coffee & Snacks'),
  ('Food & Drink', 'Delivery'),
  ('Groceries', 'Household Groceries'),
  ('Groceries', 'Fresh Produce'),
  ('Transport', 'Fuel'),
  ('Transport', 'Ride Hailing'),
  ('Transport', 'Public Transport'),
  ('Transport', 'Parking & Tolls'),
  ('Transport', 'Vehicle Maintenance'),
  ('Bills & Utilities', 'Electricity'),
  ('Bills & Utilities', 'Water'),
  ('Bills & Utilities', 'Internet & Phone'),
  ('Bills & Utilities', 'Residential Maintenance'),
  ('Bills & Utilities', 'Residential Utilities Package'),
  ('Residential', 'Rent'),
  ('Residential', 'Mortgage'),
  ('Residential', 'Repairs & Furnishing'),
  ('Subscription', 'Apps & Software'),
  ('Subscription', 'Media Streaming'),
  ('Subscription', 'Cloud Storage'),
  ('Shopping', 'Clothing'),
  ('Shopping', 'Gadgets'),
  ('Shopping', 'Home Goods'),
  ('Shopping', 'Hobbies'),
  ('Health', 'Doctor & Medicine'),
  ('Health', 'Fitness'),
  ('Health', 'Insurance'),
  ('Personal Care', 'Grooming'),
  ('Personal Care', 'Skincare'),
  ('Personal Care', 'Laundry'),
  ('Entertainment', 'Movies & Events'),
  ('Entertainment', 'Books'),
  ('Entertainment', 'Weekend Fun'),
  ('Entertainment', 'Leisure'),
  ('Travel', 'Flight'),
  ('Travel', 'Hotel'),
  ('Travel', 'Local Transport'),
  ('Travel', 'Activities'),
  ('Education', 'Course'),
  ('Education', 'Books & Learning'),
  ('Education', 'Certification'),
  ('Music Project', 'Gear'),
  ('Music Project', 'Studio'),
  ('Music Project', 'Distribution'),
  ('Music Project', 'Promotion'),
  ('Business', 'Supplies'),
  ('Business', 'Client Meals'),
  ('Business', 'Tools & Services'),
  ('Other', 'Miscellaneous')
) as defaults(parent_name, child_name)
join public.categories parents
  on parents.user_profile_id = profiles.id
 and parents.name = defaults.parent_name
 and parents.type = 'expense'
 and parents.parent_category_id is null
on conflict (user_profile_id, name, type) do nothing;

update public.project_tags
set name = 'Residential'
where name = 'Apartment';

notify pgrst, 'reload schema';
