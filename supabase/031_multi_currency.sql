begin;
alter table public.accounts
  add column if not exists currency_code text not null default 'IDR',
  add column if not exists bank_name text;
alter table public.transactions
  add column if not exists primary_currency text not null default 'IDR',
  add column if not exists original_currency text,
  add column if not exists original_amount numeric,
  add column if not exists exchange_rate numeric,
  add column if not exists rate_mode text,
  add column if not exists rate_updated_at timestamptz,
  add column if not exists account_amount numeric,
  add column if not exists destination_amount numeric,
  add column if not exists primary_transfer_fee numeric;
alter table public.transactions add constraint transactions_fx_positive check (
  (exchange_rate is null or exchange_rate > 0) and
  (original_amount is null or original_amount > 0) and
  (account_amount is null or account_amount > 0) and
  (destination_amount is null or destination_amount > 0)
);
alter table public.transactions add constraint transactions_rate_mode check (rate_mode is null or rate_mode in ('automatic', 'manual'));
commit;
