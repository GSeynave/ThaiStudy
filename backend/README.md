# Thai Study backend

FastAPI service for:
- contextual Thai translation
- dictionary lookup and isolated audio extraction
- tone/pronunciation metadata
- AnkiConnect export
- study history persistence

## Run locally

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

For local Postgres-backed development, set `DATABASE_URL` before starting the backend, or put it in `backend/.env.local` when using the repo-level `./dev.sh` helper. See `backend/.env.example`.

Protected study/account endpoints also expect backend-side Supabase auth validation config:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

## Main endpoints

- `GET /health`
- `POST /api/contextual-translation`
- `GET /api/anki/status`
- `GET /api/anki/decks`
- `GET /api/anki/self-test`
- `POST /api/anki/export-note`
- `POST /api/study/video-open`
- `GET /api/study/video-history`
- `GET /api/study/words`
- `GET /api/study/quota`
- `GET /api/study/preferences`
- `PUT /api/study/preferences`
- `GET /api/study/plan`
- `GET /api/study/word-stats`
- `POST /api/study/word-click`
- `POST /api/study/anki-exported`
- `GET /api/account`
- `DELETE /api/account/data`

## Auth boundary

Persisted study and account endpoints require the frontend to pass authenticated user context to the backend.

Current contract:

- the Next.js route handlers resolve the active Supabase session
- the frontend proxy forwards the user's bearer access token
- the backend validates that token against Supabase Auth before scoping persisted data
