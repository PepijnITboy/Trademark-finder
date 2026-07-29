-- Unify notification recipients: exclusive mode (threshold | digest) + MONTHLY cadence.
-- Watch visibility threshold stays on watch_settings; emails live only here.

alter table public.notification_recipients
  add column if not exists notify_mode text not null default 'digest'
    check (notify_mode in ('threshold', 'digest'));

alter table public.notification_recipients
  add column if not exists digest_cadence text
    check (digest_cadence is null or digest_cadence in ('DAILY', 'WEEKLY', 'MONTHLY', 'IMMEDIATE'));

alter table public.notification_recipients
  add column if not exists min_score_threshold integer
    check (min_score_threshold is null or (min_score_threshold >= 0 and min_score_threshold <= 100));

-- Backfill from legacy digest_frequency where present.
update public.notification_recipients
set
  notify_mode = 'digest',
  digest_cadence = coalesce(
    case
      when digest_frequency::text in ('DAILY', 'WEEKLY', 'MONTHLY') then digest_frequency::text
      else 'DAILY'
    end,
    'DAILY'
  ),
  min_score_threshold = null
where digest_cadence is null and notify_mode = 'digest';
