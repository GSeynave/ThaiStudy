"use client";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 6;
const ANKI_MODEL_NAME = "ThaiStudyBasic";
const ANKI_CONNECT_TIMEOUT_MS = 8000;

const ANKI_MODEL_FIELDS = [
  "Word",
  "Translation",
  "Sentence",
  "Romanization",
  "Tone",
  "Audio",
  "Video",
  "Source",
];

const ANKI_CSS = `
.card {
  font-family: "Noto Sans Thai", "Noto Sans", sans-serif;
  font-size: 22px;
  text-align: left;
  color: #1f2b23;
  background:
    radial-gradient(circle at top, rgba(248, 252, 248, 0.98), rgba(239, 246, 240, 0.98) 54%, rgba(228, 238, 229, 0.98) 100%);
  padding: 32px 30px 30px;
  line-height: 1.5;
}
.card.night_mode {
  color: #e4eee7;
  background: linear-gradient(180deg, #111715 0%, #17201b 100%);
}
.frame {
  max-width: 34rem;
  margin: 0 auto;
}
.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #62786a;
  margin-bottom: 0.9rem;
}
.card.night_mode .eyebrow {
  color: #95afa0;
}
.word {
  font-size: 2.9rem;
  line-height: 1.08;
  letter-spacing: 0.01em;
  margin-bottom: 1rem;
  font-weight: 600;
}
.translation {
  font-size: 1.65rem;
  line-height: 1.24;
  color: #244536;
  font-weight: 600;
  margin: 0 0 1.2rem;
}
.card.night_mode .translation {
  color: #bbddc5;
}
.sentence {
  font-size: 1.16rem;
  line-height: 1.78;
  color: #32453a;
  margin: 0;
}
.card.night_mode .sentence {
  color: #cfddd3;
}
.answer {
  border: 0;
  border-top: 1px solid rgba(70, 101, 82, 0.24);
  margin: 1.35rem 0 1.35rem;
}
.card.night_mode .answer {
  border-top-color: rgba(184, 217, 196, 0.18);
}
.section {
  margin-top: 1.1rem;
}
.row {
  display: flex;
  gap: 0.8rem;
  align-items: baseline;
  padding: 0.34rem 0;
}
.label {
  flex: 0 0 6rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #6f8779;
}
.card.night_mode .label {
  color: #8ea697;
}
.meta {
  flex: 1;
  min-width: 0;
  color: #46594e;
  font-size: 0.98rem;
  line-height: 1.7;
}
.card.night_mode .meta {
  color: #c6d4cc;
}
.tone-block {
  padding-top: 0.2rem;
}
.tone-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.tone-card {
  border: 1px solid rgba(70, 101, 82, 0.18);
  border-radius: 0.9rem;
  padding: 0.8rem 0.9rem 0.85rem;
  background: rgba(255, 255, 255, 0.42);
}
.card.night_mode .tone-card {
  border-color: rgba(184, 217, 196, 0.15);
  background: rgba(255, 255, 255, 0.04);
}
.tone-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}
.tone-word {
  font-size: 1.02rem;
  color: #22372c;
  font-weight: 600;
}
.card.night_mode .tone-word {
  color: #dbe8df;
}
.tone-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.16rem 0.52rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: rgba(47, 91, 69, 0.1);
}
.tone-mid { color: #1d5f91; }
.tone-low { color: #6a2ba0; }
.tone-falling { color: #b33b52; }
.tone-high { color: #9a5b00; }
.tone-rising { color: #1f7a4f; }
.tone-unknown { color: #51625a; }
.card.night_mode .tone-pill {
  background: rgba(255, 255, 255, 0.06);
}
.tone-pronunciation {
  margin-top: 0.35rem;
  color: #5b6f64;
  font-size: 0.84rem;
}
.card.night_mode .tone-pronunciation {
  color: #b1c2b8;
}
.tone-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.7rem;
}
.tone-detail {
  border-radius: 0.65rem;
  border: 1px solid rgba(70, 101, 82, 0.14);
  background: rgba(246, 250, 247, 0.72);
  padding: 0.45rem 0.55rem;
}
.card.night_mode .tone-detail {
  border-color: rgba(184, 217, 196, 0.12);
  background: rgba(255, 255, 255, 0.035);
}
.tone-detail-label {
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #708579;
}
.card.night_mode .tone-detail-label {
  color: #8ea697;
}
.tone-detail-value {
  margin-top: 0.18rem;
  font-size: 0.76rem;
  color: #42554b;
  line-height: 1.45;
}
.card.night_mode .tone-detail-value {
  color: #d0ddd5;
}
.tone-explanation {
  margin-top: 0.62rem;
  font-size: 0.8rem;
  line-height: 1.55;
  color: #51645a;
}
.card.night_mode .tone-explanation {
  color: #c7d6cd;
}
.media {
  margin-top: 1.1rem;
}
.media .replay-button,
.media a.replaybutton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 999px;
  background: #2f5b45;
  color: #f6faf7;
  text-decoration: none;
  box-shadow: none;
}
.card.night_mode .media .replay-button,
.card.night_mode .media a.replaybutton {
  background: #80a48e;
  color: #0f1512;
}
.links a,
a {
  color: #2f634a;
  text-decoration: none;
}
.card.night_mode .links a,
.card.night_mode a {
  color: #b9d7c2;
}
.links a:hover,
a:hover {
  text-decoration: underline;
}
`;

