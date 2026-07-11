update public.transactions
set financial_activity = 'standard'
where financial_activity = 'purchase';

update public.imported_transactions
set financial_activity = 'standard'
where financial_activity = 'purchase';

alter table public.transactions
drop constraint if exists transactions_financial_activity_check;

alter table public.transactions
add constraint transactions_financial_activity_check
check (financial_activity in (
  'standard',
  'payment',
  'refund',
  'fee',
  'cash_advance',
  'installment'
));

alter table public.imported_transactions
drop constraint if exists imported_transactions_financial_activity_check;

alter table public.imported_transactions
add constraint imported_transactions_financial_activity_check
check (financial_activity in (
  'standard',
  'payment',
  'refund',
  'fee',
  'cash_advance',
  'installment'
));
