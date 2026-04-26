# Development

## Local commands

Preferred local workflow:

```bash
./dev.sh start
./dev.sh status
./dev.sh logs
./dev.sh restart
./dev.sh stop
```

Manual checks:

Frontend:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Backend:

```bash
cd backend
python3 -m unittest tests/test_contextual_translation.py tests/test_anki_connect.py tests/test_study_history.py
```

Commit policy:

```bash
./scripts/install-git-hooks.sh
```

This installs a local `commit-msg` hook that enforces the repo's Conventional Commit policy from [RELEASING.md](/home/gauthier/projects/thai-study/RELEASING.md).

Backend runtime env:

- keep `DATABASE_URL` in `backend/.env.local` for local Postgres-backed development
- `./dev.sh start` and `./dev.sh restart` will load `backend/.env.local` automatically
- `backend/.env.example` shows the expected shape

Hosted schema workflow:

- keep remote Postgres schema changes in `supabase/migrations/`
- apply migrations with `npx supabase db push --db-url "$DATABASE_URL"`
- SQLite schema bootstrap remains local-development-only inside `study_history.py`

AnkiConnect local setup:

- browser-direct export requires AnkiConnect to allow the exact frontend origin
- add both `http://localhost:3000` and `http://127.0.0.1:3000` to the AnkiConnect allowed-origins / web-origin config
- allowing only `http://localhost` is not enough, because the browser requires an exact origin match including port

Supabase auth setup:

- local and hosted frontend callback URLs must be present in Supabase Auth URL configuration
- current frontend auth UX is Google OAuth plus email/password
- Google provider setup requires the Google Cloud OAuth redirect URI:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
- if Google auth redirects unexpectedly, check in this order:
  - Google OAuth client redirect URIs
  - Supabase Auth provider config
  - Supabase Auth URL configuration
  - frontend `/auth/callback` route behavior

## Current design principles

- The app is transcript-first.
- The workspace should feel warm, calm, and readable over long sessions.
- Secondary metadata should stay compact.
- Thai Study prepares cards for Anki; it should not duplicate Anki review.

## Codebase notes

### Frontend

- Most UI currently lives in `frontend/app/page.tsx`
- Transcript tone teaching is client-side and heuristic
- Local Anki bridge logic now lives in `frontend/lib/anki/local-bridge.ts`
- Dictionary audio is fetched through `frontend/app/api/dictionary-audio/route.ts` so browser-side Anki export can upload media without third-party CORS blocking
- Backend proxy helpers live in `frontend/app/api/_lib/backend-proxy.ts`
- Supabase SSR helpers now live under `frontend/lib/supabase/`
- `frontend/app/api/_lib/auth.ts` is now Supabase-only for hosted auth
- Auth routes now include `frontend/app/api/auth/sign-in/route.ts`, `sign-up/route.ts`, `google/route.ts`, `sign-out/route.ts`, and `frontend/app/auth/callback/route.ts`
- The dedicated auth UI now lives at `frontend/app/sign-in/page.tsx`

### Backend

- `contextual_translation.py` contains dictionary lookup, pronunciation shaping, and tone metadata
- `anki_connect.py` is now legacy/local-dev transport logic and should not stay on the main export path
- `study_history.py` now prefers Postgres via `DATABASE_URL` and falls back to SQLite for local development
- production work will need to split flashcard payload generation from the local Anki transport layer

## Safe next development directions

- auth and user-scoped persistence groundwork
- local bridge hardening for browser-direct AnkiConnect and future adapter swaps
- UI polish and hierarchy cleanup
- better export-state UX
- stronger translation ranking
- improved tone/syllable accuracy

## Things to avoid

- building an in-app review queue that duplicates Anki
- storing heavy media in the local study database
- adding more UI density without improving clarity
- assuming production can keep server-side localhost AnkiConnect calls
