alter table public.imported_transactions
add column if not exists raw_description text;

alter table public.imported_transactions
add column if not exists clean_description text;

alter table public.imported_transactions
add column if not exists transaction_type text default 'expense';

alter table public.imported_transactions
add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.imported_transactions
add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.imported_transactions
add column if not exists project_tag_id uuid references public.project_tags(id) on delete set null;

alter table public.imported_transactions
add column if not exists notes text;

update public.imported_transactions
set raw_description = coalesce(raw_description, description),
    clean_description = coalesce(clean_description, description),
    transaction_type = case
      when amount < 0 then 'expense'
      when amount > 0 then 'income'
      else coalesce(transaction_type, 'expense')
    end,
    import_status = case
      when import_status = 'selected' then 'pending'
      when import_status = 'matched' then 'duplicate'
      else import_status
    end;

alter table public.imported_transactions
drop constraint if exists imported_transactions_status_check;

alter table public.imported_transactions
add constraint imported_transactions_status_check check (
  import_status in ('pending', 'needs_review', 'ignored', 'imported', 'duplicate')
);

alter table public.imported_transactions
drop constraint if exists imported_transactions_type_check;

alter table public.imported_transactions
add constraint imported_transactions_type_check check (
  transaction_type in ('expense', 'income', 'transfer')
);

create index if not exists imported_transactions_account_id_idx
on public.imported_transactions (account_id);

create index if not exists imported_transactions_import_status_idx
on public.imported_transactions (import_status);

notify pgrst, 'reload schema';