const ANKI_FRONT_TEMPLATE = `
<div class="frame">
  <div class="eyebrow">Thai Study</div>
  <div class="word">{{Word}}</div>
  {{#Sentence}}
  <div class="section">
    <div class="sentence">{{Sentence}}</div>
  </div>
  {{/Sentence}}
  {{#Audio}}
  <div class="media">{{Audio}}</div>
  {{/Audio}}
</div>
`;

const ANKI_BACK_TEMPLATE = `
<div class="frame">
  <div class="eyebrow">Thai Study</div>
  <div class="word">{{Word}}</div>
  {{#Translation}}
  <div class="translation">{{Translation}}</div>
  {{/Translation}}
  {{#Sentence}}
  <div class="sentence">{{Sentence}}</div>
  {{/Sentence}}
  {{#Audio}}
  <div class="media">{{Audio}}</div>
  {{/Audio}}
  <hr class="answer">
  <div class="section">
    {{#Romanization}}
    <div class="row">
      <div class="label">Romanized</div>
      <div class="meta">{{Romanization}}</div>
    </div>
    {{/Romanization}}
    {{#Tone}}
    <div class="row">
      <div class="label">Tone</div>
      <div class="meta tone-block">{{Tone}}</div>
    </div>
    {{/Tone}}
    {{#Video}}
    <div class="row links">
      <div class="label">Video</div>
      <div class="meta">{{Video}}</div>
    </div>
    {{/Video}}
    {{#Source}}
    <div class="row links">
      <div class="label">Source</div>
      <div class="meta">{{Source}}</div>
    </div>
    {{/Source}}
  </div>
</div>
`;

export type AnkiStatusResponse = {
  available: boolean;
  version?: number | null;
  modelName?: string | null;
  error?: string | null;
};

export type AnkiDecksResponse = {
  decks: string[];
};

export type AnkiSelfTestResponse = {
  available: boolean;
  version?: number | null;
  modelReady: boolean;
  canListDecks: boolean;
  error?: string | null;
};

export type ToneLabel = "mid" | "low" | "falling" | "high" | "rising" | "unknown";

export type AnkiToneDetail = {
  text: string;
  label: ToneLabel;
  pronunciation?: string | null;
  romanized?: string | null;
  ipa?: string | null;
  consonantClass?: string | null;
  syllableType?: string | null;
  toneMark?: string | null;
  rule?: string | null;
  explanation?: string | null;
};

