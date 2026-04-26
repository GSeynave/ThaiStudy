export type TranscriptSegment = {
  text: string;
  duration: number;
  offset: number;
  lang: string;
};

export type TranscriptResponse = {
  provider?: "transcriptapi";
  segments: TranscriptSegment[];
};

export type VideoMetadataResponse = {
  videoId: string;
  title: string | null;
};

export type TranscriptErrorResponse = {
  error: string;
  code?: string;
};

export type TranscriptState =
  | { status: "idle"; segments: TranscriptSegment[]; error: null }
  | { status: "loading"; segments: TranscriptSegment[]; error: null }
  | { status: "ready"; segments: TranscriptSegment[]; error: null }
  | { status: "error"; segments: TranscriptSegment[]; error: string };

export type TranslationTarget = {
  text: string;
  sentence: string;
  source: "click" | "selection";
  segmentOffset: number | null;
  segmentDuration: number | null;
};

export type TranslationErrorResponse = {
  error: string;
};

export type AnkiConnectionState = "idle" | "checking" | "connected" | "issue";

export type StudyVideoHistoryEntry = {
  videoId: string;
  videoTitle?: string | null;
  openedCount: number;
  totalWordClicks: number;
  flashcardsCreated: number;
  uniqueWordsClicked: number;
  lastOpenedAt: string;
};

export type StudyVideoHistoryResponse = {
  videos: StudyVideoHistoryEntry[];
};

export type StudyWordStats = {
  word: string;
  clickCount: number;
  flashcardCount: number;
  lastClickedAt?: string | null;
  lastFlashcardAt?: string | null;
  lastSentence?: string | null;
  exportedToAnki?: boolean;
  exportedNoteId?: number | null;
  exportedDeckName?: string | null;
  exportedModelName?: string | null;
  exportedAt?: string | null;
};

export type StudyQuotaResponse = {
  monthlyFlashcardLimit: number;
  monthlyFlashcardExportsUsed: number;
  monthlyFlashcardExportsRemaining: number;
  resetsAt: string;
  hasReachedMonthlyFlashcardLimit: boolean;
};

export type StudyTheme = "cozy" | "night";

export type StudyPreferencesResponse = {
  defaultDeck?: string | null;
  autoExportToAnki: boolean;
  theme: StudyTheme;
  showToneColors: boolean;
  hasStoredPreferences: boolean;
};

export type AppSessionResponse = {
  authenticated: boolean;
  user: { id: string } | null;
  mode: "supabase" | "none";
};

export type ToneLabel = "mid" | "low" | "falling" | "high" | "rising" | "unknown";

export type TranslationSuggestion = {
  translation: string;
  score: number;
  rationale: string;
};

export type ToneMetadata = {
  label: ToneLabel;
  source: string;
  rule?: string | null;
  explanation?: string | null;
  consonantClass?: string | null;
  syllableType?: string | null;
  toneMark?: string | null;
};

export type PronunciationSyllable = {
  text: string;
  pronunciation: string;
  romanized: string;
  ipa: string | null;
  tone: ToneMetadata;
};

export type PronunciationSummary = {
  romanized: string;
  ipa: string | null;
  syllables: PronunciationSyllable[];
};

export type ExampleSentence = {
  text: string;
  translationHint: string;
  source: string;
};

export type ContextualTranslationResponse = {
  word: string;
  sentence: string;
  sentenceTokens: string[];
  suggestions: TranslationSuggestion[];
  pronunciation: PronunciationSummary;
  dictionaryAudioUrl: string | null;
  dictionarySourceUrl: string | null;
  exampleSentences: ExampleSentence[];
  flashcardPreview: {
    front: {
      word: string;
      hints: string[];
    };
    back: {
      word: string;
      chosenTranslation: string;
      exampleSentence: string;
      dictionaryAudioUrl: string | null;
    };
  };
};

