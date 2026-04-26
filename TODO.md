# TODO

## Done

- [x] Copy selected word from the right panel
- [x] Add manual context replay for the selected sentence without auto-seeking on every click
- [x] Retrieve contextual translations and example sentences from the backend
- [x] Build a flashcard preview from the selected word and sentence
- [x] Integrate `thai-language.com` lookup for dictionary gloss and isolated audio
- [x] Export reviewed flashcards to Anki via AnkiConnect
- [x] Upload dictionary audio into Anki media when available
- [x] Add lightweight study history for videos, clicks, and exported flashcards
- [x] Add tone-color mode and tone-teaching UI in the transcript
- [x] Track whether the current word/sentence has already been exported to Anki
- [x] Add tone explanation details to exported Anki cards, not just flat tone labels
- [x] Rework the flashcard dialog into a clearer input-vs-preview layout
- [x] Add optional dictionary-audio inclusion to flashcard export
- [x] Add one-click auto-export when Anki is ready and a deck is selected
- [x] Make the sidebar close on action and outside click
- [x] Add a tutorial panel to the landing view so first-time users understand the workflow
- [x] Finish the last flashcard export wording/details polish, including cleaner translation display and clearer auto-export copy
- [x] Rework the UI color system into a stronger design-token layer used across the main app flow
- [x] Improve dictionary/context ranking for harder words and ambiguous entries
- [x] Fix transcript tone popovers so they escape clipping and stay aligned to the hovered word
- [x] Turn the sidebar into a real settings drawer with history, Anki status, deck selection, and persisted theme/tone preferences
- [x] Refine the focus view so meaning, context, pronunciation, and export actions are clearer and selectable alternative meanings flow into flashcard export

## Next

- [~] Adjust the tone UI so color lives in the tone text itself, not in a full colored box; keep stronger box treatment only for the clicked word
- [~] Improve transcript-side syllable segmentation and tone accuracy
- [ ] Decide whether real video clip extraction is worth the added complexity

## Notes

- Auto-export now exists and can skip the review dialog when Anki is connected and a deck is selected; failures fall back to the review dialog.
- The flashcard dialog is much clearer now, but the final wording and small presentation details can still be tightened.
- The sidebar is now a real settings drawer with a separate history section, persisted theme/tone preferences, and a clearer Anki connection block.
- Export now re-checks local Anki availability at export time instead of trusting only the last sidebar refresh.
- The focus view is cleaner now: source context stays visible, alternative meanings are selectable, and only the lightweight `Last checked` retention cue remains.
- Transcript tokenization and tone analysis are better now, but they still need a broader set of hard-word regression tests before that area is truly finished.
- Tone styling is now mostly text-led, but a few focus areas still use stronger containers deliberately.
- Structured operational logs now exist at the frontend route boundary and backend API boundary; metrics, alerting, and dashboards are still missing.

## Prod ready

### Product / architecture decision

- [x] Decide the real target: hosted multi-user product with authentication, paid plans, and user-local Anki.
- [x] Update `ARCHITECTURE.md` to reflect the hosted SaaS model and remove local-first ambiguity.

### SaaS foundation

- [x] Add authentication and require a signed-in user for study history, export history, and settings.
- [x] Keep transcript reading, translation lookup, and tone display usable without an account.
- [x] Gate flashcard creation/export behind an authenticated account boundary.
- [x] Define the free-plan flashcard quota: 20 exports per month.
- [x] Choose the auth stack: Supabase Auth
- [x] Replace SQLite with a production database for hosted multi-user data.
- [x] Add per-user ownership to study history, export history, preferences, and deck selection.
- [ ] Add billing and plan enforcement for paid usage. Paused until legal and policy work is ready.
- [ ] Choose billing stack:
  - Stripe Checkout + Billing Portal
  - Lemon Squeezy

### Anki integration

- [x] Redesign Anki export as a client-side integration; hosted backend must not assume it can reach `127.0.0.1:8765`.
- [~] Validate whether the web app can call local AnkiConnect directly from the browser in real user conditions.
- [ ] If direct browser access is unreliable, choose the bridge strategy:
  - browser extension
  - local desktop companion app
