begin;

alter table public.transactions
  add column if not exists merged_into_id uuid references public.transactions(id) on delete cascade,
  add column if not exists posting_date date;
alter table public.imported_transactions
  add column if not exists input_currency text,
  add column if not exists exchange_rate numeric,
  add column if not exists posting_date date;

create table public.purchase_reviews (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  first_transaction_id uuid not null references public.transactions(id) on delete cascade,
  second_transaction_id uuid references public.transactions(id) on delete cascade,
  decision text not null check (decision in ('keep_both', 'linked')),
  first_before jsonb,
  second_before jsonb,
  first_after jsonb,
  source_before jsonb,
  due_ids uuid[],
  parent_review_id uuid references public.purchase_reviews(id) on delete cascade,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.purchase_reviews enable row level security;
create policy "Users manage purchase reviews" on public.purchase_reviews for all
using (exists (select 1 from public.user_profiles p where p.id = user_profile_id and p.auth_user_id = auth.uid()))
with check (exists (select 1 from public.user_profiles p where p.id = user_profile_id and p.auth_user_id = auth.uid()));
create index purchase_reviews_profile_idx on public.purchase_reviews(user_profile_id);
create index transactions_active_purchase_idx on public.transactions(user_profile_id, transaction_date) where merged_into_id is null;

-- Both historical reconciliation and incoming-source linking are atomic.
create or replace function public.link_same_purchase(keep_id uuid, other_id uuid default null, incoming jsonb default null, selected_fields jsonb default '{}'::jsonb, separate_ids uuid[] default '{}'::uuid[])
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  owner_id uuid; a public.transactions; b public.transactions; result_row public.transactions;
  review_id uuid; source_row jsonb; due_list uuid[]; field_name text; av text; bv text;
begin
  select id into owner_id from public.user_profiles where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in to link purchases.'; end if;
  if keep_id = other_id then raise exception 'Choose two different entries.'; end if;
  perform id from public.transactions where id in (keep_id, other_id) and user_profile_id = owner_id order by id for update;
  select * into a from public.transactions where id = keep_id and user_profile_id = owner_id and merged_into_id is null;
  if a.id is null then raise exception 'The existing purchase is unavailable. Refresh and try again.'; end if;
  if a.account_id is null then raise exception 'Assign an account to the existing purchase before linking.'; end if;
  if exists (select 1 from unnest(separate_ids) s(id) where not exists (select 1 from public.transactions t where t.id = s.id and t.user_profile_id = owner_id and t.merged_into_id is null) or s.id in (keep_id, other_id)) then raise exception 'A reviewed purchase is unavailable.'; end if;
  if other_id is not null then
    select * into b from public.transactions where id = other_id and user_profile_id = owner_id and merged_into_id is null;
    if b.id is null then raise exception 'The second purchase is unavailable. Refresh and try again.'; end if;
  else
    b := jsonb_populate_record(null::public.transactions, incoming);
    b.id := null;
    b.user_profile_id := owner_id;
  end if;
  if a.transaction_type = 'transfer' or b.transaction_type = 'transfer' or a.transaction_type is distinct from b.transaction_type
    or (a.account_id is not null and b.account_id is not null and a.account_id <> b.account_id)
    or coalesce(a.original_currency, a.primary_currency) is distinct from coalesce(b.original_currency, b.primary_currency)
    or abs(coalesce(a.original_amount, a.amount) - coalesce(b.original_amount, b.amount)) >= 0.005
    or coalesce(b.original_amount, b.amount, 0) <= 0
    or abs(a.transaction_date - b.transaction_date) > 3 or b.transaction_date is null then
    raise exception 'These entries do not describe compatible purchases.';
  end if;
  if (a.receipt_id is not null and b.receipt_id is not null) or (a.imported_transaction_id is not null and b.imported_transaction_id is not null) then
    raise exception 'This purchase already has a record from that source.';
  end if;
  foreach field_name in array array['description','category_id','project_tag_id','notes','financial_activity'] loop
    av := nullif(to_jsonb(a)->>field_name, ''); bv := nullif(to_jsonb(b)->>field_name, '');
    if av is not null and bv is not null and av <> bv and not (selected_fields ? field_name) then
      raise exception 'Choose which % to keep.', field_name;
    end if;
    if selected_fields ? field_name and selected_fields->>field_name is distinct from av and selected_fields->>field_name is distinct from bv then
      raise exception 'Choose a value from one of the entries.';
    end if;
  end loop;
  if b.receipt_id is not null and not exists (select 1 from public.receipts where id = b.receipt_id and user_profile_id = owner_id) then raise exception 'Receipt unavailable.'; end if;
  if coalesce(a.imported_transaction_id, b.imported_transaction_id) is not null then
    select to_jsonb(i) into source_row from public.imported_transactions i where id = coalesce(a.imported_transaction_id, b.imported_transaction_id) and user_profile_id = owner_id for update;
    if source_row is null then raise exception 'Statement entry unavailable.'; end if;
    if other_id is null and b.imported_transaction_id is not null and (source_row->>'created_transaction_id' is not null or source_row->>'import_status' in ('imported','duplicate')) then raise exception 'Statement entry is already linked.'; end if;
  end if;
  if other_id is null and b.receipt_id is not null and exists (select 1 from public.transactions where receipt_id = b.receipt_id) then raise exception 'Receipt is already linked.'; end if;
  if coalesce((selected_fields->>'category_id')::uuid, a.category_id, b.category_id) is not null and not exists (
    select 1 from public.categories where id = coalesce((selected_fields->>'category_id')::uuid, a.category_id, b.category_id) and user_profile_id = owner_id
  ) then raise exception 'Category unavailable.'; end if;
  if coalesce((selected_fields->>'project_tag_id')::uuid, a.project_tag_id, b.project_tag_id) is not null and not exists (
    select 1 from public.project_tags where id = coalesce((selected_fields->>'project_tag_id')::uuid, a.project_tag_id, b.project_tag_id) and user_profile_id = owner_id
  ) then raise exception 'Project tag unavailable.'; end if;

  if other_id is not null then
    select array_agg(id) into due_list from public.upcoming_due where paid_transaction_id = b.id and user_profile_id = owner_id;
    update public.upcoming_due set paid_transaction_id = a.id where id = any(due_list) and user_profile_id = owner_id;
    update public.transactions set merged_into_id = a.id, receipt_id = null, imported_transaction_id = null where id = b.id and user_profile_id = owner_id;
    update public.accounts set balance = coalesce(balance, 0) + case when b.transaction_type = 'expense' then 1 else -1 end * abs(coalesce(b.account_amount, b.amount))
      where id = b.account_id and user_profile_id = owner_id;
  end if;
  update public.transactions set
    receipt_id = coalesce(a.receipt_id, b.receipt_id), imported_transaction_id = coalesce(a.imported_transaction_id, b.imported_transaction_id),
    description = coalesce(selected_fields->>'description', nullif(a.description, ''), b.description),
    category_id = coalesce((selected_fields->>'category_id')::uuid, a.category_id, b.category_id),
    project_tag_id = coalesce((selected_fields->>'project_tag_id')::uuid, a.project_tag_id, b.project_tag_id),
    notes = coalesce(selected_fields->>'notes', nullif(a.notes, ''), b.notes),
    financial_activity = coalesce(selected_fields->>'financial_activity', a.financial_activity, b.financial_activity)
  where id = a.id and user_profile_id = owner_id returning * into result_row;
  if coalesce(a.imported_transaction_id, b.imported_transaction_id) is not null then
    update public.imported_transactions set created_transaction_id = a.id, import_status = 'duplicate'
    where id = coalesce(a.imported_transaction_id, b.imported_transaction_id) and user_profile_id = owner_id;
  end if;
  insert into public.purchase_reviews(user_profile_id, first_transaction_id, second_transaction_id, decision, first_before, second_before, first_after, source_before, due_ids)
  values (owner_id, a.id, other_id, 'linked', to_jsonb(a), to_jsonb(b), to_jsonb(result_row), source_row, due_list) returning id into review_id;
  insert into public.purchase_reviews(user_profile_id, first_transaction_id, second_transaction_id, decision, parent_review_id)
    select owner_id, a.id, id, 'keep_both', review_id from (select distinct unnest(separate_ids) id) s;
  return review_id;
end;
$$;

create or replace function public.undo_purchase_link(review_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare owner_id uuid; r public.purchase_reviews; a public.transactions; b public.transactions; current_row public.transactions;
begin
  select id into owner_id from public.user_profiles where auth_user_id = auth.uid();
  select * into r from public.purchase_reviews where id = review_id and user_profile_id = owner_id and decision = 'linked' and undone_at is null for update;
  if r.id is null then raise exception 'This link is unavailable or was already undone.'; end if;
  perform id from public.transactions where id in (r.first_transaction_id, r.second_transaction_id) and user_profile_id = owner_id order by id for update;
  select * into current_row from public.transactions where id = r.first_transaction_id and user_profile_id = owner_id;
  if (to_jsonb(current_row) - 'updated_at') is distinct from (r.first_after - 'updated_at') then raise exception 'This purchase has changed. Undo its later changes or links first.'; end if;
  a := jsonb_populate_record(null::public.transactions, r.first_before);
  b := jsonb_populate_record(null::public.transactions, r.second_before);
  if r.second_transaction_id is not null and not exists (select 1 from public.transactions where id = b.id and merged_into_id = a.id and user_profile_id = owner_id) then raise exception 'The linked entry has changed.'; end if;
  update public.transactions set receipt_id = a.receipt_id, imported_transaction_id = a.imported_transaction_id,
    description = a.description, category_id = a.category_id, project_tag_id = a.project_tag_id, notes = a.notes, financial_activity = a.financial_activity
  where id = a.id and user_profile_id = owner_id;
  if r.second_transaction_id is not null then
    update public.transactions set merged_into_id = null, receipt_id = b.receipt_id, imported_transaction_id = b.imported_transaction_id where id = b.id and user_profile_id = owner_id;
    update public.accounts set balance = coalesce(balance, 0) + case when b.transaction_type = 'expense' then -1 else 1 end * abs(coalesce(b.account_amount, b.amount)) where id = b.account_id and user_profile_id = owner_id;
    update public.upcoming_due set paid_transaction_id = b.id where id = any(r.due_ids) and user_profile_id = owner_id;
  end if;
  if r.source_before is not null then
    update public.imported_transactions set created_transaction_id = (r.source_before->>'created_transaction_id')::uuid, import_status = r.source_before->>'import_status'
    where id = (r.source_before->>'id')::uuid and user_profile_id = owner_id;
  end if;
  update public.purchase_reviews set undone_at = now() where id = r.id and user_profile_id = owner_id;
  update public.purchase_reviews set undone_at = now() where parent_review_id = r.id and user_profile_id = owner_id;
end;
$$;

-- Saving Keep Both and adding the expense must succeed or fail together.
create or replace function public.create_reviewed_purchase(transaction_data jsonb, separate_ids uuid[])
returns public.transactions language plpgsql security invoker set search_path = public, pg_temp as $$
declare owner_id uuid; b public.transactions;
begin
  select id into owner_id from public.user_profiles where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in to save purchases.'; end if;
  b := jsonb_populate_record(null::public.transactions, transaction_data || jsonb_build_object('id', gen_random_uuid(), 'user_profile_id', owner_id, 'merged_into_id', null, 'created_at', now(), 'updated_at', now()));
  if b.transaction_type not in ('expense','income') or b.transaction_type is null or b.amount is null or b.amount <= 0 or b.account_amount is null or b.account_amount <= 0 or b.transaction_date is null then raise exception 'Invalid purchase.'; end if;
  if not exists (select 1 from public.accounts where id = b.account_id and user_profile_id = owner_id)
    or not exists (select 1 from public.categories where id = b.category_id and user_profile_id = owner_id)
    or (b.project_tag_id is not null and not exists (select 1 from public.project_tags where id = b.project_tag_id and user_profile_id = owner_id))
    or (b.receipt_id is not null and not exists (select 1 from public.receipts where id = b.receipt_id and user_profile_id = owner_id))
    or (b.imported_transaction_id is not null and not exists (select 1 from public.imported_transactions where id = b.imported_transaction_id and user_profile_id = owner_id)) then raise exception 'Selected account, category or source is unavailable.'; end if;
  if exists (select 1 from unnest(separate_ids) s(id) where not exists (select 1 from public.transactions t where t.id = s.id and t.user_profile_id = owner_id and t.merged_into_id is null)) then raise exception 'A reviewed purchase is unavailable.'; end if;
  insert into public.transactions select b.*;
  if b.imported_transaction_id is not null then
    update public.imported_transactions set import_status = 'imported', created_transaction_id = b.id where id = b.imported_transaction_id and user_profile_id = owner_id;
  end if;
  update public.accounts set balance = coalesce(balance, 0) + case when b.transaction_type = 'expense' then -1 else 1 end * b.account_amount where id = b.account_id and user_profile_id = owner_id;
  insert into public.purchase_reviews(user_profile_id, first_transaction_id, second_transaction_id, decision)
    select owner_id, id, b.id, 'keep_both' from (select distinct unnest(separate_ids) id) s;
  return b;
end;
$$;
revoke all on function public.create_reviewed_purchase(jsonb,uuid[]) from public, anon;
grant execute on function public.create_reviewed_purchase(jsonb,uuid[]) to authenticated;
revoke all on function public.link_same_purchase(uuid,uuid,jsonb,jsonb,uuid[]) from public, anon;
revoke all on function public.undo_purchase_link(uuid) from public, anon;
grant execute on function public.link_same_purchase(uuid,uuid,jsonb,jsonb,uuid[]) to authenticated;
grant execute on function public.undo_purchase_link(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