export type GeneratedFlashcard = {
  videoId: string;
  word: string;
  chosenTranslation: string;
  sentence: string;
  clipStart: number | null;
  clipEnd: number | null;
  dictionaryAudioUrl: string | null;
  dictionarySourceUrl: string | null;
  includeDictionaryAudio: boolean;
  pronunciation: PronunciationSummary;
  tones: Array<{
    text: string;
    label: ToneLabel;
    consonantClass?: string | null;
    syllableType?: string | null;
    toneMark?: string | null;
    rule?: string | null;
    explanation?: string | null;
  }>;
};

export type TranslationState =
  | {
      status: "idle";
      target: null;
      data: null;
      error: null;
    }
  | {
      status: "loading";
      target: TranslationTarget;
      data: null;
      error: null;
    }
  | {
      status: "ready";
      target: TranslationTarget;
      data: ContextualTranslationResponse;
      error: null;
    }
  | {
      status: "error";
      target: TranslationTarget;
      data: null;
      error: string;
    };

export type YouTubePlayer = {
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
};

export type YouTubeOnStateChangeEvent = {
  data: number;
};

export type YouTubeNamespace = {
  Player: new (
    element: HTMLDivElement,
    options: {
      height: string;
      width: string;
      videoId: string;
      playerVars?: {
        playsinline?: 0 | 1;
      };
      events?: {
        onStateChange?: (event: YouTubeOnStateChangeEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
  }
}

export const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
export const TRANSCRIPT_LANGUAGE = "th";
export const ANKI_LAST_DECK_STORAGE_KEY = "thai-study:last-anki-deck";
export const ANKI_AUTO_EXPORT_STORAGE_KEY = "thai-study:auto-export";
export const THEME_STORAGE_KEY = "thai-study:theme";
export const TONE_COLORS_STORAGE_KEY = "thai-study:tone-colors";
export const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;
export const TRANSCRIPT_SEGMENTS_PER_PAGE = 6;

const HIGH_CLASS_CONSONANTS = new Set("ขฃฉฐถผฝศษสห");
const MID_CLASS_CONSONANTS = new Set("กจฎฏดตบปอ");
const LOW_SONORANTS = new Set("งญณนมยรลวฬ");
const SONORANT_FINALS = new Set("งนมยวญณรลฬ");
const STOP_FINALS = new Set("กขฃคฅฆจชซฌฎฏฐฑฒดตถทธศษสบปพภฟ");
const SHORT_VOWEL_MARKS = ["ะ", "ั", "ิ", "ึ", "ุ", "็", "ฤ", "ฦ"];
const TONE_MARKS: Record<string, "mai_ek" | "mai_tho" | "mai_tri" | "mai_chattawa"> = {
  "่": "mai_ek",
  "้": "mai_tho",
  "๊": "mai_tri",
  "๋": "mai_chattawa",
};
const TONE_MARK_LABELS: Record<
  "none" | "mai_ek" | "mai_tho" | "mai_tri" | "mai_chattawa",
  string
> = {
  none: "no tone mark",
  mai_ek: "mai ek",
  mai_tho: "mai tho",
  mai_tri: "mai tri",
  mai_chattawa: "mai chattawa",
};
const THAI_CONSONANTS = new Set(
  "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ",
);
const THAI_LEADING_VOWELS = new Set("เแโใไ");
const THAI_VOWEL_SIGNS = new Set("ะัาำิีึืุูฤฦ็ๅ");
const SHORT_VOWEL_PATTERNS = [/เ.าะ/, /เ.อะ/, /เ.ะ/, /แ.ะ/, /โ.ะ/, /เ.าะ/];
const TONE_TABLE: Record<
  "none" | "mai_ek" | "mai_tho" | "mai_tri" | "mai_chattawa",
  Record<"mid" | "high" | "low", Record<"live" | "dead", ToneLabel>>
> = {
  none: {
    mid: { live: "mid", dead: "low" },
    high: { live: "rising", dead: "low" },
    low: { live: "mid", dead: "falling" },
  },
  mai_ek: {
    mid: { live: "low", dead: "low" },
    high: { live: "low", dead: "low" },
    low: { live: "falling", dead: "high" },
  },
  mai_tho: {
    mid: { live: "falling", dead: "falling" },
    high: { live: "falling", dead: "falling" },
    low: { live: "high", dead: "falling" },
  },
  mai_tri: {
    mid: { live: "high", dead: "high" },
    high: { live: "rising", dead: "rising" },
    low: { live: "rising", dead: "high" },
  },
  mai_chattawa: {
    mid: { live: "rising", dead: "rising" },
    high: { live: "high", dead: "high" },
    low: { live: "rising", dead: "rising" },
  },
};

export const EMPTY_TRANSCRIPT: TranscriptState = {
  status: "idle",
  segments: [],
  error: null,
};

export const EMPTY_TRANSLATION: TranslationState = {
  status: "idle",
  target: null,
  data: null,
  error: null,
};

export function extractVideoId(input: string) {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return null;
  }

  if (YOUTUBE_VIDEO_ID_PATTERN.test(trimmedInput)) {
    return trimmedInput;
  }

  try {
    const url = new URL(trimmedInput);

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (!url.hostname.endsWith("youtube.com")) {
      return null;
    }

    const queryVideoId = url.searchParams.get("v");
    if (queryVideoId && YOUTUBE_VIDEO_ID_PATTERN.test(queryVideoId)) {
      return queryVideoId;
    }

    const embedVideoId = url.pathname.match(/\/embed\/([\w-]{11})/)?.[1];
    if (embedVideoId) {
      return embedVideoId;
    }
  } catch {}

  return null;
}

export function getTranscriptParts(text: string, lang: string) {
  const segmenter = new Intl.Segmenter(lang, { granularity: "word" });
  return Array.from(segmenter.segment(text)).flatMap((part) =>
    splitMixedScriptTranscriptPart(part),
  );
}

function splitMixedScriptTranscriptPart(
  part: { segment: string; isWordLike?: boolean },
) {
  if (!part.isWordLike) {
    return [part];
  }

  const chunks = part.segment.match(
    /[\u0E00-\u0E7F]+|[A-Za-z0-9]+|[^\u0E00-\u0E7FA-Za-z0-9]+/g,
  );

  if (!chunks || chunks.length <= 1) {
    return [part];
  }

  return chunks.map((chunk) => ({
    ...part,
    segment: chunk,
    isWordLike: /[\u0E00-\u0E7FA-Za-z0-9]/.test(chunk),
  }));
}

export function findCurrentSegmentIndex(
  segments: TranscriptSegment[],
  currentTime: number,
) {
  let low = 0;
  let high = segments.length - 1;
  let match: number | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = segments[middle];

    if (segment.offset <= currentTime) {
      match = middle;
      low = middle + 1;
      continue;
    }

    high = middle - 1;
  }

  return match;
}

export function getSentenceFromNode(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement ?? null;
  return element?.closest<HTMLElement>("[data-sentence]")?.dataset.sentence ?? null;
}

export function getSegmentMetadataFromNode(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement ?? null;
  const sentenceElement = element?.closest<HTMLElement>("[data-sentence]") ?? null;

  if (!sentenceElement) {
    return { offset: null, duration: null };
  }

  const offset = Number(sentenceElement.dataset.offset);
  const duration = Number(sentenceElement.dataset.duration);

  return {
    offset: Number.isFinite(offset) ? offset : null,
    duration: Number.isFinite(duration) ? duration : null,
  };
}

export function getStoredAnkiDeck() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ANKI_LAST_DECK_STORAGE_KEY) ?? "";
}

