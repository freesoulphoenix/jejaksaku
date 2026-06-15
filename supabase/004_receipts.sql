create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  image_url text,
  merchant_name text,
  receipt_date date,
  total_amount numeric default 0,
  processing_status text default 'uploaded',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint receipts_processing_status_check check (
    processing_status in ('uploaded', 'reviewing', 'processed', 'failed')
  )
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  item_name text,
  quantity numeric default 1,
  unit_price numeric default 0,
  line_total numeric default 0
);

create index if not exists receipts_user_profile_id_idx
on public.receipts (user_profile_id);

create index if not exists receipts_receipt_date_idx
on public.receipts (receipt_date);

create index if not exists receipt_items_receipt_id_idx
on public.receipt_items (receipt_id);

drop trigger if exists set_receipts_updated_at on public.receipts;
create trigger set_receipts_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

drop policy if exists "Development access for receipts" on public.receipts;
create policy "Development access for receipts" on public.receipts
for all
using (true)
with check (true);

drop policy if exists "Development access for receipt items" on public.receipt_items;
create policy "Development access for receipt items" on public.receipt_items
for all
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Development receipt image uploads" on storage.objects;
create policy "Development receipt image uploads" on storage.objects
for insert
with check (bucket_id = 'receipts');

drop policy if exists "Development receipt image reads" on storage.objects;
create policy "Development receipt image reads" on storage.objects
for select
using (bucket_id = 'receipts');

drop policy if exists "Development receipt image deletes" on storage.objects;
create policy "Development receipt image deletes" on storage.objects
for delete
using (bucket_id = 'receipts');
