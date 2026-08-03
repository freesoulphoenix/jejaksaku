alter table public.receipts
add column if not exists thumbnail_url text;

alter table public.receipts
add column if not exists thumbnail_storage_path text;
