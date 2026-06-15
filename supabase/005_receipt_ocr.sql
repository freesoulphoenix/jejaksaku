alter table public.receipts
alter column processing_status set default 'pending';

alter table public.receipts
drop constraint if exists receipts_processing_status_check;

alter table public.receipts
add constraint receipts_processing_status_check check (
  processing_status in ('pending', 'processing', 'completed', 'failed')
);