export type AnkiExportRequest = {
  deckName: string;
  word: string;
  translation: string;
  sentence: string;
  romanized?: string | null;
  tones: string[];
  toneDetails: AnkiToneDetail[];
  sourceUrl?: string | null;
  dictionaryAudioUrl?: string | null;
  tags: string[];
};

export type AnkiExportResponse = {
  noteId: number;
  duplicate: boolean;
  mediaStored: string[];
  modelName: string;
  warning?: string | null;
};

export class LocalAnkiError extends Error {}

export async function getAnkiStatus(): Promise<AnkiStatusResponse> {
  try {
    const version = await callAnkiConnect("version");
    const modelReady = await ensureAnkiModel();
    return {
      available: true,
      version: typeof version === "number" ? version : Number(version),
      modelName: modelReady ? ANKI_MODEL_NAME : null,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Could not reach AnkiConnect.",
      modelName: ANKI_MODEL_NAME,
    };
  }
}

export async function getAnkiDecks(): Promise<AnkiDecksResponse> {
  const decks = await callAnkiConnect("deckNames");
  if (!Array.isArray(decks)) {
    throw new LocalAnkiError("AnkiConnect returned an invalid deck list.");
  }

  return { decks: decks.map(String).sort() };
}

export async function getAnkiSelfTest(): Promise<AnkiSelfTestResponse> {
  try {
    const version = await callAnkiConnect("version");
    const modelReady = await ensureAnkiModel();
    const decks = await getAnkiDecks();
    return {
      available: true,
      version: typeof version === "number" ? version : Number(version),
      modelReady,
      canListDecks: decks.decks.length >= 0,
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      modelReady: false,
      canListDecks: false,
      error: error instanceof Error ? error.message : "Could not reach AnkiConnect.",
    };
  }
}

export async function exportFlashcardToLocalAnki(
  payload: AnkiExportRequest,
): Promise<AnkiExportResponse> {
  await ensureAnkiModel();

  const duplicateNoteIds = await findDuplicateNotes(payload.word, payload.sentence);
  if (duplicateNoteIds.length > 0) {
    return {
      noteId: duplicateNoteIds[0],
      duplicate: true,
      mediaStored: [],
      modelName: ANKI_MODEL_NAME,
      warning: null,
    };
  }

  const mediaFields = await maybeStoreAudio(payload.dictionaryAudioUrl, payload.word);
  const noteId = await callAnkiConnect("addNote", {
    note: {
      deckName: payload.deckName,
      modelName: ANKI_MODEL_NAME,
      fields: buildAnkiFields(payload, mediaFields.audio),
      options: {
        allowDuplicate: false,
      },
      tags: buildTags(payload.tags),
    },
  });

  if (typeof noteId !== "number") {
    throw new LocalAnkiError("AnkiConnect did not return a valid note id.");
  }

  return {
    noteId,
    duplicate: false,
    mediaStored: mediaFields.storedFiles,
    modelName: ANKI_MODEL_NAME,
    warning: mediaFields.warning,
  };
}

async function ensureAnkiModel(): Promise<boolean> {
  const modelNames = await callAnkiConnect("modelNames");
  if (!Array.isArray(modelNames)) {
    throw new LocalAnkiError("AnkiConnect returned an invalid model list.");
  }

  if (modelNames.includes(ANKI_MODEL_NAME)) {
    await syncAnkiModel();
    return true;
  }

  const result = await callAnkiConnect("createModel", {
    modelName: ANKI_MODEL_NAME,
    inOrderFields: ANKI_MODEL_FIELDS,
    css: ANKI_CSS,
    cardTemplates: [
      {
        Name: "Card 1",
        Front: ANKI_FRONT_TEMPLATE,
        Back: ANKI_BACK_TEMPLATE,
      },
    ],
  });

  return result == null ? true : Boolean(result);
}

