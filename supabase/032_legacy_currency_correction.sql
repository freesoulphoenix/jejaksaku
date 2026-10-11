begin;

-- Migration 031 had no record of the browser's original currency preference.
-- Mark its inherited IDR labels as unconfirmed, without guessing a replacement.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts'
      and column_name = 'currency_confirmed'
  ) then
    alter table public.accounts add column currency_confirmed boolean not null default true;
    update public.accounts set currency_confirmed = false
    where currency_code = 'IDR' and created_at < '2026-10-11 04:29:59+00'::timestamptz;
  end if;
end;
$$;

-- This corrects labels; it never converts or recalculates monetary values.
-- RLS and explicit profile checks restrict it to the signed-in user's accounts.
create or replace function public.correct_account_currency_labels(account_ids uuid[], target_currency text)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
  requested_count integer;
  corrected_count integer;
begin
  select id into owner_id from public.user_profiles where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in to correct currency labels.'; end if;
  if target_currency not in ('IDR','USD','EUR','GBP','JPY','CNY','SGD','MYR','THB','PHP','VND','KRW','INR','AUD','NZD','CAD','CHF','HKD','TWD','AED','SAR','BRL','MXN','ZAR') or target_currency is null then
    raise exception 'Select a supported currency.';
  end if;
  select count(distinct id) into requested_count from unnest(account_ids) as selected(id);
  if requested_count = 0 or requested_count <> (
    select count(*) from public.accounts where id = any(account_ids) and user_profile_id = owner_id
  ) then raise exception 'Selected accounts are unavailable.'; end if;

  perform id from public.accounts where id = any(account_ids) order by id for update;
  perform id from public.transactions where user_profile_id = owner_id
    and (account_id = any(account_ids) or from_account_id = any(account_ids) or to_account_id = any(account_ids))
    order by id for update;

  if exists (
    select 1 from public.transactions t where t.user_profile_id = owner_id
      and (t.account_id = any(account_ids) or t.from_account_id = any(account_ids) or t.to_account_id = any(account_ids))
      and (t.original_amount is not null or t.exchange_rate is not null or t.account_amount is not null or t.destination_amount is not null)
  ) then raise exception 'These activities already have explicit currency amounts or rates; their currency labels cannot be corrected automatically.'; end if;

  if exists (
    select 1 from public.transactions t
    join public.accounts a on a.id in (t.from_account_id, t.to_account_id)
    where t.user_profile_id = owner_id and t.transaction_type = 'transfer'
      and (t.account_id = any(account_ids) or t.from_account_id = any(account_ids) or t.to_account_id = any(account_ids))
      and not (a.id = any(account_ids)) and a.currency_code <> target_currency
  ) then raise exception 'Correct both accounts connected by a transfer together in Currency Settings.'; end if;

  update public.transactions set primary_currency = target_currency
  where user_profile_id = owner_id
    and (account_id = any(account_ids) or from_account_id = any(account_ids) or to_account_id = any(account_ids));
  get diagnostics corrected_count = row_count;
  update public.accounts set currency_code = target_currency, currency_confirmed = true
  where user_profile_id = owner_id and id = any(account_ids);
  return corrected_count;
end;
$$;

revoke all on function public.correct_account_currency_labels(uuid[], text) from public, anon;
grant execute on function public.correct_account_currency_labels(uuid[], text) to authenticated;
commit;
