create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at text not null,
  updated_at text not null,
  last_seen_at text not null
);

alter table public.app_users enable row level security;

drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own"
on public.app_users
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "app_users_insert_own" on public.app_users;
create policy "app_users_insert_own"
on public.app_users
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "app_users_update_own" on public.app_users;
create policy "app_users_update_own"
on public.app_users
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);