- [ ] Move Anki connectivity assumptions into config instead of hard-coded localhost defaults.
- [ ] Add an explicit degraded mode so the app still works when local Anki is unavailable.
- [ ] Add clear UX for connecting local Anki, testing availability, and recovering from bridge/export failures.

### Accounts and data isolation

- [x] Plan data migration from the current SQLite schema to the hosted production schema.
- [ ] Decide what data is product-critical versus local-only metadata.
- [~] Ensure no user can read or mutate another user's study history, exports, or settings.
- [x] Add backend-owned app-data purge groundwork for study/export/preference data.
- [ ] Decide and document the final legal retention policy for `app_users` after a deletion request.

### Schema and migrations

- [x] Move hosted study-table definitions into `supabase/migrations/`.
- [x] Apply the baseline migration through the Supabase CLI instead of relying on manual dashboard state.
- [~] Add follow-up migrations for user preferences, plan data, and RLS policies.
- [x] Enable RLS on current user-owned Supabase tables with own-row authenticated policies.
- [x] Add an app-owned account table keyed to `auth.users(id)` for backend-managed account metadata.

### Security baseline

- [ ] Move CORS, backend base URLs, Anki integration flags, and secrets to environment-driven config.
- [ ] Add server-side rate limiting for transcript, translation, and export endpoints.
- [ ] Review backend fetch paths and outbound requests so failures, timeouts, and third-party errors are handled safely.
- [~] Define what user data is stored, how long it is retained, and what needs deletion/export support.
- [ ] Add basic abuse protection for public endpoints before exposing the service on the internet.
- [x] Add authorization checks on every user-scoped API route, not just frontend gating.

### Reliability, performance, and monitoring

- [~] Add structured logging for frontend route handlers and backend API requests.
- [ ] Add product metrics for the main study funnel:
  - video opened
  - transcript loaded / transcript unavailable
  - translation requested
  - flashcard generated
  - Anki export attempted / succeeded / failed
- [ ] Define the observability surface:
  - logs
  - metrics
  - alerts
  - dashboard views for hosted maintenance
- [ ] Add error monitoring and alerting.
- [ ] Add health checks that reflect dependencies, not just process up/down.
- [~] Add regression tests for translation, tone analysis, Anki export, and study-history isolation.
- [ ] Add CI for linting, type-checking, backend tests, and production builds.
- [ ] Profile the slow paths: transcript fetch, dictionary scraping, contextual translation, and export flow.
- [ ] Decide what should be cached in production and where cache invalidation matters.

### Hosting

- [x] Pick an initial deployment shape and document it:
  - frontend hosting
  - backend hosting
  - database hosting
  - auth provider
  - billing provider
  - secret management
  - log / metrics provider
- [ ] Validate that the chosen host supports the app's networking needs, Python runtime, and persistent data story.
- [ ] Define environment variables, deploy steps, rollback steps, and backup expectations.
- [ ] Buy and attach a custom domain before paid public launch.

### Transcript strategy

- [x] Validate that direct hosted YouTube transcript extraction is unreliable from the current Vercel path.
- [x] Restore hosted transcript loading via TranscriptAPI as the current provider-backed path.
- [x] Simplify hosted transcript behavior to a single TranscriptAPI-backed source.
- [ ] Decide whether TranscriptAPI remains acceptable for v1 or should be replaced by a self-hosted extraction service.
- [ ] Design a source-agnostic transcript service contract so future providers/sources are not wired directly into the UI model.

### Recommendation

- [ ] Treat v1 production as: hosted authenticated SaaS with local-Anki export validated early and a fallback bridge plan if direct browser access fails.

## Current priorities

- [ ] Keep billing and Stripe work paused until legal documents and policy decisions are ready.
- [ ] Add an account settings surface for account metadata and app-data purge.
- [ ] Move production-sensitive config fully into env-driven settings.
- [ ] Add first-pass hosted observability: core study/export metrics, alertable failures, and one dashboard for maintenance.
- [ ] Choose and attach the long-term product domain before charging users.
- [ ] Validate the production Anki bridge approach from the browser side before going deeper on paid-plan work.
