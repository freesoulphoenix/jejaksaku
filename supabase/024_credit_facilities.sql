alter table public.accounts
add column if not exists credit_limit numeric,
add column if not exists credit_alert_enabled boolean not null default true,
add column if not exists credit_alert_threshold numeric not null default 75,
add column if not exists billing_day integer,
add column if not exists payment_due_day integer;

alter table public.accounts
drop constraint if exists accounts_type_check;

alter table public.accounts
add constraint accounts_type_check
check (type in ('Cash', 'Bank', 'E-Wallet', 'Credit Card', 'PayLater', 'Loan', 'Investment'));

alter table public.accounts
drop constraint if exists accounts_credit_limit_check,
add constraint accounts_credit_limit_check
check (credit_limit is null or credit_limit >= 0);

alter table public.accounts
drop constraint if exists accounts_credit_alert_threshold_check,
add constraint accounts_credit_alert_threshold_check
check (credit_alert_threshold >= 1 and credit_alert_threshold <= 100);

alter table public.accounts
drop constraint if exists accounts_billing_day_check,
add constraint accounts_billing_day_check
check (billing_day is null or billing_day between 1 and 31);

alter table public.accounts
drop constraint if exists accounts_payment_due_day_check,
add constraint accounts_payment_due_day_check
check (payment_due_day is null or payment_due_day between 1 and 31);

alter table public.transactions
add column if not exists financial_activity text not null default 'standard';

alter table public.transactions
drop constraint if exists transactions_financial_activity_check;

alter table public.transactions
add constraint transactions_financial_activity_check
check (financial_activity in (
  'standard',
  'purchase',
  'payment',
  'refund',
  'fee',
  'cash_advance',
  'installment'
));

alter table public.imported_transactions
add column if not exists financial_activity text not null default 'standard';

alter table public.imported_transactions
drop constraint if exists imported_transactions_financial_activity_check;

alter table public.imported_transactions
add constraint imported_transactions_financial_activity_check
check (financial_activity in (
  'standard',
  'purchase',
  'payment',
  'refund',
  'fee',
  'cash_advance',
  'installment'
));

