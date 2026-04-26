# Architecture

## Overview

Thai Study is a hosted SaaS application with one important local dependency: the user's own Anki instance.

- `frontend/`: Next.js app router UI plus route-handler proxy layer
- `backend/`: FastAPI service for Thai-language logic, user-scoped study data, and flashcard payload generation
- production database: hosted multi-user persistence
- local Anki: user-owned desktop app, not a server dependency

## Product boundary

Thai Study is a hosted web product:

- users access the app through the web
- users authenticate before using saved features
- study history, preferences, and export history are user-scoped
- billing and plan enforcement happen in the hosted product

Anki stays local:

- the product does not run as a local-first desktop app
- the hosted backend must not assume it can reach a user's `127.0.0.1:8765`
- any live export to Anki must happen through a client-side bridge

## Frontend responsibilities

- load a YouTube video and transcript
- use TranscriptAPI as the current hosted transcript source, while keeping transcript rendering/source handling inside the frontend route layer
- cache successful transcript provider fetches through the frontend server layer to reduce repeat provider spend
- render the study workspace
- handle word clicks and phrase selection
- show translation, pronunciation, and tone-teaching UI
- open the flashcard review dialog
- call backend endpoints through Next route handlers
- manage signed-in user state
- coordinate local-Anki connection checks and export UX
- own the live localhost transport to AnkiConnect or a future local bridge

## Backend responsibilities

- authenticate requests and enforce user ownership
- build contextual translation responses
- query and parse `thai-language.com`
- generate pronunciation and tone metadata
- build flashcard payloads and export metadata
- persist user-scoped study history, preferences, and export records
- expose billing-aware and plan-aware API behavior

The backend is not responsible for talking directly to a user's local Anki instance in production.
The backend is also the only intended application access layer for persisted user data. Supabase Auth and Postgres sit underneath it; the frontend should not directly query user tables.

## Main data flows

### Translation

1. User clicks a transcript word in `frontend/app/page.tsx`
2. Frontend calls `frontend/app/api/contextual-translation/route.ts`
3. Route handler proxies to `backend /api/contextual-translation`
4. Backend returns:
   - dictionary suggestions
   - pronunciation
   - tone metadata
   - example sentences
   - flashcard preview scaffold

### Study history

1. Signed-in user opens a video or clicks a word
2. Frontend posts user-scoped events through `frontend/app/api/study/*`
3. Backend validates identity and ownership
4. Backend stores study activity in the hosted database
5. Frontend reads recent videos, words, and export status for that user only

### Flashcard preparation

1. User reviews the flashcard dialog
2. Frontend uses the translation response and study/quota state to prepare the export payload
3. Frontend sends the payload to the user's local Anki bridge
4. Frontend reports successful exports back to the backend so hosted history stays accurate

### Anki export

1. User initiates export from the hosted web app
2. Frontend attempts to reach the user's local bridge directly
3. Current local-development bridge is direct browser access to AnkiConnect on `127.0.0.1:8765`
4. Bridge returns success, duplicate, or failure details to the frontend
5. Frontend reports the outcome to the backend so the user's export history stays accurate

`Local bridge` may mean:

- direct browser access to AnkiConnect, which is the current local-development path
- a browser extension
- a small desktop companion app

The production architecture must treat this as a client-side integration concern, not a server-to-server integration.

## Persistence

### Current local development persistence

Current local development falls back to SQLite when `DATABASE_URL` is not set:

- location: `backend/.data/study.sqlite3`

Current tables:

- `video_activity`
- `word_activity`
- `video_word_activity`
- `anki_exports`

This is acceptable for local development only.

### Production persistence target

Production needs a hosted multi-user database with:

- user table / identity mapping
- user-owned study history
- user-owned export history
- user-owned preferences and settings
- billing / plan references as needed

No user should be able to read or mutate another user's data through API calls.

The backend now prefers `DATABASE_URL` for study storage, so the application contract can stay stable while local development and hosted deployments use different database backends.

Hosted schema changes should be tracked explicitly in `supabase/migrations/`. Postgres schema creation should not depend on backend startup side effects.

## Frontend route-handler structure

Shared proxy helper:

- `frontend/app/api/_lib/backend-proxy.ts`

Shared frontend service/config helpers:

- `frontend/lib/config/`
- `frontend/lib/ops/server-log.ts`

Proxy groups:

- `frontend/app/api/study/*`
- `frontend/app/api/contextual-translation/route.ts`

Special routes:

- `frontend/app/api/transcript/route.ts`
- `frontend/app/api/video-metadata/route.ts`
- `frontend/app/api/dictionary-audio/route.ts`

As production work progresses, route handlers must become auth-aware and pass user identity safely to backend services.

## Production requirements

### Authentication and authorization

- signed-in access for persisted features
- server-side authorization checks on user-scoped routes
- no trust in client-only gating

### Billing

- paid-plan support
- plan checks at the backend boundary where needed
- clear separation between authentication and subscription state

### Security

- environment-driven CORS and service configuration
- rate limiting and abuse protection
- safe handling of third-party fetch failures and timeouts
- clear data retention and deletion rules

Current groundwork:

- backend-owned app-data purge exists at `DELETE /api/account/data`
- purge removes study history, export history, preferences, and plan-state rows
- minimal account metadata remains in `app_users` until final legal/account-closure policy is defined

### Reliability and observability

- structured logs
- error monitoring
- dependency-aware health checks
- CI for linting, type-checking, tests, and builds

Current frontend observability groundwork:

- transcript provider fetches and provider failures log through `frontend/lib/ops/server-log.ts`
- backend proxy transport failures log through the same surface
- auth sign-in, sign-up, Google OAuth start, and callback exchange failures now emit structured server-side events

## Important constraints

- The repo uses a newer/nonstandard Next.js version. Read local docs in `frontend/node_modules/next/dist/docs/` before making framework-level assumptions.
- The product should not become a second spaced-repetition app. Anki remains the review system; Thai Study remains the preparation and export workspace.
- Production Anki export cannot depend on the hosted backend reaching localhost on the user's machine.
- There is no official public YouTube transcript API for arbitrary public videos, so hosted transcript fetching currently uses a TranscriptAPI-backed route.
