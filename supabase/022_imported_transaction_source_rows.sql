alter table public.imported_transactions
add column if not exists source_row_number integer;

drop index if exists imported_transactions_unique_source_idx;

create unique index if not exists imported_transactions_unique_source_row_idx
on public.imported_transactions (statement_import_id, source_row_number);

notify pgrst, 'reload schema';
