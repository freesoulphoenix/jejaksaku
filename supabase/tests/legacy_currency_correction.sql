-- Run with Supabase db query. All fixture records and corrections roll back.
begin;
do $$
declare
  auth_id uuid := gen_random_uuid();
  owner_id uuid;
  source_id uuid := gen_random_uuid();
  destination_id uuid := gen_random_uuid();
  converted_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (auth_id, auth_id::text || '@currency-test.invalid', '{}'::jsonb);
  select id into strict owner_id from public.user_profiles where auth_user_id = auth_id;
  insert into public.accounts (id, user_profile_id, name, type, currency_code, currency_confirmed, balance, opening_balance)
  values (source_id, owner_id, 'Legacy source', 'Bank', 'IDR', false, 100, 105),
    (destination_id, owner_id, 'Legacy destination', 'Bank', 'IDR', false, 200, 190),
    (converted_id, owner_id, 'Explicit currency', 'Bank', 'CNY', true, 50, 55);
  insert into public.transactions (user_profile_id, account_id, transaction_type, amount, primary_currency)
  values (owner_id, source_id, 'expense', 5, 'IDR');
  insert into public.transactions (user_profile_id, account_id, from_account_id, to_account_id, transaction_type, amount, transfer_fee, primary_currency)
  values (owner_id, source_id, source_id, destination_id, 'transfer', 10, 1, 'IDR');
  insert into public.transactions (user_profile_id, account_id, transaction_type, amount, original_currency, original_amount, exchange_rate, account_amount, primary_currency)
  values (owner_id, converted_id, 'expense', 12500, 'CNY', 5, 2500, 5, 'IDR');
  perform set_config('request.jwt.claim.sub', auth_id::text, true);
  perform set_config('currency_test.source', source_id::text, true);
  perform set_config('currency_test.destination', destination_id::text, true);
  perform set_config('currency_test.converted', converted_id::text, true);
end;
$$;

set local role authenticated;
do $$
declare
  source_id uuid := current_setting('currency_test.source')::uuid;
  destination_id uuid := current_setting('currency_test.destination')::uuid;
  converted_id uuid := current_setting('currency_test.converted')::uuid;
  corrected integer;
  expected_failure boolean;
begin
  expected_failure := false;
  begin
    perform public.correct_account_currency_labels(array[source_id], 'CNY');
  exception when others then
    if sqlerrm not like 'Correct both accounts%' then raise; end if;
    expected_failure := true;
  end;
  if not expected_failure then raise exception 'A partial transfer correction must fail.'; end if;

  corrected := public.correct_account_currency_labels(array[source_id, destination_id], 'CNY');
  if corrected <> 2 then raise exception 'Expected two corrected activities.'; end if;
  if (select balance from public.accounts where id = source_id) <> 100
    or (select opening_balance from public.accounts where id = source_id) <> 105
    or (select balance from public.accounts where id = destination_id) <> 200
    or (select sum(amount) from public.transactions where account_id = source_id) <> 15
    or (select sum(transfer_fee) from public.transactions where account_id = source_id) <> 1
    or exists (select 1 from public.transactions where account_id = source_id and primary_currency <> 'CNY')
  then raise exception 'Currency correction must preserve monetary values.'; end if;

  expected_failure := false;
  begin
    perform public.correct_account_currency_labels(array[converted_id], 'USD');
  exception when others then
    if sqlerrm not like 'These activities already have explicit%' then raise; end if;
    expected_failure := true;
  end;
  if not expected_failure then raise exception 'Explicit rates must be protected.'; end if;

  expected_failure := false;
  begin
    perform public.correct_account_currency_labels(array[gen_random_uuid()], 'CNY');
  exception when others then
    if sqlerrm not like 'Selected accounts are unavailable%' then raise; end if;
    expected_failure := true;
  end;
  if not expected_failure then raise exception 'Unavailable accounts must be rejected.'; end if;
end;
$$;
select 'Currency correction, transfer protection, explicit rates and authenticated access passed' as verification;
rollback;