export function getStoredAutoExportPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ANKI_AUTO_EXPORT_STORAGE_KEY) === "true";
}

export function getStoredTheme() {
  if (typeof window === "undefined") {
    return "cozy" as StudyTheme;
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "night"
    ? ("night" as StudyTheme)
    : ("cozy" as StudyTheme);
}

export function getStoredToneColorsPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TONE_COLORS_STORAGE_KEY) === "true";
}

export function normalizeStudyText(text: string) {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function formatStudyTimestamp(timestamp: string | null | undefined) {
  if (!timestamp) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return null;
  }
}

export function buildStudyPreferencesPayload({
  autoExportToAnki,
  selectedDeck,
  showToneColors,
  theme,
}: {
  autoExportToAnki: boolean;
  selectedDeck: string;
  showToneColors: boolean;
  theme: StudyTheme;
}) {
  return {
    defaultDeck: selectedDeck.trim() || null,
    autoExportToAnki,
    theme,
    showToneColors,
  };
}

export function buildStudyPreferencesSignature(payload: {
  defaultDeck: string | null;
  autoExportToAnki: boolean;
  theme: StudyTheme;
  showToneColors: boolean;
}) {
  return JSON.stringify(payload);
}

export function toneClasses(tone: ToneLabel) {
  switch (tone) {
    case "mid":
      return "text-sky-700";
    case "low":
      return "text-violet-700";
    case "falling":
      return "text-rose-700";
    case "high":
      return "text-amber-700";
    case "rising":
      return "text-emerald-700";
    default:
      return "text-stone-600";
  }
}

