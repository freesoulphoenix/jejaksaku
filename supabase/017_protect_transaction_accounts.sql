alter table public.transactions
drop constraint if exists transactions_account_id_fkey;

alter table public.transactions
add constraint transactions_account_id_fkey
foreign key (account_id) references public.accounts(id) on delete restrict;

alter table public.transactions
drop constraint if exists transactions_from_account_id_fkey;

alter table public.transactions
add constraint transactions_from_account_id_fkey
foreign key (from_account_id) references public.accounts(id) on delete restrict;

alter table public.transactions
drop constraint if exists transactions_to_account_id_fkey;

alter table public.transactions
add constraint transactions_to_account_id_fkey
foreign key (to_account_id) references public.accounts(id) on delete restrict;

notify pgrst, 'reload schema';
