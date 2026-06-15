-- Dompet Daily development data reset.
-- Run manually in the Supabase SQL editor only when you want a clean dev database.
-- This keeps schema, policies, triggers, functions, and storage buckets.
-- It deletes app records and Supabase Auth users.
-- Storage files must be deleted separately through the Supabase Storage UI/API.

begin;

-- Delete app-owned data. Most child rows cascade from user_profiles, but these
-- explicit deletes make the reset clear and safe if constraints change later.
delete from public.receipt_items;
delete from public.receipts;
delete from public.imported_transactions;
delete from public.statement_imports;
delete from public.upcoming_due;
delete from public.transactions;
delete from public.project_tags;
delete from public.categories;
delete from public.accounts;
delete from public.user_profiles;

-- Delete Supabase Auth users, including any dummy/dev users.
-- auth.identities and auth sessions are normally cascade-linked to auth.users.
delete from auth.users;

notify pgrst, 'reload schema';

commit;
