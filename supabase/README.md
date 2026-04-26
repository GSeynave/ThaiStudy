# Supabase schema

Hosted Postgres schema changes live in `supabase/migrations/`.

Current baseline:

- `20260425231500_initial_study_schema.sql`
- `20260425235500_add_preferences_and_plan_state.sql`
- `20260426001500_enable_rls_on_user_tables.sql`
- `20260426004500_link_user_tables_to_auth_users.sql`
- `20260426011500_add_app_users_account_table.sql`

This baseline covers the hosted study-storage tables currently used by the backend:

- `user_video_activity`
- `user_word_activity`
- `user_video_word_activity`
- `user_anki_exports`
- `user_preferences`
- `user_plan_state`
- `app_users`

## Applying migrations

With a valid backend `DATABASE_URL`, you can apply repo migrations to the target database with the Supabase CLI:

```bash
npx supabase db push --db-url "$DATABASE_URL"
```

For an already-running project where tables were created during earlier experimentation, reconcile the remote schema carefully before pushing new migrations.

## Current scope

This folder is only the beginning of the hosted schema story. It does not yet include:

- user profile tables
- billing / subscription tables
- any privileged admin or backoffice schema

RLS is now enabled on the current user-owned tables with authenticated-only own-row policies. Follow-up work is still needed for:

- billing-driven plan mutations
- stronger review of backend/service-role access patterns

The current migrations also move the app tables onto `uuid` user keys tied directly to `auth.users`, while still keeping application access under the backend API rather than direct browser-side data access.

`app_users` also carries the current account-closure markers:

- `deletion_requested_at`
- `data_purged_at`