export function transcriptToneClasses(tone: ToneLabel) {
  switch (tone) {
    case "mid":
      return "text-sky-800 underline decoration-sky-300 underline-offset-4";
    case "low":
      return "text-violet-800 underline decoration-violet-300 underline-offset-4";
    case "falling":
      return "text-rose-800 underline decoration-rose-300 underline-offset-4";
    case "high":
      return "text-amber-800 underline decoration-amber-300 underline-offset-4";
    case "rising":
      return "text-emerald-800 underline decoration-emerald-300 underline-offset-4";
    default:
      return "text-stone-700 underline decoration-stone-300 underline-offset-4";
  }
}

export function formatToneValue(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  if (value === "none") {
    return "None";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatTranslationDisplay(translation: string | null | undefined) {
  if (!translation) {
    return "No English translation available yet";
  }

  const parts = translation
    .split(/[;/]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return translation.trim();
  }

  if (parts.length === 2) {
    return `${parts[0]} or ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")}, or ${parts.at(-1)}`;
}

export function splitThaiSyllablesForTooltip(word: string) {
  const trimmedWord = word.trim();
  if (!trimmedWord) {
    return [];
  }

  const characters = Array.from(trimmedWord);
  if (characters.length <= 1) {
    return [trimmedWord];
  }

  const syllables: string[] = [];
  let current = "";

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const nextCharacter = characters[index + 1] ?? null;

    if (
      current &&
      THAI_LEADING_VOWELS.has(character) &&
      Array.from(current).some((currentCharacter) => THAI_CONSONANTS.has(currentCharacter))
    ) {
      syllables.push(current);
      current = character;
    } else {
      current += character;
    }

    if (nextCharacter && shouldSplitThaiSyllable(current, nextCharacter)) {
      syllables.push(current);
      current = "";
    }
  }

  if (current) {
    syllables.push(current);
  }

  return syllables.filter((syllable) => syllable.trim().length > 0);
}

function shouldSplitThaiSyllable(current: string, nextCharacter: string) {
  if (THAI_LEADING_VOWELS.has(nextCharacter)) {
    return true;
  }

  if (!THAI_CONSONANTS.has(nextCharacter)) {
    return false;
  }

  const currentCharacters = Array.from(current);
  const consonants = currentCharacters.filter((character) =>
    THAI_CONSONANTS.has(character),
  );
  if (consonants.length === 0) {
    return false;
  }

  const hasVowelSignal = currentCharacters.some(
    (character) =>
      THAI_VOWEL_SIGNS.has(character) || THAI_LEADING_VOWELS.has(character),
  );
  const hasToneMark = currentCharacters.some((character) => character in TONE_MARKS);
  const hasShortVowelSignal = currentCharacters.some((character) =>
    SHORT_VOWEL_MARKS.includes(character),
  );
  const lastCharacter = currentCharacters.at(-1) ?? null;

  if (hasToneMark) {
    return true;
  }

  if (hasShortVowelSignal && lastCharacter && THAI_CONSONANTS.has(lastCharacter)) {
    return true;
  }

  if (lastCharacter && THAI_CONSONANTS.has(lastCharacter) && hasVowelSignal) {
    return true;
  }

  return false;
}

export function inferTranscriptToneMetadata(syllable: string): ToneMetadata {
  const cleaned = syllable.trim();
  if (!cleaned) {
    return {
      label: "unknown",
      source: "orthographic-guess",
      explanation: "No Thai syllable data was available to analyze.",
    };
  }

  const toneKey =
    (Object.keys(TONE_MARKS).find((character) => cleaned.includes(character)) as
      | keyof typeof TONE_MARKS
      | undefined) ?? null;
  const resolvedToneKey = toneKey ? TONE_MARKS[toneKey] : "none";
  const consonantClass = getConsonantClass(cleaned);
  const syllableType = getSyllableType(cleaned);

  if (!consonantClass || !syllableType) {
    return {
      label: "unknown",
      source: "orthographic-guess",
      toneMark: TONE_MARK_LABELS[resolvedToneKey],
      explanation: "The syllable did not contain enough information to resolve a tone rule.",
    };
  }

  const label = TONE_TABLE[resolvedToneKey][consonantClass][syllableType];
  const rule =
    resolvedToneKey === "none"
      ? `${label} tone from a ${consonantClass}-class consonant in a ${syllableType} syllable with no tone mark.`
      : `${label} tone from a ${consonantClass}-class consonant in a ${syllableType} syllable with ${TONE_MARK_LABELS[resolvedToneKey]}.`;

  return {
    label,
    source: "orthographic-guess",
    rule,
    explanation:
      resolvedToneKey === "none"
        ? `This syllable has no explicit tone mark, so the tone falls out of consonant class (${consonantClass}) plus syllable type (${syllableType}).`
        : `This syllable uses ${TONE_MARK_LABELS[resolvedToneKey]}, then resolves through the ${consonantClass}-class + ${syllableType} syllable rule.`,
    consonantClass,
    syllableType,
    toneMark: TONE_MARK_LABELS[resolvedToneKey],
  };
}

function getConsonantClass(syllable: string) {
  const consonants = Array.from(syllable).filter((character) =>
    THAI_CONSONANTS.has(character),
  );

  if (consonants.length === 0) {
    return null;
  }

  const first = consonants[0];
  if (first === "ห" && consonants.length > 1 && LOW_SONORANTS.has(consonants[1])) {
    return "high" as const;
  }

  if (HIGH_CLASS_CONSONANTS.has(first)) {
    return "high" as const;
  }
  if (MID_CLASS_CONSONANTS.has(first)) {
    return "mid" as const;
  }
  return "low" as const;
}

function getSyllableType(syllable: string) {
  const consonants = Array.from(syllable).filter((character) =>
    THAI_CONSONANTS.has(character),
  );
  const finalConsonant = consonants.at(-1);

  if (!finalConsonant) {
    return null;
  }

  if (SHORT_VOWEL_MARKS.some((marker) => syllable.includes(marker))) {
    return "dead" as const;
  }

  if (SHORT_VOWEL_PATTERNS.some((pattern) => pattern.test(syllable))) {
    return "dead" as const;
  }

  if (STOP_FINALS.has(finalConsonant)) {
    return "dead" as const;
  }

  if (SONORANT_FINALS.has(finalConsonant) || consonants.length === 1) {
    return "live" as const;
  }

  return "live" as const;
}
