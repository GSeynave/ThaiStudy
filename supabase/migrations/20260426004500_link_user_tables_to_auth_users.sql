drop policy if exists "user_video_activity_select_own" on public.user_video_activity;
drop policy if exists "user_video_activity_insert_own" on public.user_video_activity;
drop policy if exists "user_video_activity_update_own" on public.user_video_activity;
drop policy if exists "user_word_activity_select_own" on public.user_word_activity;
drop policy if exists "user_word_activity_insert_own" on public.user_word_activity;
drop policy if exists "user_word_activity_update_own" on public.user_word_activity;
drop policy if exists "user_video_word_activity_select_own" on public.user_video_word_activity;
drop policy if exists "user_video_word_activity_insert_own" on public.user_video_word_activity;
drop policy if exists "user_video_word_activity_update_own" on public.user_video_word_activity;
drop policy if exists "user_anki_exports_select_own" on public.user_anki_exports;
drop policy if exists "user_anki_exports_insert_own" on public.user_anki_exports;
drop policy if exists "user_preferences_select_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;
drop policy if exists "user_plan_state_select_own" on public.user_plan_state;
drop policy if exists "user_plan_state_insert_own" on public.user_plan_state;
drop policy if exists "user_plan_state_update_own" on public.user_plan_state;

alter table public.user_video_activity
  alter column user_id type uuid using user_id::uuid;

alter table public.user_word_activity
  alter column user_id type uuid using user_id::uuid;

alter table public.user_video_word_activity
  alter column user_id type uuid using user_id::uuid;

alter table public.user_anki_exports
  alter column user_id type uuid using user_id::uuid;

alter table public.user_preferences
  alter column user_id type uuid using user_id::uuid;

alter table public.user_plan_state
  alter column user_id type uuid using user_id::uuid;

alter table public.user_video_activity
  drop constraint if exists user_video_activity_user_id_fkey,
  add constraint user_video_activity_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_word_activity
  drop constraint if exists user_word_activity_user_id_fkey,
  add constraint user_word_activity_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_video_word_activity
  drop constraint if exists user_video_word_activity_user_id_fkey,
  add constraint user_video_word_activity_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_anki_exports
  drop constraint if exists user_anki_exports_user_id_fkey,
  add constraint user_anki_exports_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_preferences
  drop constraint if exists user_preferences_user_id_fkey,
  add constraint user_preferences_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.user_plan_state
  drop constraint if exists user_plan_state_user_id_fkey,
  add constraint user_plan_state_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

create policy "user_video_activity_select_own"
on public.user_video_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_video_activity_insert_own"
on public.user_video_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_video_activity_update_own"
on public.user_video_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_word_activity_select_own"
on public.user_word_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_word_activity_insert_own"
on public.user_word_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_word_activity_update_own"
on public.user_word_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_video_word_activity_select_own"
on public.user_video_word_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_video_word_activity_insert_own"
on public.user_video_word_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_video_word_activity_update_own"
on public.user_video_word_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_anki_exports_select_own"
on public.user_anki_exports
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_anki_exports_insert_own"
on public.user_anki_exports
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_plan_state_select_own"
on public.user_plan_state
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_plan_state_insert_own"
on public.user_plan_state
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_plan_state_update_own"
on public.user_plan_state
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
