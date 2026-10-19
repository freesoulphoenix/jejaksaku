-- Run after 034_merge_purchase_notes.sql. Every fixture and change rolls back.
begin;
do $$
#variable_conflict use_variable
declare
  auth_id uuid := gen_random_uuid(); other_auth uuid := gen_random_uuid();
  profile_id uuid := gen_random_uuid(); other_profile uuid := gen_random_uuid();
  account_id uuid := gen_random_uuid(); category_a uuid := gen_random_uuid(); category_b uuid := gen_random_uuid();
  receipt_id uuid := gen_random_uuid(); statement_id uuid := gen_random_uuid(); imported_id uuid := gen_random_uuid();
  first_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid(); foreign_id uuid := gen_random_uuid();
  review_id uuid; selected jsonb; incoming jsonb; balance_before numeric; rejected boolean; kept public.transactions;
begin
  insert into auth.users(id, email) values (auth_id, auth_id || '@example.invalid'), (other_auth, other_auth || '@example.invalid');
  select id into profile_id from public.user_profiles where auth_user_id = auth_id;
  select id into other_profile from public.user_profiles where auth_user_id = other_auth;
  insert into public.accounts(id, user_profile_id, name, type, balance, currency_code) values (account_id, profile_id, 'Regression card', 'Bank', -226400, 'IDR');
  insert into public.categories(id, user_profile_id, name, type) values (category_a, profile_id, 'Regression groceries', 'expense'), (category_b, profile_id, 'Regression essentials', 'expense');
  insert into public.receipts(id, user_profile_id, merchant_name, receipt_date, total_amount) values (receipt_id, profile_id, 'Ranch Market', '2026-05-27', 113200);
  insert into public.statement_imports(id, user_profile_id, file_name, file_type) values (statement_id, profile_id, 'regression.csv', 'csv');
  insert into public.imported_transactions(id, user_profile_id, statement_import_id, transaction_date, description, amount, import_status, created_transaction_id)
    values (imported_id, profile_id, statement_id, '2026-05-27', 'RANCH MARKET LOTTE JKT', 113200, 'pending', null);
  insert into public.transactions(id, user_profile_id, account_id, category_id, receipt_id, imported_transaction_id, transaction_type, amount, account_amount, primary_currency, transaction_date, description)
    values (first_id, profile_id, account_id, category_a, receipt_id, null, 'expense', 113200, 113200, 'IDR', '2026-05-27', 'Weekly groceries'),
           (second_id, profile_id, account_id, category_b, null, imported_id, 'expense', 113200, 113200, 'IDR', '2026-05-27', 'RANCH MARKET LOTTE JKT'),
           (foreign_id, other_profile, null, null, null, null, 'expense', 113200, null, 'IDR', '2026-05-27', 'Foreign fixture');
  update public.imported_transactions set import_status = 'imported', created_transaction_id = second_id where id = imported_id;
  update public.transactions set notes = 'Receipt note' where id = first_id;
  update public.transactions set notes = 'Statement note' where id = second_id;
  perform set_config('request.jwt.claim.sub', auth_id::text, true);
  execute 'set local role authenticated';

  if public.merge_purchase_notes(E'  Same\r\nNote  ', E'Same\nNote') is distinct from E'Same\nNote' then raise exception 'FAIL: identical notes duplicated'; end if;
  if public.merge_purchase_notes(null, 'Only note') is distinct from 'Only note' then raise exception 'FAIL: single note lost'; end if;
  if public.merge_purchase_notes(E' \n\t', null) is not null then raise exception 'FAIL: blank notes'; end if;

  if exists (select 1 from public.transactions where id = foreign_id) then raise exception 'FAIL: transaction RLS'; end if;
  selected := jsonb_build_object('description', 'Weekly groceries', 'category_id', category_a);
  rejected := false;
  begin perform public.link_same_purchase(first_id, second_id); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: conflicting category/description accepted without selection'; end if;
  if (select balance from public.accounts where id = account_id) <> -226400 then raise exception 'FAIL: rejected link changed balance'; end if;

  review_id := public.link_same_purchase(first_id, second_id, null, selected);
  if (select count(*) from public.transactions where user_profile_id = profile_id and merged_into_id is null) <> 1 then raise exception 'FAIL: historical expenses counted twice'; end if;
  if not exists (select 1 from public.transactions where id = first_id and transactions.receipt_id = receipt_id and imported_transaction_id = imported_id and category_id = category_a) then raise exception 'FAIL: source or selected category lost'; end if;
  if (select balance from public.accounts where id = account_id) <> -113200 then raise exception 'FAIL: historical balance correction'; end if;
  if not exists (select 1 from public.imported_transactions where id = imported_id and created_transaction_id = first_id and import_status = 'duplicate') then raise exception 'FAIL: statement not linked'; end if;
  if (select second_before->>'description' from public.purchase_reviews where id = review_id) <> 'RANCH MARKET LOTTE JKT' then raise exception 'FAIL: source history lost'; end if;
  if (select notes from public.transactions where id = first_id) is distinct from E'Receipt note\n\nStatement note' then raise exception 'FAIL: historical notes not combined'; end if;
  if (select first_before->>'notes' from public.purchase_reviews where id = review_id) <> 'Receipt note' or (select second_before->>'notes' from public.purchase_reviews where id = review_id) <> 'Statement note' then raise exception 'FAIL: original notes lost from history'; end if;

  update public.transactions set notes = 'Later user edit' where id = first_id;
  rejected := false;
  begin perform public.undo_purchase_link(review_id); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: Undo overwrote a later edit'; end if;
  update public.transactions set notes = E'Receipt note\n\nStatement note' where id = first_id;
  perform public.undo_purchase_link(review_id);
  if (select count(*) from public.transactions where user_profile_id = profile_id and merged_into_id is null) <> 2 then raise exception 'FAIL: Undo did not restore both expenses'; end if;
  if (select balance from public.accounts where id = account_id) <> -226400 then raise exception 'FAIL: Undo balance'; end if;
  if (select notes from public.transactions where id = first_id) is distinct from 'Receipt note' or (select notes from public.transactions where id = second_id) is distinct from 'Statement note' then raise exception 'FAIL: Undo did not restore original notes'; end if;
  if not exists (select 1 from public.imported_transactions where id = imported_id and created_transaction_id = second_id and import_status = 'imported') then raise exception 'FAIL: Undo statement state'; end if;

  -- The statement may be the surviving entry, with the receipt arriving later.
  review_id := public.link_same_purchase(second_id, first_id, null, selected || '{"notes":"Receipt note"}'::jsonb);
  if (select notes from public.transactions where id = second_id) is distinct from E'Statement note\n\nReceipt note' then raise exception 'FAIL: old client notes choice discarded a note'; end if;
  if not exists (select 1 from public.transactions where id = second_id and transactions.receipt_id = receipt_id and imported_transaction_id = imported_id) then raise exception 'FAIL: reverse-order linking'; end if;
  perform public.undo_purchase_link(review_id);

  -- Incoming statement: no second expense or balance movement is created.
  delete from public.transactions where id = second_id;
  update public.accounts set balance = -113200 where id = account_id;
  update public.imported_transactions set import_status = 'pending', created_transaction_id = null where id = imported_id;
  incoming := jsonb_build_object('account_id', account_id, 'category_id', category_b, 'imported_transaction_id', imported_id, 'transaction_type', 'expense', 'amount', 113200, 'primary_currency', 'IDR', 'transaction_date', '2026-05-27', 'description', 'RANCH MARKET LOTTE JKT', 'financial_activity', 'standard');
  incoming := incoming || '{"notes":"Incoming statement note"}'::jsonb;
  review_id := public.link_same_purchase(first_id, null, incoming, selected);
  if (select count(*) from public.transactions where user_profile_id = profile_id and merged_into_id is null) <> 1 then raise exception 'FAIL: incoming link created an expense'; end if;
  if (select balance from public.accounts where id = account_id) <> -113200 then raise exception 'FAIL: incoming link changed balance'; end if;
  if (select notes from public.transactions where id = first_id) is distinct from E'Receipt note\n\nIncoming statement note' then raise exception 'FAIL: incoming notes not combined'; end if;
  rejected := false;
  begin perform public.link_same_purchase(first_id, null, incoming, selected); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: source linked twice'; end if;
  perform public.undo_purchase_link(review_id);
  if not exists (select 1 from public.imported_transactions where id = imported_id and import_status = 'pending' and created_transaction_id is null) then raise exception 'FAIL: incoming Undo did not restore pending source'; end if;
  if (select notes from public.transactions where id = first_id) is distinct from 'Receipt note' then raise exception 'FAIL: incoming Undo did not restore notes'; end if;

  rejected := false;
  begin perform public.link_same_purchase(foreign_id, first_id, null, selected); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: cross-user link accepted'; end if;
  rejected := false;
  begin perform public.link_same_purchase(first_id, null, incoming || '{"amount":113201}'::jsonb, selected); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: amount mismatch accepted'; end if;
  rejected := false;
  begin perform public.link_same_purchase(first_id, null, incoming || '{"primary_currency":"USD"}'::jsonb, selected); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: currency mismatch accepted'; end if;

  -- Keep Both saves the new purchase, source state, balance and decision together.
  kept := public.create_reviewed_purchase(incoming || '{"account_amount":113200}'::jsonb, array[first_id]);
  if (select count(*) from public.transactions where user_profile_id = profile_id and merged_into_id is null) <> 2 then raise exception 'FAIL: Keep Both did not retain both purchases'; end if;
  if (select balance from public.accounts where id = account_id) <> -226400 then raise exception 'FAIL: Keep Both balance'; end if;
  if not exists (select 1 from public.purchase_reviews where user_profile_id = profile_id and decision = 'keep_both') then raise exception 'FAIL: Keep Both not saved'; end if;
  if not exists (select 1 from public.imported_transactions where id = imported_id and created_transaction_id = kept.id and import_status = 'imported') then raise exception 'FAIL: Keep Both source state'; end if;
  rejected := false;
  begin perform public.create_reviewed_purchase(incoming || '{"account_amount":113200}'::jsonb, array[first_id]); exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: same source record inserted twice'; end if;
  if (select balance from public.accounts where id = account_id) <> -226400 then raise exception 'FAIL: failed re-import changed balance'; end if;
  rejected := false;
  begin insert into public.purchase_reviews(user_profile_id, first_transaction_id, second_transaction_id, decision) values (other_profile, first_id, kept.id, 'keep_both'); exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'FAIL: purchase review RLS'; end if;
  execute 'reset role';
end;
$$;
rollback;
