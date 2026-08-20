alter table public.categories
add column if not exists sort_order integer;

with defaults(name, sort_order) as (
  values
    ('Food & Drink', 1),
    ('Groceries', 2),
    ('Transport', 3),
    ('Bills & Utilities', 4),
    ('Residential', 5),
    ('Subscription', 6),
    ('Shopping', 7),
    ('Health', 8),
    ('Personal Care', 9),
    ('Entertainment', 10),
    ('Travel', 11),
    ('Education', 12),
    ('Music Project', 13),
    ('Business', 14),
    ('Other', 15)
)
update public.categories
set sort_order = defaults.sort_order
from defaults
where categories.name = defaults.name
  and categories.parent_category_id is null
  and categories.type = 'expense';

with child_defaults(parent_name, child_name, sort_order) as (
  values
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
    ('Bills & Utilities', 'Internet & CableTV', 3),
    ('Bills & Utilities', 'Mobile Phone & Data', 4),
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
    ('Entertainment', 'Movies', 1),
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
    ('Other', 'Miscellaneous', 1)
)
update public.categories children
set sort_order = child_defaults.sort_order
from child_defaults
join public.categories parents
  on parents.name = child_defaults.parent_name
 and parents.parent_category_id is null
 and parents.type = 'expense'
where children.parent_category_id = parents.id
  and children.user_profile_id = parents.user_profile_id
  and children.name = child_defaults.child_name
  and children.type = 'expense';

with ordered_categories as (
  select
    id,
    row_number() over (
      partition by user_profile_id, type, parent_category_id
      order by name
    ) + 1000 as next_sort_order
  from public.categories
  where sort_order is null
)
update public.categories
set sort_order = ordered_categories.next_sort_order
from ordered_categories
where categories.id = ordered_categories.id;

alter table public.categories
alter column sort_order set default 0;

create index if not exists categories_sort_order_idx
on public.categories (user_profile_id, type, parent_category_id, sort_order);

notify pgrst, 'reload schema';
