# Direct Anki Validation

This checklist is for validating the browser-direct AnkiConnect path before choosing a heavier local bridge.

## Goal

Confirm whether the hosted web app can talk directly to local AnkiConnect reliably enough for v1.

Success means:

- browser can reach `http://127.0.0.1:8765`
- deck listing works
- note export works
- duplicate detection works
- failures are understandable

Audio upload is a separate sub-check. The app may still be acceptable if note export works and dictionary audio is the only unreliable piece.

## Preconditions

- Anki desktop is running
- AnkiConnect is installed and enabled
- AnkiConnect is configured to allow:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Thai Study frontend is running
- backend is running for auth, quota, and study-history recording
- user is signed in

## Test matrix

Record results for at least:

| Frontend origin | Browser | Status | Decks | Export | Duplicate detect | Audio upload | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `http://localhost:3000` | Chrome |  |  |  |  |  |  |
| `http://127.0.0.1:3000` | Chrome |  |  |  |  |  |  |
| hosted preview / production-like HTTPS origin | Chrome |  |  |  |  |  |  |
| hosted preview / production-like HTTPS origin | Safari |  |  |  |  |  |  |

Add Firefox only if you expect to support it early.

## Checks

### 1. Connection check

Open the app and confirm the Anki status area:

- reaches `Connected`
- or shows a specific failure message mentioning localhost / HTTPS blocking

Record:

- exact status text
- whether Anki was running
- page origin
- browser

### 2. Deck listing

Confirm:

- deck dropdown populates
- selected deck persists
- no silent failure when Anki is reachable but deck listing fails

### 3. Export note

Pick a word and export a card.

Confirm:

- success message appears
- card is created in the expected deck
- backend history updates

### 4. Duplicate detection

Export the same card again.

Confirm:

- duplicate is detected
- existing note id is shown
- app does not create a second note

### 5. Dictionary audio upload

Use a card where dictionary audio is available and enabled.

Confirm one of:

- audio file is attached in Anki
- or export succeeds with a warning saying the browser could not fetch dictionary audio

If audio fails, record:

- frontend origin
- browser
- whether the audio URL itself loads in the browser

## Decision rule

Keep direct browser access if:

- status, decks, export, and duplicate detection work reliably in your target browsers
- failures are rare and understandable
- HTTPS-hosted pages can still use the flow acceptably

Move to an extension if:

- HTTPS-hosted pages are blocked from reaching local HTTP
- browser behavior is inconsistent
- users would frequently hit opaque localhost or CORS failures

Consider a desktop companion only if:

- extension is still too limited
- or you need stronger media handling, retries, and diagnostics than a page/extension bridge can offer
