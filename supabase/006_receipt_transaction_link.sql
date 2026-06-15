alter table public.transactions
add column if not exists receipt_id uuid references public.receipts(id) on delete set null;

create index if not exists transactions_receipt_id_idx
on public.transactions (receipt_id);

create unique index if not exists transactions_receipt_id_unique_idx
on public.transactions (receipt_id)
where receipt_id is not null;
