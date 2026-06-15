create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (auth_user_id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Dompet Daily User'),
    new.email
  )
  on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_auth_user on auth.users;
create trigger create_profile_for_new_auth_user
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

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

do $$
begin
  execute format('drop trigger if exists %I on public.user_profiles', 'seed_' || 'x' || 'pens_defaults_for_profile');
  execute format('drop function if exists public.%I()', 'seed_' || 'x' || 'pens_defaults_for_profile');
end;
$$;
drop trigger if exists seed_dompetdaily_defaults_for_profile on public.user_profiles;
create trigger seed_dompetdaily_defaults_for_profile
after insert on public.user_profiles
for each row execute function public.seed_dompetdaily_defaults_for_profile();

drop policy if exists "Development access for user profiles" on public.user_profiles;
drop policy if exists "Users can select their profile" on public.user_profiles;
create policy "Users can select their profile" on public.user_profiles
for select
using (auth_user_id = auth.uid());

drop policy if exists "Users can insert their profile" on public.user_profiles;
create policy "Users can insert their profile" on public.user_profiles
for insert
with check (auth_user_id = auth.uid());

drop policy if exists "Users can update their profile" on public.user_profiles;
create policy "Users can update their profile" on public.user_profiles
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "Users can delete their profile" on public.user_profiles;
create policy "Users can delete their profile" on public.user_profiles
for delete
using (auth_user_id = auth.uid());

drop policy if exists "Development access for accounts" on public.accounts;
drop policy if exists "Users manage their accounts" on public.accounts;
create policy "Users manage their accounts" on public.accounts
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = accounts.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = accounts.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for categories" on public.categories;
drop policy if exists "Users manage their categories" on public.categories;
create policy "Users manage their categories" on public.categories
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = categories.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = categories.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for project tags" on public.project_tags;
drop policy if exists "Users manage their project tags" on public.project_tags;
create policy "Users manage their project tags" on public.project_tags
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = project_tags.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = project_tags.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for transactions" on public.transactions;
drop policy if exists "Users manage their transactions" on public.transactions;
create policy "Users manage their transactions" on public.transactions
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = transactions.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = transactions.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for upcoming due" on public.upcoming_due;
drop policy if exists "Users manage their upcoming due" on public.upcoming_due;
create policy "Users manage their upcoming due" on public.upcoming_due
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = upcoming_due.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = upcoming_due.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for receipts" on public.receipts;
drop policy if exists "Users manage their receipts" on public.receipts;
create policy "Users manage their receipts" on public.receipts
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = receipts.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = receipts.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for receipt items" on public.receipt_items;
drop policy if exists "Users manage their receipt items" on public.receipt_items;
create policy "Users manage their receipt items" on public.receipt_items
for all
using (exists (
  select 1
  from public.receipts
  join public.user_profiles on user_profiles.id = receipts.user_profile_id
  where receipts.id = receipt_items.receipt_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1
  from public.receipts
  join public.user_profiles on user_profiles.id = receipts.user_profile_id
  where receipts.id = receipt_items.receipt_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for statement imports" on public.statement_imports;
drop policy if exists "Users manage their statement imports" on public.statement_imports;
create policy "Users manage their statement imports" on public.statement_imports
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = statement_imports.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = statement_imports.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development access for imported transactions" on public.imported_transactions;
drop policy if exists "Users manage their imported transactions" on public.imported_transactions;
create policy "Users manage their imported transactions" on public.imported_transactions
for all
using (exists (
  select 1 from public.user_profiles
  where user_profiles.id = imported_transactions.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.user_profiles
  where user_profiles.id = imported_transactions.user_profile_id
    and user_profiles.auth_user_id = auth.uid()
));

drop policy if exists "Development receipt image uploads" on storage.objects;
drop policy if exists "Development receipt image reads" on storage.objects;
drop policy if exists "Development receipt image deletes" on storage.objects;
drop policy if exists "Users manage receipt images" on storage.objects;
create policy "Users manage receipt images" on storage.objects
for all
using (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.user_profiles
    where user_profiles.id::text = (storage.foldername(name))[1]
      and user_profiles.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.user_profiles
    where user_profiles.id::text = (storage.foldername(name))[1]
      and user_profiles.auth_user_id = auth.uid()
  )
);

drop policy if exists "Development statement uploads" on storage.objects;
drop policy if exists "Development statement reads" on storage.objects;
drop policy if exists "Development statement deletes" on storage.objects;
drop policy if exists "Users manage statement files" on storage.objects;
create policy "Users manage statement files" on storage.objects
for all
using (
  bucket_id = 'statements'
  and exists (
    select 1 from public.user_profiles
    where user_profiles.id::text = (storage.foldername(name))[1]
      and user_profiles.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'statements'
  and exists (
    select 1 from public.user_profiles
    where user_profiles.id::text = (storage.foldername(name))[1]
      and user_profiles.auth_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
