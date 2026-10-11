begin;

-- A bank can have multiple balances with the same name, one per currency.
create unique index if not exists accounts_user_profile_name_currency_idx
  on public.accounts (user_profile_id, name, currency_code);
drop index if exists public.accounts_user_profile_name_idx;

-- Update only the accounts INSERT in the existing seeder. Preserve its current
-- categories, project tags and other defaults, including on repeated runs.
do $$
declare
  definition text;
begin
  if to_regprocedure('public.seed_dompetdaily_defaults_for_profile()') is not null then
    select pg_get_functiondef('public.seed_dompetdaily_defaults_for_profile()'::regprocedure) into definition;
    definition := regexp_replace(definition,
      '(insert[[:space:]]+into[[:space:]]+public[.]accounts[^;]*on[[:space:]]+conflict[[:space:]]*)\([[:space:]]*user_profile_id[[:space:]]*,[[:space:]]*name[[:space:]]*\)',
      '\1(user_profile_id, name, currency_code)', 'i');
    execute definition;
  end if;
end;
$$;

alter table public.transactions
  add column if not exists transfer_exchange_rate numeric,
  add column if not exists transfer_rate_mode text,
  add column if not exists transfer_rate_updated_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_transfer_exchange_rate_check') then
    alter table public.transactions add constraint transactions_transfer_exchange_rate_check
      check (transfer_exchange_rate is null or transfer_exchange_rate > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_transfer_rate_mode_check') then
    alter table public.transactions add constraint transactions_transfer_rate_mode_check
      check (transfer_rate_mode is null or transfer_rate_mode in ('automatic', 'manual'));
  end if;
end;
$$;
commit;
