-- Fixture profile, balances and transactions are all rolled back.
begin;
do $$
declare
  auth_id uuid := gen_random_uuid();
  owner_id uuid;
  source_id uuid := gen_random_uuid();
  destination_id uuid := gen_random_uuid();
  transfer_id uuid := gen_random_uuid();
  duplicate_rejected boolean := false;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (auth_id, auth_id::text || '@same-bank-test.invalid', '{}'::jsonb);
  select id into strict owner_id from public.user_profiles where auth_user_id = auth_id;
  if not exists (select 1 from public.accounts where user_profile_id = owner_id and name = 'BCA') then
    raise exception 'Default accounts must still be seeded.';
  end if;
  insert into public.accounts (id, user_profile_id, name, bank_name, type, currency_code, balance, opening_balance)
  values (source_id, owner_id, 'Bank A', 'Bank A', 'Bank', 'IDR', 1000000, 1000000),
    (destination_id, owner_id, 'Bank A', 'Bank A', 'Bank', 'CNY', 200, 200);
  begin
    insert into public.accounts (user_profile_id, name, type, currency_code)
    values (owner_id, 'Bank A', 'Bank', 'CNY');
  exception when unique_violation then duplicate_rejected := true;
  end;
  if not duplicate_rejected then raise exception 'Duplicate name and currency should be rejected.'; end if;
  insert into public.transactions (id, user_profile_id, account_id, from_account_id, to_account_id, transaction_type,
    amount, primary_currency, original_currency, original_amount, exchange_rate, rate_mode,
    account_amount, destination_amount, transfer_fee, primary_transfer_fee,
    transfer_exchange_rate, transfer_rate_mode, transfer_rate_updated_at)
  values (transfer_id, owner_id, source_id, source_id, destination_id, 'transfer',
    250000, 'IDR', 'IDR', 250000, 1, 'manual',
    250000, 100, 5000, 5000, 0.0004, 'automatic', '2026-10-11 00:00:00+00');
  if (select destination_amount from public.transactions where id = transfer_id) <> 100
    or (select transfer_exchange_rate from public.transactions where id = transfer_id) <> 0.0004
    or (select count(*) from public.accounts where user_profile_id = owner_id and name = 'Bank A') <> 2
  then raise exception 'Same-bank currency balances and rate were not stored correctly.'; end if;

  -- Confirm the account upsert conflict target used by signup remains valid.
  insert into public.accounts (user_profile_id, name, type, currency_code)
  values (owner_id, 'BCA', 'Bank', 'IDR')
  on conflict (user_profile_id, name, currency_code) do nothing;
end;
$$;
select 'Same bank, separate currencies, duplicate protection, saved transfer rates and signup seeding passed' as verification;
rollback;