async function syncAnkiModel() {
  await updateModelStyling();
  await updateModelTemplates();
}

async function updateModelStyling() {
  await tryAnkiPayloads("updateModelStyling", [
    { model: { name: ANKI_MODEL_NAME, css: ANKI_CSS } },
    { modelName: ANKI_MODEL_NAME, css: ANKI_CSS },
  ]);
}

async function updateModelTemplates() {
  await tryAnkiPayloads("updateModelTemplates", [
    {
      model: {
        name: ANKI_MODEL_NAME,
        templates: {
          "Card 1": {
            Front: ANKI_FRONT_TEMPLATE,
            Back: ANKI_BACK_TEMPLATE,
          },
        },
      },
    },
    {
      modelName: ANKI_MODEL_NAME,
      templates: {
        "Card 1": {
          Front: ANKI_FRONT_TEMPLATE,
          Back: ANKI_BACK_TEMPLATE,
        },
      },
    },
  ]);
}

async function findDuplicateNotes(word: string, sentence: string): Promise<number[]> {
  const noteIds = await callAnkiConnect("findNotes", {
    query: `note:"${ANKI_MODEL_NAME}" Word:"${escapeAnkiQuery(word.trim())}" Sentence:"${escapeAnkiQuery(sentence.trim())}"`,
  });

  if (!Array.isArray(noteIds)) {
    throw new LocalAnkiError("AnkiConnect returned an invalid duplicate search result.");
  }

  return noteIds.map((noteId) => Number(noteId));
}

function buildAnkiFields(payload: AnkiExportRequest, audioMarkup: string) {
  const videoMarkup = payload.sourceUrl
    ? `<a href='${escapeHtml(payload.sourceUrl)}'>Source link</a>`
    : "";

  return {
    Word: escapeHtml(payload.word.trim()),
    Translation: escapeHtml(payload.translation.trim()),
    Sentence: escapeHtml(payload.sentence.trim()),
    Romanization: escapeHtml((payload.romanized ?? "").trim()),
    Tone: buildToneMarkup(payload),
    Audio: audioMarkup,
    Video: videoMarkup,
    Source: videoMarkup,
  };
}

function buildToneMarkup(payload: AnkiExportRequest) {
  if (payload.toneDetails.length > 0) {
    return `<div class='tone-stack'>${payload.toneDetails.map(buildToneDetailCard).join("")}</div>`;
  }

  if (payload.tones.length > 0) {
    return escapeHtml(payload.tones.join(", "));
  }

  return "";
}

function buildToneDetailCard(detail: AnkiToneDetail) {
  const toneClass = `tone-${detail.label}`;
  const pronunciationParts = [detail.pronunciation, detail.romanized, detail.ipa]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => escapeHtml(part.trim()));
  const toneMeta: Array<[string, string | null | undefined]> = [
    ["Class", detail.consonantClass],
    ["Type", detail.syllableType],
    ["Mark", detail.toneMark],
    ["Result", detail.label],
  ];
  const metaMarkup = toneMeta
    .map(
      ([label, value]) =>
        "<div class='tone-detail'>" +
        `<div class='tone-detail-label'>${escapeHtml(label)}</div>` +
        `<div class='tone-detail-value'>${escapeHtml(formatToneValue(value))}</div>` +
        "</div>",
    )
    .join("");
  const explanation = detail.explanation ?? detail.rule;
  const pronunciationMarkup =
    pronunciationParts.length > 0
      ? `<div class='tone-pronunciation'>${pronunciationParts.join(" · ")}</div>`
      : "";
  const explanationMarkup =
    explanation && explanation.trim()
      ? `<div class='tone-explanation'>${escapeHtml(explanation.trim())}</div>`
      : "";

  return (
    "<div class='tone-card'>" +
    "<div class='tone-head'>" +
    `<span class='tone-word'>${escapeHtml(detail.text.trim())}</span>` +
    `<span class='tone-pill ${toneClass}'>${escapeHtml(detail.label)} tone</span>` +
    "</div>" +
    pronunciationMarkup +
    `<div class='tone-grid'>${metaMarkup}</div>` +
    explanationMarkup +
    "</div>"
  );
}

