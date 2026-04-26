# Data retention

This document describes the current technical data-handling posture of Thai Study before legal and billing work are finalized.

## Current stored user data

Hosted app-owned data currently includes:

- account metadata in `app_users`
- study history in `user_video_activity`
- clicked-word history in `user_word_activity`
- per-video word activity in `user_video_word_activity`
- export records in `user_anki_exports`
- saved preferences in `user_preferences`
- plan state in `user_plan_state`

The backend remains the intended access layer for this data.

## Current purge behavior

The backend now supports `DELETE /api/account/data`.

Current effect:

- deletes hosted study history
- deletes hosted export history
- deletes hosted preferences
- deletes hosted plan-state rows
- keeps a minimal `app_users` row
- marks:
  - `deletion_requested_at`
  - `data_purged_at`

This is intentional. It gives the product a clear app-data purge path without yet deleting the underlying Supabase Auth identity.

## What this does not do yet

The current purge flow does **not**:

- delete the Supabase Auth user
- sign the user out everywhere
- process billing cancellations
- enforce any final legal retention schedule
- produce user-facing export/download artifacts

Those behaviors should be defined once the legal and billing requirements are written.

## Intended near-term policy shape

Until legal policy is finalized, the safest interpretation is:

- app-owned study data is purgeable on request
- minimal account metadata may be retained temporarily for operational/account-closure handling
- billing-related retention should remain paused until Stripe and legal terms are ready
