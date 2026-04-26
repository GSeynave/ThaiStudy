# Thai Study product direction

## Core goal

Thai Study should help learners study Thai from their own video sources in a calm, welcoming workspace focused on words in context.

The target business is a hosted product:

- users access Thai Study on the web
- users authenticate into their own account
- user data is isolated
- paid plans are part of the model
- Anki remains the learner's own local tool

## Main use cases

1. The learner loads a YouTube video they genuinely want to watch.
2. The learner reads the transcript while following the current spoken segment.
3. The learner clicks a word or selects a short phrase they do not know.
4. The app shows that focused text in context and prepares it for saving.
5. The learner turns it into a clean flashcard and exports it to their own local Anki.

## Product constraints

- Thai Study is not a local-first app.
- The hosted backend cannot directly reach a user's local AnkiConnect.
- Live Anki export must be treated as a client-side integration problem.
- Thai Study should still be useful when Anki is temporarily unavailable.

## Access model

### Free anonymous

- Load a YouTube video
- Read the transcript
- Click words and inspect translation/context
- Use tone display and tone-teaching UI

### Free account

- Saved study history
- Saved preferences
- Export tracking
- Flashcard creation and export behind an account boundary
- 20 flashcard exports per month on the free plan

### Paid

- Expanded or unlimited flashcard export quota
- Future premium study features

The product should expose its core reading and discovery loop for free, then require account identity when the user wants persistence or flashcard export.

## Future flashcard shape

- Selected word
- Current sentence
- Matching video fragment

## UI style direction

- Warm, calm, and welcoming rather than “tool-like”
- Transcript-first reading experience
- Soft Thai-inspired palette with gentle contrast
- Friendly wording and obvious actions
- Layout that keeps video, transcript, and word/context visible together when possible

## Near-term dependencies

- Strong Thai-English dictionary / translation quality
- Authenticated user accounts and user-scoped persistence
- Production database for hosted multi-user data
- Flashcard export quality
- Reliable local-Anki connection flow
- Video fragment reference strategy
- Tone-teaching accuracy and clarity