function formatToneValue(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  if (value === "none") {
    return "None";
  }

  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

async function maybeStoreAudio(audioUrl: string | null | undefined, word: string) {
  if (!audioUrl) {
    return { audio: "", storedFiles: [] as string[], warning: null as string | null };
  }

  const proxiedAudioUrl = `/api/dictionary-audio?url=${encodeURIComponent(audioUrl)}`;
  const audioBytes = await fetchBinary(proxiedAudioUrl);
  if (!audioBytes) {
    return {
      audio: "",
      storedFiles: [] as string[],
      warning:
        "The card exported without dictionary audio. The browser could not fetch the audio file, likely due to source-site CORS or mixed-content restrictions.",
    };
  }

  const filename = buildAudioFilename(word, audioUrl);
  await callAnkiConnect("storeMediaFile", {
    filename,
    data: arrayBufferToBase64(audioBytes),
  });

  return {
    audio: `[sound:${filename}]`,
    storedFiles: [filename],
    warning: null,
  };
}

function buildAudioFilename(word: string, audioUrl: string) {
  const parsed = new URL(audioUrl);
  const suffix = parsed.pathname.split("/").pop()?.split(".").pop()?.toLowerCase() || "mp3";
  let normalizedWord = word.trim().replace(/[^\w\u0E00-\u0E7F-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalizedWord) {
    normalizedWord = "thai-study";
  }
  return `thai-study-${normalizedWord}.${suffix}`;
}

function buildTags(tags: string[]) {
  const normalizedTags = new Set(["thai-study"]);
  for (const tag of tags) {
    const cleaned = tag.trim().replaceAll(" ", "-");
    if (cleaned) {
      normalizedTags.add(cleaned);
    }
  }
  return [...normalizedTags].sort();
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAnkiQuery(text: string) {
  return text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function fetchBinary(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(ANKI_CONNECT_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function callAnkiConnect(action: string, params: Record<string, unknown> = {}) {
  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        version: ANKI_CONNECT_VERSION,
        params,
      }),
      signal: AbortSignal.timeout(ANKI_CONNECT_TIMEOUT_MS),
    });
  } catch {
    throw new LocalAnkiError(
      buildAnkiConnectReachabilityMessage(),
    );
  }

  let payload: { result?: unknown; error?: string | null };
  try {
    payload = (await response.json()) as { result?: unknown; error?: string | null };
  } catch {
    throw new LocalAnkiError("AnkiConnect returned invalid JSON.");
  }

  if (!response.ok) {
    throw new LocalAnkiError(payload.error || `AnkiConnect returned HTTP ${response.status}.`);
  }

  if (payload.error) {
    throw new LocalAnkiError(String(payload.error));
  }

  return payload.result;
}

async function tryAnkiPayloads(action: string, payloadOptions: Array<Record<string, unknown>>) {
  let lastError: LocalAnkiError | null = null;
  for (const params of payloadOptions) {
    try {
      await callAnkiConnect(action, params);
      return;
    } catch (error) {
      lastError =
        error instanceof LocalAnkiError
          ? error
          : new LocalAnkiError("AnkiConnect update failed.");
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function buildAnkiConnectReachabilityMessage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "this page";
  const protocol = typeof window !== "undefined" ? window.location.protocol : "";
  const httpsHint =
    protocol === "https:"
      ? " This page is running over HTTPS, so the browser may be blocking access to local HTTP."
      : "";

  return `Could not reach AnkiConnect at http://127.0.0.1:8765 from ${origin}. Start Anki and enable AnkiConnect.${httpsHint}`;
}
