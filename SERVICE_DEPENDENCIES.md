# Service Dependencies

This file tracks the external services Thai Study currently depends on, why each one exists, and whether it is intended to stay long term.

## Active services

### Vercel

- role: hosts the `frontend/` Next.js app
- required for: hosted web UI, frontend route handlers, auth callback surface
- expected to stay: yes for current hosted shape
- risk notes:
  - serverless/cloud execution was not reliable enough for direct YouTube transcript extraction

### Railway

- role: hosts the `backend/` FastAPI service
- required for: translation, study history, account routes, quota handling
- expected to stay: likely for current hosted shape

### Supabase

- role: auth and Postgres-backed persistence
- required for:
  - Google OAuth and email/password auth
  - hosted user-scoped data
  - migrations under `supabase/migrations/`
- expected to stay: yes

### Google Cloud OAuth

- role: Google sign-in provider backing Supabase Auth
- required for: `Connect with Google`
- expected to stay: yes as long as Google sign-in remains part of the product

### TranscriptAPI

- role: hosted transcript provider for YouTube videos
- required for: restoring hosted transcript loading where direct YouTube extraction from Vercel failed
- integration point: `frontend/app/api/transcript/route.ts` via `TRANSCRIPT_API_KEY`
- expected to stay: undecided
- current status:
  - active trial dependency
  - works for the hosted transcript path that previously failed
- risk notes:
  - paid/credit-based service
  - adds third-party dependency for transcript loading
  - may be replaced later by a self-hosted extraction service or another source strategy

### AnkiConnect

- role: user-local flashcard export bridge
- required for: live export to the user's Anki instance
- expected to stay: yes in some local-bridge form
- current shape:
  - direct browser-to-localhost integration
  - requires exact allowed origins in AnkiConnect CORS config

## Near-term decisions still open

### Transcript dependency

Open question:

- keep TranscriptAPI for v1 simplicity
- or replace it with a self-hosted extraction service

Decision pressure:

- cost sensitivity
- third-party dependency tolerance
- future support for more sources than YouTube

### Local bridge evolution

Open question:

- keep direct browser access to AnkiConnect
- or move to extension / companion app if browser behavior becomes too fragile

## Environment variables tied to services

### Frontend

- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `TRANSCRIPT_API_KEY`

### Backend

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
