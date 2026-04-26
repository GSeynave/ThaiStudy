alter table public.app_users
  add column if not exists deletion_requested_at text,
  add column if not exists data_purged_at text;
