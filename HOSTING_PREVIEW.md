# Hosted Preview

This guide defines the first hosted preview shape for Thai Study so we can test browser-direct AnkiConnect from an HTTPS-served app.

## Deployment shape

- frontend hosting: Vercel
- backend hosting: Railway
- database + auth: Supabase
- billing: not part of this preview
- local Anki: browser-direct AnkiConnect

This is intentionally the smallest hosted setup that still exercises the real browser/HTTPS boundary.

## Why this shape

- Vercel is the lowest-friction host for a Next.js frontend.
- Railway is a straightforward host for a small FastAPI service and works well with monorepo root directories.
- Supabase is already the chosen auth/database stack in this repo.

## Important constraint: stable frontend origin

AnkiConnect CORS rules require an exact allowed origin, including protocol, host, and port.

That matters for hosted validation:

- local setup needed exact origins like `http://localhost:3000`
- a changing preview URL means AnkiConnect config must be updated every time the URL changes

So for the first hosted test, prefer a stable frontend URL over an ephemeral per-commit preview URL.

Examples:

- good: one stable Vercel production domain or custom domain used as the test surface
- painful: a new random preview URL on every push

Vercel preview URLs are unique by default. Vercel documents preview aliases and custom domains separately, but the key product constraint here is simpler: pick one stable HTTPS origin for AnkiConnect validation.

## Frontend on Vercel

Create one Vercel project from this repo with:

- root directory: `/frontend`
- framework: Next.js auto-detected

Set environment variables:

- `BACKEND_API_BASE_URL=https://<your-backend-domain>`
- `NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>`
- `TRANSCRIPT_API_KEY=<your-transcriptapi-key>`

After deployment, note the exact frontend origin you want to keep stable.

## Backend on Railway

Create one Railway service from this repo with:

- root directory: `/backend`
- Dockerfile: use the checked-in [backend/Dockerfile](/home/gauthier/projects/thai-study/backend/Dockerfile)

Set environment variables:

- `DATABASE_URL=<supabase-postgres-connection-string>`
- `SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>`

Generate a public Railway domain and use that domain as the frontend `BACKEND_API_BASE_URL`.

## Supabase config

Keep the existing local callback URLs and add the hosted callback URL:

- `https://<your-frontend-domain>/auth/callback`

If you move between multiple hosted frontend domains, Supabase auth callbacks and AnkiConnect allowed origins will both need to stay aligned.

If you enable Google sign-in, also configure the Google OAuth client with this authorized redirect URI:

- `https://<your-project-ref>.supabase.co/auth/v1/callback`

The flow boundary is:

- browser starts Google OAuth through the frontend
- Supabase handles the provider exchange
- Supabase redirects back to the frontend `/auth/callback`
- the frontend callback exchanges the code for the session cookie

## AnkiConnect config for hosted validation

Add the exact hosted frontend origin to AnkiConnect's allowed origins.

Examples:

- `https://thai-study-preview.example.com`
- `https://your-project.vercel.app`

Do not assume a partial hostname is enough. Browser CORS checks require the exact origin.

## Validation checklist

Once the hosted frontend is live:

1. Sign in through Google or email/password and confirm `/api/auth/session` resolves correctly.
2. Confirm transcript and translation still work through the hosted frontend/backend pair.
3. Add the hosted frontend origin to AnkiConnect allowed origins.
4. Confirm Anki status connects from the hosted page.
5. Confirm deck listing works.
6. Export one card successfully.
7. Re-export the same card and confirm duplicate detection.
8. Confirm dictionary audio still uploads through the app proxy path.

Use [DIRECT_ANKI_VALIDATION.md](/home/gauthier/projects/thai-study/DIRECT_ANKI_VALIDATION.md) as the detailed checklist.

## Decision point after hosted test

Keep browser-direct AnkiConnect if:

- hosted HTTPS origin can connect reliably in target browsers
- deck listing and export remain stable
- failures are understandable and supportable

Move to an extension fallback if:

- hosted browsers block localhost access
- browser behavior is too inconsistent
- CORS/origin management becomes too fragile for real users
