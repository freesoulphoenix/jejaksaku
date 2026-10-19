begin;

-- Keep the notes from both entries; the source snapshots still allow exact Undo.
create or replace function public.merge_purchase_notes(first_notes text, second_notes text)
returns text language sql immutable security invoker set search_path = public, pg_temp as $sql$
  with normalized as (
    select
      nullif(btrim(replace(replace(coalesce(first_notes, ''), E'\r\n', E'\n'), E'\r', E'\n'), E' \t\n\r\f' || chr(11)), '') as a,
      nullif(btrim(replace(replace(coalesce(second_notes, ''), E'\r\n', E'\n'), E'\r', E'\n'), E' \t\n\r\f' || chr(11)), '') as b
  )
  select case when a is null then b when b is null or a = b then a else a || E'\n\n' || b end
  from normalized;
$sql$;
revoke all on function public.merge_purchase_notes(text,text) from public, anon;
grant execute on function public.merge_purchase_notes(text,text) to authenticated;

-- Notes are derived on the server, including for clients that still send a notes choice.
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
  foreach field_name in array array['description','category_id','project_tag_id','financial_activity'] loop
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
    notes = public.merge_purchase_notes(a.notes, b.notes),
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

notify pgrst, 'reload schema';
commit;
