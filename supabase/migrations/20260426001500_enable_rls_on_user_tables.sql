alter table public.user_video_activity enable row level security;
alter table public.user_word_activity enable row level security;
alter table public.user_video_word_activity enable row level security;
alter table public.user_anki_exports enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_plan_state enable row level security;

drop policy if exists "user_video_activity_select_own" on public.user_video_activity;
create policy "user_video_activity_select_own"
on public.user_video_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_video_activity_insert_own" on public.user_video_activity;
create policy "user_video_activity_insert_own"
on public.user_video_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_video_activity_update_own" on public.user_video_activity;
create policy "user_video_activity_update_own"
on public.user_video_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_word_activity_select_own" on public.user_word_activity;
create policy "user_word_activity_select_own"
on public.user_word_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_word_activity_insert_own" on public.user_word_activity;
create policy "user_word_activity_insert_own"
on public.user_word_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_word_activity_update_own" on public.user_word_activity;
create policy "user_word_activity_update_own"
on public.user_word_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_video_word_activity_select_own" on public.user_video_word_activity;
create policy "user_video_word_activity_select_own"
on public.user_video_word_activity
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_video_word_activity_insert_own" on public.user_video_word_activity;
create policy "user_video_word_activity_insert_own"
on public.user_video_word_activity
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_video_word_activity_update_own" on public.user_video_word_activity;
create policy "user_video_word_activity_update_own"
on public.user_video_word_activity
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_anki_exports_select_own" on public.user_anki_exports;
create policy "user_anki_exports_select_own"
on public.user_anki_exports
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_anki_exports_insert_own" on public.user_anki_exports;
create policy "user_anki_exports_insert_own"
on public.user_anki_exports
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_plan_state_select_own" on public.user_plan_state;
create policy "user_plan_state_select_own"
on public.user_plan_state
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_plan_state_insert_own" on public.user_plan_state;
create policy "user_plan_state_insert_own"
on public.user_plan_state
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);

drop policy if exists "user_plan_state_update_own" on public.user_plan_state;
create policy "user_plan_state_update_own"
on public.user_plan_state
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
