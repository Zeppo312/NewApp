create extension if not exists pgcrypto;

create or replace function public.set_cycle_tracker_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_cycle_tracker_updated_at() from public, anon, authenticated;

create table public.cycle_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  average_cycle_length smallint,
  average_period_length smallint,
  luteal_phase_length smallint,
  last_period_start_date date,
  last_period_end_date date,
  tracking_goal text not null default 'cycle_health',
  is_postpartum boolean not null default false,
  is_breastfeeding boolean not null default false,
  is_perimenopause boolean not null default false,
  cycle_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycle_settings_average_cycle_length_check
    check (average_cycle_length is null or average_cycle_length between 15 and 60),
  constraint cycle_settings_average_period_length_check
    check (average_period_length is null or average_period_length between 1 and 14),
  constraint cycle_settings_luteal_phase_length_check
    check (luteal_phase_length is null or luteal_phase_length between 8 and 20),
  constraint cycle_settings_period_range_check
    check (
      last_period_start_date is null
      or last_period_end_date is null
      or last_period_end_date >= last_period_start_date
    ),
  constraint cycle_settings_tracking_goal_check
    check (tracking_goal in ('cycle_health', 'trying_to_conceive'))
);

create table public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start_date date not null,
  period_end_date date not null,
  cycle_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycle_periods_user_start_key unique (user_id, period_start_date),
  constraint cycle_periods_range_check check (period_end_date >= period_start_date)
);

create table public.cycle_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  bleeding_intensity text not null default 'none',
  spotting boolean not null default false,
  cervical_mucus text,
  lh_test_result text,
  bbt_celsius numeric(4, 2),
  had_sex boolean not null default false,
  pain_score smallint,
  pms_score smallint,
  symptoms text[] not null default '{}'::text[],
  cycle_notes text,
  sleep_hours numeric(4, 1),
  stress_level smallint,
  illness boolean not null default false,
  travel boolean not null default false,
  alcohol_units numeric(4, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycle_daily_logs_user_date_key unique (user_id, entry_date),
  constraint cycle_daily_logs_bleeding_intensity_check
    check (bleeding_intensity in ('none', 'light', 'medium', 'heavy')),
  constraint cycle_daily_logs_cervical_mucus_check
    check (cervical_mucus is null or cervical_mucus in ('dry', 'sticky', 'creamy', 'watery', 'eggwhite')),
  constraint cycle_daily_logs_lh_test_result_check
    check (lh_test_result is null or lh_test_result in ('negative', 'high', 'peak')),
  constraint cycle_daily_logs_bbt_celsius_check
    check (bbt_celsius is null or bbt_celsius between 34.00 and 42.00),
  constraint cycle_daily_logs_pain_score_check
    check (pain_score is null or pain_score between 0 and 10),
  constraint cycle_daily_logs_pms_score_check
    check (pms_score is null or pms_score between 0 and 10),
  constraint cycle_daily_logs_sleep_hours_check
    check (sleep_hours is null or sleep_hours between 0 and 24),
  constraint cycle_daily_logs_stress_level_check
    check (stress_level is null or stress_level between 0 and 10),
  constraint cycle_daily_logs_alcohol_units_check
    check (alcohol_units is null or alcohol_units between 0 and 50)
);

create index cycle_periods_user_end_idx
  on public.cycle_periods (user_id, period_end_date desc);

create index cycle_daily_logs_bleeding_idx
  on public.cycle_daily_logs (user_id, entry_date desc)
  where bleeding_intensity <> 'none' or spotting = true;

create trigger cycle_settings_set_updated_at
before update on public.cycle_settings
for each row execute function public.set_cycle_tracker_updated_at();

create trigger cycle_periods_set_updated_at
before update on public.cycle_periods
for each row execute function public.set_cycle_tracker_updated_at();

create trigger cycle_daily_logs_set_updated_at
before update on public.cycle_daily_logs
for each row execute function public.set_cycle_tracker_updated_at();

revoke all on public.cycle_settings from anon;
revoke all on public.cycle_periods from anon;
revoke all on public.cycle_daily_logs from anon;

grant select, insert, update, delete on public.cycle_settings to authenticated;
grant select, insert, update, delete on public.cycle_periods to authenticated;
grant select, insert, update, delete on public.cycle_daily_logs to authenticated;

grant select, insert, update, delete on public.cycle_settings to service_role;
grant select, insert, update, delete on public.cycle_periods to service_role;
grant select, insert, update, delete on public.cycle_daily_logs to service_role;

alter table public.cycle_settings enable row level security;
alter table public.cycle_periods enable row level security;
alter table public.cycle_daily_logs enable row level security;

create policy cycle_settings_owner_access
on public.cycle_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy cycle_periods_owner_access
on public.cycle_periods
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy cycle_daily_logs_owner_access
on public.cycle_daily_logs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.cycle_settings is 'User-specific settings and context for cycle predictions.';
comment on table public.cycle_periods is 'Recorded menstrual period ranges used for cycle predictions.';
comment on table public.cycle_daily_logs is 'Daily cycle observations, symptoms, temperature, and fertility signals.';
