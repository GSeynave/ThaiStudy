# Thai Study

Thai Study is a transcript-first workspace for learning Thai from YouTube videos.

The target product is a hosted SaaS application with authenticated users, paid plans, and user-local Anki export.

Current flow:
- open a YouTube video
- read the Thai transcript in sync with the player
- click a word or short phrase
- see dictionary-backed translation, pronunciation, tones, and isolated audio
- review a flashcard draft and export it to Anki
- track lightweight study history across videos and clicked words

## Workspace layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js app for the study UI and route-handler proxy layer |
| `backend/` | FastAPI service for translation, dictionary parsing, study history, and flashcard payload generation |
| `dev.sh` | Local helper to start, stop, restart, and inspect frontend/backend processes |

## Quick start

### Option 1: use the helper script

```bash
./dev.sh start
./dev.sh status
./dev.sh logs
```

### Option 2: run services manually

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

For hosted-style persistence, set `DATABASE_URL` for the backend. If it is unset, the backend falls back to the local SQLite file during development.

You can keep backend database settings in `backend/.env.local`. `./dev.sh start` and `./dev.sh restart` will load that file automatically before launching FastAPI. Start from `backend/.env.example`.

Hosted schema changes now live under `supabase/migrations/`. Apply them with the Supabase CLI against your target database instead of relying on backend startup to create Postgres tables.

Set the frontend environment in `frontend/.env.local`:

```bash
BACKEND_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
TRANSCRIPT_API_KEY=your-transcriptapi-key
```

`TRANSCRIPT_API_KEY` is server-only and is used by the frontend transcript route handler. Do not expose it via `NEXT_PUBLIC_*`.

For Supabase auth to work locally, add these redirect URLs in the Supabase dashboard:

- `http://127.0.0.1:3000/auth/callback`
- `http://localhost:3000/auth/callback`

Google sign-in setup also requires enabling the Google provider in Supabase and registering the Supabase auth callback in Google Cloud:

- `https://<your-project-ref>.supabase.co/auth/v1/callback`

For browser-direct Anki export to work locally, AnkiConnect must allow the frontend origin exactly, including port.

Add these allowed origins in your AnkiConnect config:

- `http://127.0.0.1:3000`
- `http://localhost:3000`

If AnkiConnect only allows `http://localhost` without the `:3000` port, the browser will still block the request with a CORS error.

## Main capabilities

### Frontend

- transcript browsing with video sync
- hosted transcript fetch through TranscriptAPI when configured
- word click / phrase selection
- tone-color mode with inline tone teaching tooltips
- flashcard review dialog
- Anki deck selection with last-used deck persistence
- recent video and word activity display
- local Anki connection and export UX
- Supabase hosted auth with Google OAuth and email/password flows
- free-plan flashcard export quota: 20 per month

### Backend

- contextual translation lookup
- `thai-language.com` dictionary parsing
- pronunciation and tone metadata
- flashcard payload generation and export metadata
- current local-development SQLite-backed study history for videos, clicks, and exported flashcards

### Local Anki bridge

- browser-side AnkiConnect checks and deck discovery
- browser-side export using the custom `ThaiStudyBasic` model
- export success/failure still reported back to the backend for hosted study history

## Product direction

Production architecture is intentionally different from the current local-development setup:

- the app is meant to be hosted
- users authenticate and have isolated data
- billing is part of the hosted product
- Anki remains local on the user's machine
- production export must happen through a client-side bridge, not by the hosted backend calling `127.0.0.1`
- hosted transcript fetching currently depends on TranscriptAPI while a longer-term self-hosted or multi-source strategy remains open

## Important docs

- [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md): product intent and UX direction
- [TODO.md](TODO.md): current development backlog
- [ARCHITECTURE.md](ARCHITECTURE.md): system layout and data flow
- [DEVELOPMENT.md](DEVELOPMENT.md): local development notes and conventions
- [DATA_RETENTION.md](DATA_RETENTION.md): current account/data purge behavior and retention notes
- [HOSTING_PREVIEW.md](HOSTING_PREVIEW.md): first hosted preview shape and validation plan
- [DIRECT_ANKI_VALIDATION.md](DIRECT_ANKI_VALIDATION.md): direct-browser AnkiConnect test checklist
- [RELEASING.md](RELEASING.md): pre-v1 versioning and Conventional Commit policy
- [SERVICE_DEPENDENCIES.md](SERVICE_DEPENDENCIES.md): required external services, why they exist, and what still needs replacement
