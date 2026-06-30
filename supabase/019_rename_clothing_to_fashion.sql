update public.categories children
set name = 'Fashion'
from public.categories parents
where children.parent_category_id = parents.id
  and parents.name = 'Shopping'
  and children.name = 'Clothing';

notify pgrst, 'reload schema';
