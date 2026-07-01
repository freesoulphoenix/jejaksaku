insert into public.project_tags (user_profile_id, name)
select profiles.id, 'Subscription'
from public.user_profiles profiles
on conflict (user_profile_id, name) do nothing;

notify pgrst, 'reload schema';
