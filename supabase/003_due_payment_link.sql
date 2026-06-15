alter table public.upcoming_due
add column if not exists paid_transaction_id uuid references public.transactions(id) on delete set null;

alter table public.upcoming_due
add column if not exists paid_at timestamptz;

create index if not exists upcoming_due_paid_transaction_id_idx
on public.upcoming_due (paid_transaction_id);
