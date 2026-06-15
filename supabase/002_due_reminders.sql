alter table public.upcoming_due
add column if not exists reminder_days_before integer not null default 2;

alter table public.upcoming_due
add column if not exists reminder_enabled boolean not null default true;

alter table public.upcoming_due
add column if not exists browser_notification_enabled boolean not null default false;

alter table public.upcoming_due
add column if not exists email_notification_enabled boolean not null default false;

alter table public.upcoming_due
add column if not exists recurring_enabled boolean not null default false;

alter table public.upcoming_due
add column if not exists recurring_frequency text;

alter table public.upcoming_due
add column if not exists last_reminded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upcoming_due_recurring_frequency_check'
  ) then
    alter table public.upcoming_due
    add constraint upcoming_due_recurring_frequency_check
    check (recurring_frequency is null or recurring_frequency in ('daily', 'weekly', 'monthly', 'yearly'));
  end if;
end $$;
