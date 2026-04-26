"use client";

import Script from "next/script";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from "react";

import {
  exportFlashcardToLocalAnki,
  getAnkiDecks,
  getAnkiSelfTest,
  getAnkiStatus,
  type AnkiDecksResponse,
} from "@/lib/anki/local-bridge";
import { ToastViewport, type AppToast } from "@/components/toast";

type TranscriptSegment = {
  text: string;
  duration: number;
  offset: number;
  lang: string;
};

type TranscriptResponse = {
  segments: TranscriptSegment[];
};

type VideoMetadataResponse = {
  videoId: string;
  title: string | null;
};

type TranscriptErrorResponse = {
  error: string;
  code?: string;
};

type TranscriptState =
  | { status: "idle"; segments: TranscriptSegment[]; error: null }
  | { status: "loading"; segments: TranscriptSegment[]; error: null }
  | { status: "ready"; segments: TranscriptSegment[]; error: null }
  | { status: "error"; segments: TranscriptSegment[]; error: string };

type TranslationTarget = {
  text: string;
  sentence: string;
  source: "click" | "selection";
  segmentOffset: number | null;
  segmentDuration: number | null;
};

type TranslationErrorResponse = {
  error: string;
};

type AnkiConnectionState = "idle" | "checking" | "connected" | "issue";

type StudyVideoHistoryEntry = {
  videoId: string;
  videoTitle?: string | null;
  openedCount: number;
  totalWordClicks: number;
  flashcardsCreated: number;
  uniqueWordsClicked: number;
  lastOpenedAt: string;
};

type StudyVideoHistoryResponse = {
  videos: StudyVideoHistoryEntry[];
};

type StudyWordStats = {
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

type StudyQuotaResponse = {
  monthlyFlashcardLimit: number;
  monthlyFlashcardExportsUsed: number;
  monthlyFlashcardExportsRemaining: number;
  resetsAt: string;
  hasReachedMonthlyFlashcardLimit: boolean;
};

type StudyTheme = "cozy" | "night";

type StudyPreferencesResponse = {
  defaultDeck?: string | null;
  autoExportToAnki: boolean;
  theme: StudyTheme;
  showToneColors: boolean;
  hasStoredPreferences: boolean;
};

type AppSessionResponse = {
  authenticated: boolean;
  user: { id: string } | null;
  mode: "supabase" | "none";
};

type ToneLabel = "mid" | "low" | "falling" | "high" | "rising" | "unknown";

type TranslationSuggestion = {
  translation: string;
  score: number;
  rationale: string;
};

type ToneMetadata = {
  label: ToneLabel;
  source: string;
  rule?: string | null;
  explanation?: string | null;
  consonantClass?: string | null;
  syllableType?: string | null;
  toneMark?: string | null;
};

type PronunciationSyllable = {
  text: string;
  pronunciation: string;
  romanized: string;
  ipa: string | null;
  tone: ToneMetadata;
};

type PronunciationSummary = {
  romanized: string;
  ipa: string | null;
  syllables: PronunciationSyllable[];
};

type ExampleSentence = {
  text: string;
  translationHint: string;
  source: string;
};

type ContextualTranslationResponse = {
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

type GeneratedFlashcard = {
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

type TranslationState =
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

type SourcePickerProps = {
  isHydrated: boolean;
  inputError: string | null;
  isLoadingHistory: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  videoInput: string;
};

type TranscriptPanelProps = {
  activeSegmentIndex: number | null;
  displayedSegments: TranscriptSegment[];
  isPlayerPlaying: boolean;
  onMouseUp: (event: MouseEvent<HTMLDivElement>) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  pageCount: number;
  pageStartIndex: number;
  showToneColors: boolean;
  transcript: TranscriptState;
  visiblePage: number;
};

type TranslationPanelProps = {
  autoExportEnabled: boolean;
  copiedWord: boolean;
  isAuthenticated: boolean;
  isAutoExportReady: boolean;
  monthlyFlashcardExportsRemaining: number | null;
  hasReachedMonthlyFlashcardLimit: boolean;
  onCopyWord: () => void;
  onOpenSignIn: () => void;
  onGenerateFlashcard: () => void;
  onReplayContext: () => void;
  onSelectSuggestion: (translation: string) => void;
  onToggleAutoExport: () => void;
  selectedSuggestion: string | null;
  selectedDeck: string;
  translation: TranslationState;
  wordStats: StudyWordStats | null;
};

type FlashcardDialogProps = {
  autoExportEnabled: boolean;
  ankiAvailable: boolean;
  ankiDecks: string[];
  exportMessage: { kind: "idle" | "success" | "error"; text: string | null };
  flashcard: GeneratedFlashcard;
  isAuthenticated: boolean;
  isDeckSelectionReady: boolean;
  isExporting: boolean;
  modelName: string;
  onCancel: () => void;
  onChange: (field: keyof GeneratedFlashcard, value: string | boolean) => void;
  onConfirm: () => void;
  onDeckChange: (deckName: string) => void;
  onOpenSignIn: () => void;
  onToggleAutoExport: () => void;
  selectedDeck: string;
  wordStats: StudyWordStats | null;
};

type SidebarProps = {
  authStatusDetail: string;
  ankiDecks: string[];
  ankiAvailable: boolean;
  ankiStatusDetail: string;
  ankiStatusState: AnkiConnectionState;
  activeSection: "settings" | "history";
  autoExportEnabled: boolean;
  currentVideoTitle: string | null;
  currentVideoId: string | null;
  hasActiveVideo: boolean;
  isAuthenticated: boolean;
  isSupabaseConfigured: boolean;
  isDeckSelectionReady: boolean;
  isExpanded: boolean;
  isLoadingHistory: boolean;
  monthlyFlashcardExportsRemaining: number | null;
  monthlyFlashcardLimit: number | null;
  quotaResetsAt: string | null;
  onChangeSource: () => void;
  onClose: () => void;
  onDeckChange: (deckName: string) => void;
  onOpenSignIn: () => void;
  onOpenSection: (section: "settings" | "history") => void;
  onOpenHistoryVideo: (videoId: string) => void;
  onRefreshAnki: () => void;
  onToggleAutoExport: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  recentVideos: StudyVideoHistoryEntry[];
  selectedDeck: string;
  sidebarRef: RefObject<HTMLElement | null>;
  showToneColors: boolean;
  theme: "cozy" | "night";
  onToggleToneColors: () => void;
};

type YouTubePlayer = {
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
};

type YouTubeOnStateChangeEvent = {
  data: number;
};

type YouTubeNamespace = {
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

const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
const TRANSCRIPT_LANGUAGE = "th";
const ANKI_LAST_DECK_STORAGE_KEY = "thai-study:last-anki-deck";
const ANKI_AUTO_EXPORT_STORAGE_KEY = "thai-study:auto-export";
const THEME_STORAGE_KEY = "thai-study:theme";
const TONE_COLORS_STORAGE_KEY = "thai-study:tone-colors";
const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;
const TRANSCRIPT_SEGMENTS_PER_PAGE = 6;
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
const SHORT_VOWEL_PATTERNS = [
  /เ.าะ/,
  /เ.อะ/,
  /เ.ะ/,
  /แ.ะ/,
  /โ.ะ/,
  /เ.าะ/,
];
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
const EMPTY_TRANSCRIPT: TranscriptState = {
  status: "idle",
  segments: [],
  error: null,
};
const EMPTY_TRANSLATION: TranslationState = {
  status: "idle",
  target: null,
  data: null,
  error: null,
};

function extractVideoId(input: string) {
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

function getTranscriptParts(text: string, lang: string) {
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

function findCurrentSegmentIndex(
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

function getSentenceFromNode(node: Node | null) {
  const element =
    node instanceof Element ? node : node?.parentElement ?? null;

  return element?.closest<HTMLElement>("[data-sentence]")?.dataset.sentence ?? null;
}

function getSegmentMetadataFromNode(node: Node | null) {
  const element =
    node instanceof Element ? node : node?.parentElement ?? null;
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

function getStoredAnkiDeck() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ANKI_LAST_DECK_STORAGE_KEY) ?? "";
}

function getStoredAutoExportPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ANKI_AUTO_EXPORT_STORAGE_KEY) === "true";
}

function getStoredTheme() {
  if (typeof window === "undefined") {
    return "cozy" as StudyTheme;
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "night"
    ? ("night" as StudyTheme)
    : ("cozy" as StudyTheme);
}

function getStoredToneColorsPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TONE_COLORS_STORAGE_KEY) === "true";
}

function normalizeStudyText(text: string) {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function formatStudyTimestamp(timestamp: string | null | undefined) {
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

function buildStudyPreferencesPayload({
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

function buildStudyPreferencesSignature(payload: {
  defaultDeck: string | null;
  autoExportToAnki: boolean;
  theme: StudyTheme;
  showToneColors: boolean;
}) {
  return JSON.stringify(payload);
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[color:var(--surface-strong)] ${className}`}
      aria-hidden="true"
    />
  );
}

function toneClasses(tone: ToneLabel) {
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

function formatToneValue(value: string | null | undefined) {
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

function ToneRuleBreakdown({
  tone,
  compact = false,
}: {
  tone: ToneMetadata;
  compact?: boolean;
}) {
  const entries = [
    { label: "Class", value: tone.consonantClass },
    { label: "Type", value: tone.syllableType },
    { label: "Mark", value: tone.toneMark },
    { label: "Result", value: tone.label },
  ];

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {entries.map((entry) => (
          <div
            key={entry.label}
            className="rounded-md border border-stone-200 bg-stone-50/85 px-2.5 py-2"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
              {entry.label}
            </p>
            <p className="mt-1 text-xs font-medium text-stone-700">
              {formatToneValue(entry.value)}
            </p>
          </div>
        ))}
      </div>
      {tone.explanation ? (
        <p className="text-xs leading-5 text-stone-600">{tone.explanation}</p>
      ) : null}
    </div>
  );
}

function TonePopoverContent({
  label,
  transcriptSyllables,
  transcriptTone,
}: {
  label: string;
  transcriptSyllables: Array<{ text: string; tone: ToneMetadata }>;
  transcriptTone: ToneMetadata;
}) {
  return (
    <div className="w-[19rem] rounded-xl border border-stone-200 bg-[color:var(--surface-1)] p-3 text-left shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <span className="block space-y-2">
        {transcriptSyllables.length > 1 ? (
          transcriptSyllables.map((syllable) => (
            <span
              key={`${label}-${syllable.text}`}
              className="block rounded-lg border border-stone-200 bg-white/70 px-3 py-3"
            >
              <span className="mb-2 inline-flex rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800">
                {syllable.text}
              </span>
              <ToneRuleBreakdown tone={syllable.tone} compact />
            </span>
          ))
        ) : (
          <ToneRuleBreakdown tone={transcriptTone} compact />
        )}
      </span>
    </div>
  );
}

function PronunciationDetails({
  pronunciation,
  cardClassName = "bg-white/75",
}: {
  pronunciation: PronunciationSummary;
  cardClassName?: string;
}) {
  if (pronunciation.syllables.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm text-stone-700">
        <p>
          <span className="text-stone-500">Romanized</span>{" "}
          {pronunciation.romanized}
        </p>
        {pronunciation.ipa ? (
          <p>
            <span className="text-stone-500">IPA</span> {pronunciation.ipa}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {pronunciation.syllables.map((syllable) => (
          <div
            key={`${syllable.text}-${syllable.pronunciation}`}
            className={`rounded-lg border border-stone-200 px-3 py-2 ${cardClassName}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[0.98rem] text-stone-800">
                {syllable.text}
              </span>
              <span className={`text-xs font-semibold ${toneClasses(syllable.tone.label)}`}>
                {syllable.tone.label} tone
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {syllable.pronunciation}
              {" · "}
              {syllable.romanized}
              {syllable.ipa ? ` • ${syllable.ipa}` : ""}
            </p>
            <div className="mt-2">
              <ToneRuleBreakdown tone={syllable.tone} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTranslationDisplay(translation: string | null | undefined) {
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

function FlashcardPreviewCard({
  flashcard,
  isExported,
}: {
  flashcard: GeneratedFlashcard;
  isExported: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-[color:var(--preview-shell-border)] bg-[image:var(--preview-shell-bg)] text-[color:var(--preview-text-main)] shadow-[0_28px_70px_-40px_rgba(0,0,0,0.85)]">
      <div className="space-y-6 px-6 py-6 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--preview-text-soft)]">
              Thai Study
            </p>
            <p className="mt-3 text-[3rem] font-semibold leading-none tracking-[0.01em] text-[color:var(--preview-text-strong)]">
              {flashcard.word}
            </p>
          </div>
          {isExported ? (
            <span className="rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--success-text)]">
              Exported
            </span>
          ) : null}
        </div>

        <p className="text-[1.9rem] font-semibold leading-tight text-[color:var(--preview-accent)]">
          {formatTranslationDisplay(flashcard.chosenTranslation)}
        </p>

        <p className="text-[1.08rem] leading-[1.75] text-[color:var(--preview-text-muted)]">
          {flashcard.sentence}
        </p>

        {flashcard.includeDictionaryAudio && flashcard.dictionaryAudioUrl ? (
          <audio controls preload="none" className="w-full accent-[color:var(--preview-audio-accent)]">
            <source src={flashcard.dictionaryAudioUrl} type="audio/mpeg" />
          </audio>
        ) : null}
      </div>

      <div className="border-t border-[color:var(--preview-divider)] px-6 py-5 sm:px-7">
        <div className="grid gap-3 text-[0.97rem] text-[color:var(--preview-text-muted)]">
          <div className="grid gap-1 sm:grid-cols-[6.2rem_1fr]">
            <span className="text-[0.76rem] uppercase tracking-[0.14em] text-[color:var(--preview-text-soft)]">
              Romanized
            </span>
            <span>{flashcard.pronunciation.romanized}</span>
          </div>
        </div>
      </div>

      {flashcard.pronunciation.syllables.length > 0 ? (
        <div className="border-t border-[color:var(--preview-divider)] px-6 py-5 sm:px-7">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--preview-text-soft)]">
            Tone reasoning
          </p>
          <div className="mt-4 space-y-3">
            {flashcard.pronunciation.syllables.map((syllable) => (
              <div
                key={`${syllable.text}-${syllable.pronunciation}`}
                className="rounded-xl border border-white/8 bg-white/4 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/8 px-2.5 py-1 text-[0.98rem] text-[color:var(--preview-text-strong)]">
                    {syllable.text}
                  </span>
                  <span className={`text-xs font-semibold ${toneClasses(syllable.tone.label)}`}>
                    {syllable.tone.label} tone
                  </span>
                </div>
                <p className="mt-2 text-xs text-[color:var(--preview-text-soft)]">
                  {syllable.pronunciation}
                  {" · "}
                  {syllable.romanized}
                  {syllable.ipa ? ` • ${syllable.ipa}` : ""}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    ["Class", syllable.tone.consonantClass],
                    ["Type", syllable.tone.syllableType],
                    ["Mark", syllable.tone.toneMark],
                    ["Result", syllable.tone.label],
                  ].map(([label, value]) => (
                    <div
                      key={`${syllable.text}-${label}`}
                      className="rounded-lg border border-white/6 bg-black/10 px-3 py-2"
                    >
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--preview-text-soft)]">
                        {label}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--preview-text-main)]">
                        {formatToneValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
                {syllable.tone.explanation ? (
                  <p className="mt-3 text-xs leading-5 text-[color:var(--preview-text-muted)]">
                    {syllable.tone.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}

function transcriptToneClasses(tone: ToneLabel) {
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

function splitThaiSyllablesForTooltip(word: string) {
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

function inferTranscriptToneMetadata(syllable: string): ToneMetadata {
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
  if (
    first === "ห" &&
    consonants.length > 1 &&
    LOW_SONORANTS.has(consonants[1])
  ) {
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

function SourcePicker({
  isHydrated,
  inputError,
  isLoadingHistory,
  onInputChange,
  onSubmit,
  videoInput,
}: SourcePickerProps) {
  return (
    <section className="flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-7xl gap-5 lg:grid-cols-[0.92fr_1.05fr_0.9fr]">
        <div className="rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 shadow-[0_24px_60px_-48px_rgba(58,43,24,0.26)] backdrop-blur sm:p-10">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
              Thai Study
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--text-strong)] sm:text-[3.2rem]">
              Add a YouTube link to start
            </h1>
            <p className="max-w-xl text-base leading-7 text-[color:var(--text-main)] sm:text-lg">
              Open a Thai video, follow the transcript live, and turn useful words into
              Anki cards without leaving the study view.
            </p>
          </div>

          <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
            <input
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-[color:var(--text-strong)] shadow-sm outline-none transition focus:border-[color:var(--surface-border-strong)] focus:ring-4 focus:ring-[color:var(--input-focus)]"
              type="text"
              placeholder="Paste a YouTube URL or enter a video ID"
              value={videoInput}
              onChange={onInputChange}
              autoFocus
            />
            <button
              className="rounded-xl bg-[color:var(--accent-solid)] px-5 py-3 font-medium text-[color:var(--surface-1)] transition hover:bg-[color:var(--accent-solid-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isHydrated ? !videoInput.trim() : false}
            >
              Open
            </button>
          </form>

          {inputError ? (
            <p className="mt-4 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">
              {inputError}
            </p>
          ) : null}

          {isLoadingHistory ? (
            <div className="mt-8 space-y-3 rounded-xl border border-stone-200/80 bg-white/35 p-4">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-11/12" />
              <SkeletonBlock className="h-10 w-4/5" />
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[image:var(--tutorial-bg)] shadow-[0_24px_60px_-48px_rgba(58,43,24,0.24)] backdrop-blur">
          <div className="border-b border-[color:var(--surface-border)] px-8 py-7 sm:px-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-strong)]">
              Study from real Thai input
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--text-main)]">
              The app is built for transcript-first study: stay inside the video context,
              inspect difficult words fast, and reinforce tone patterns while you read.
            </p>
          </div>

          <div className="grid gap-4 px-8 py-8 sm:px-10">
            {[
              {
                step: "1",
                title: "Validate the link",
                body:
                  "Paste a YouTube URL. Once it loads, the video opens directly into the study workspace.",
              },
              {
                step: "2",
                title: "Read the live transcript",
                body:
                  "Follow the Thai transcript in sync with playback so each word stays tied to a real sentence.",
              },
              {
                step: "3",
                title: "Click a word for meaning",
                body:
                  "Click or select a word to see translation, examples, pronunciation, and dictionary audio when available.",
              },
              {
                step: "4",
                title: "Improve your tone recognition",
                body:
                  "Use the tone view to understand why a syllable is mid, low, high, falling, or rising instead of just memorizing labels.",
              },
              {
                step: "5",
                title: "Export clean flashcards",
                body:
                  "Review the generated card or auto-export it to Anki when you trust the default output.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="grid gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-4 py-4 shadow-[0_18px_40px_-36px_rgba(58,43,24,0.35)] sm:grid-cols-[3rem_1fr]"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent-solid)] text-lg font-semibold text-[color:var(--surface-1)]">
                  {item.step}
                </div>
                <div>
                  <p className="text-lg font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-main)]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[0_24px_60px_-48px_rgba(58,43,24,0.24)] backdrop-blur">
          <div className="border-b border-[color:var(--surface-border)] px-8 py-7 sm:px-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
              Anki Export
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-strong)]">
              Connect Anki once
            </h2>
            <p className="mt-3 text-base leading-7 text-[color:var(--text-main)]">
              Export goes through AnkiConnect. After the initial setup, cards can go
              straight into your chosen deck from the study flow.
            </p>
          </div>

          <div className="grid gap-4 px-8 py-8 sm:px-10">
            {[
              {
                title: "1. Install AnkiConnect",
                body:
                  "In Anki, open Tools > Add-ons > Get Add-ons and install code 2055492159.",
              },
              {
                title: "2. Allow this app origin",
                body:
                  "In AnkiConnect config, allow http://localhost:3000 and http://127.0.0.1:3000 or the browser will block export requests.",
              },
              {
                title: "3. Keep Anki open",
                body:
                  "The desktop app needs to be running while you study so the export service stays reachable.",
              },
              {
                title: "4. Choose a deck here",
                body:
                  "Pick the default deck from the sidebar or the flashcard dialog, then export manually or enable auto export.",
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-4 py-4 shadow-[0_18px_40px_-36px_rgba(58,43,24,0.22)]"
              >
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent-muted)] text-sm font-semibold text-[color:var(--accent-text)]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-main)]">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-[color:var(--accent-border)] bg-[color:var(--accent-muted)]/35 px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">
                When it is ready
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-main)]">
                The app will show the available decks and let you export in one click once
                Anki is reachable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sidebar({
  authStatusDetail,
  ankiDecks,
  ankiAvailable,
  ankiStatusDetail,
  ankiStatusState,
  activeSection,
  autoExportEnabled,
  currentVideoTitle,
  currentVideoId,
  hasActiveVideo,
  isAuthenticated,
  isSupabaseConfigured,
  isDeckSelectionReady,
  isExpanded,
  isLoadingHistory,
  monthlyFlashcardExportsRemaining,
  monthlyFlashcardLimit,
  quotaResetsAt,
  onChangeSource,
  onClose,
  onDeckChange,
  onOpenSignIn,
  onOpenSection,
  onOpenHistoryVideo,
  onRefreshAnki,
  onToggleAutoExport,
  onToggleTheme,
  onSignOut,
  recentVideos,
  selectedDeck,
  sidebarRef,
  showToneColors,
  theme,
  onToggleToneColors,
}: SidebarProps) {
  const railItems: Array<{ id: "settings" | "history"; icon: string; label: string }> = [
    { id: "settings", icon: "⚙", label: "Settings" },
    { id: "history", icon: "◷", label: "History" },
  ];
  const resolvedSelectedDeck = isDeckSelectionReady ? selectedDeck : "";
  const canUseDeckSelection =
    isDeckSelectionReady && ankiAvailable && ankiDecks.length > 0;

  return (
    <aside ref={sidebarRef} className="relative z-20 h-full w-[4.75rem] shrink-0">
      <div className="flex h-full flex-col rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]/94 px-3 py-4 shadow-[0_24px_50px_-44px_rgba(58,43,24,0.28)] backdrop-blur">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
          TS
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {railItems.map((item) => {
            const isActive = isExpanded && activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`flex items-center justify-center rounded-xl px-2 py-2.5 text-left transition ${
                  isActive
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                    : "text-[color:var(--text-main)] hover:bg-[color:var(--surface-3)]"
                }`}
                onClick={() => onOpenSection(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--surface-3)] text-base">
                  {item.icon}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-1 items-end justify-center">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-soft)] [writing-mode:vertical-rl]">
            Drawer
          </span>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute left-[5.5rem] top-0 h-full w-[20.5rem] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isExpanded
            ? "translate-x-0 opacity-100"
            : "-translate-x-4 opacity-0"
        }`}
      >
        <div
          className={`flex h-full flex-col rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]/96 px-4 py-4 shadow-[0_24px_60px_-40px_rgba(34,27,18,0.32)] backdrop-blur ${
            isExpanded ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                Thai Study
              </p>
              <p className="mt-1 text-sm text-[color:var(--text-main)]">
                {activeSection === "settings" ? "Settings drawer" : "Session history"}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] text-base text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
              onClick={onClose}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              ×
            </button>
          </div>

          <div className="mt-5 inline-flex rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] p-1">
            {railItems.map((item) => {
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-[color:var(--surface-1)] text-[color:var(--text-strong)] shadow-[0_10px_24px_-18px_rgba(58,43,24,0.42)]"
                      : "text-[color:var(--text-soft)] hover:text-[color:var(--text-main)]"
                  }`}
                  onClick={() => onOpenSection(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {activeSection === "settings" ? (
            <div className="mt-5 flex min-h-0 flex-1 flex-col gap-3">
              <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Account
                    </p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-strong)]">
                      Saved study data
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      isAuthenticated
                        ? "bg-[color:var(--success-bg)] text-[color:var(--success-text)]"
                        : "bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                    }`}
                  >
                    {isAuthenticated ? "Ready" : "Unavailable"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--text-main)]">
                  {authStatusDetail}
                </p>
                {isAuthenticated &&
                monthlyFlashcardExportsRemaining !== null &&
                monthlyFlashcardLimit !== null ? (
                  <p className="mt-3 text-xs leading-5 text-[color:var(--text-soft)]">
                    {monthlyFlashcardExportsRemaining} of {monthlyFlashcardLimit} free
                    exports remaining
                    {quotaResetsAt
                      ? ` · resets ${formatStudyTimestamp(quotaResetsAt) ?? "next month"}`
                      : ""}
                  </p>
                ) : null}
                {!isAuthenticated && isSupabaseConfigured ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex rounded-md border border-[color:var(--surface-border)] bg-[color:var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-1)]"
                    onClick={onOpenSignIn}
                  >
                    Open sign-in
                  </button>
                ) : null}
                {isAuthenticated ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex rounded-md border border-[color:var(--surface-border)] bg-[color:var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-1)]"
                    onClick={onSignOut}
                  >
                    Sign out
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Workspace
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2.5 text-left text-sm text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-1)]"
                    onClick={onToggleTheme}
                  >
                    <span>
                      <span className="block font-medium text-[color:var(--text-strong)]">Theme</span>
                      <span className="block text-xs text-[color:var(--text-soft)]">
                        {theme === "cozy" ? "Currently cozy" : "Currently night"}
                      </span>
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--surface-1)] text-base">
                      {theme === "cozy" ? "◐" : "◑"}
                    </span>
                  </button>

                  <label className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium text-[color:var(--text-strong)]">
                        Tone colors
                      </span>
                      <span className="block text-xs text-[color:var(--text-soft)]">
                        {showToneColors ? "Enabled in transcript" : "Disabled in transcript"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-[color:var(--input-border)] text-[color:var(--accent-solid)]"
                      checked={showToneColors}
                      onChange={onToggleToneColors}
                    />
                  </label>

                  {hasActiveVideo ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2.5 text-left text-sm text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-1)]"
                      onClick={onChangeSource}
                    >
                      <span>
                        <span className="block font-medium text-[color:var(--text-strong)]">
                          Change source
                        </span>
                        <span className="block truncate text-xs text-[color:var(--text-soft)]">
                          {currentVideoTitle || currentVideoId || "Leave current video"}
                        </span>
                      </span>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--surface-1)] text-base">
                        ↺
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Anki
                    </p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-strong)]">
                      Export connection
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      ankiStatusState === "connected"
                        ? "bg-[color:var(--success-bg)] text-[color:var(--success-text)]"
                        : ankiStatusState === "checking"
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                          : ankiStatusState === "idle"
                            ? "bg-[color:var(--surface-3)] text-[color:var(--text-soft)]"
                            : "bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]"
                    }`}
                  >
                    {ankiStatusState === "connected"
                      ? "Connected"
                      : ankiStatusState === "checking"
                        ? "Checking"
                        : ankiStatusState === "idle"
                          ? "Idle"
                          : "Issue"}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-[color:var(--text-main)]">
                  {ankiStatusDetail}
                </p>

                <div className="mt-3 space-y-2">
                  <label className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium text-[color:var(--text-strong)]">
                        Auto export
                      </span>
                      <span className="block text-xs text-[color:var(--text-soft)]">
                        {ankiAvailable && resolvedSelectedDeck
                          ? `Exports directly to ${resolvedSelectedDeck}`
                          : "Needs Anki and a selected deck"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-[color:var(--input-border)] text-[color:var(--accent-solid)]"
                      checked={autoExportEnabled}
                      onChange={onToggleAutoExport}
                    />
                  </label>

                  <div className="rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block font-medium text-[color:var(--text-strong)]">
                          Default deck
                        </span>
                        <span className="mt-0.5 block text-xs text-[color:var(--text-soft)]">
                          {ankiAvailable
                            ? "Used for exports and auto export"
                            : "Decks appear once Anki is reachable"}
                        </span>
                      </span>
                      <select
                        className="min-w-40 rounded-md border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 py-1.5 text-sm text-[color:var(--text-main)] outline-none"
                        value={resolvedSelectedDeck}
                        onChange={(event) => onDeckChange(event.target.value)}
                        disabled={!canUseDeckSelection}
                        suppressHydrationWarning
                      >
                        {ankiDecks.length === 0 ? <option value="">No decks</option> : null}
                        {ankiDecks.map((deck) => (
                          <option key={deck} value={deck}>
                            {deck}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex rounded-md border border-[color:var(--surface-border)] bg-[color:var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-1)]"
                    onClick={onRefreshAnki}
                  >
                    {ankiStatusState === "issue" ? "↻ Retry connection" : "Refresh connection"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[1rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] p-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  History
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                  Recent video sessions and study activity
                </p>
              </div>

              <div className="mt-3 space-y-2 overflow-y-auto pr-1">
                {isLoadingHistory ? (
                  <>
                    <SkeletonBlock className="h-16 w-full" />
                    <SkeletonBlock className="h-16 w-full" />
                    <SkeletonBlock className="h-16 w-5/6" />
                  </>
                ) : !isAuthenticated ? (
                  <div className="rounded-xl border border-dashed border-[color:var(--surface-border)] px-3 py-4 text-sm text-[color:var(--text-soft)]">
                    Sign-in-backed study history is not available in this session yet.
                  </div>
                ) : recentVideos.length > 0 ? (
                  recentVideos.slice(0, 7).map((entry) => (
                    <button
                      key={`${entry.videoId}-${entry.lastOpenedAt}`}
                      type="button"
                      className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-3 text-left transition hover:bg-[color:var(--surface-1)]"
                      onClick={() => onOpenHistoryVideo(entry.videoId)}
                    >
                      <p className="truncate text-sm font-medium text-[color:var(--text-strong)]">
                        {entry.videoTitle || entry.videoId}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                        {formatStudyTimestamp(entry.lastOpenedAt) ?? "Recent session"}
                      </p>
                      <p className="mt-2 text-[11px] text-[color:var(--text-soft)]">
                        {entry.totalWordClicks} clicks · {entry.flashcardsCreated} cards
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[color:var(--surface-border)] px-3 py-4 text-sm text-[color:var(--text-soft)]">
                    Your recent videos will appear here.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function TranscriptPanel({
  activeSegmentIndex,
  displayedSegments,
  isPlayerPlaying,
  onMouseUp,
  onNextPage,
  onPreviousPage,
  pageCount,
  pageStartIndex,
  showToneColors,
  transcript,
  visiblePage,
}: TranscriptPanelProps) {
  const [hoveredTonePopover, setHoveredTonePopover] = useState<{
    label: string;
    rect: DOMRect;
    transcriptSyllables: Array<{ text: string; tone: ToneMetadata }>;
    transcriptTone: ToneMetadata;
  } | null>(null);

  useEffect(() => {
    if (!hoveredTonePopover) {
      return;
    }

    function dismissPopover() {
      setHoveredTonePopover(null);
    }

    window.addEventListener("scroll", dismissPopover, true);
    window.addEventListener("resize", dismissPopover);

    return () => {
      window.removeEventListener("scroll", dismissPopover, true);
      window.removeEventListener("resize", dismissPopover);
    };
  }, [hoveredTonePopover]);

  if (transcript.status === "loading") {
    return (
      <div className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-[color:var(--surface-3)]/85 px-4 py-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-16 w-11/12" />
          <SkeletonBlock className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (transcript.status === "error") {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {transcript.error}
      </div>
    );
  }

  if (transcript.status === "ready" && transcript.segments.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
        No transcript was found for this video.
      </div>
    );
  }

  if (transcript.segments.length === 0) {
    return null;
  }

  const popoverWidth = 304;
  const popoverHeightEstimate = hoveredTonePopover?.transcriptSyllables.length &&
    hoveredTonePopover.transcriptSyllables.length > 1
    ? 300
    : 220;
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const popoverLeft = hoveredTonePopover
    ? Math.min(
        viewportWidth - popoverWidth - 12,
        Math.max(
          12,
          hoveredTonePopover.rect.left + hoveredTonePopover.rect.width / 2 - popoverWidth / 2,
        ),
      )
    : 12;
  const shouldPlaceAbove = hoveredTonePopover
    ? hoveredTonePopover.rect.bottom + 12 + popoverHeightEstimate > viewportHeight - 12
    : false;
  const popoverTop = hoveredTonePopover
    ? shouldPlaceAbove
      ? Math.max(12, hoveredTonePopover.rect.top - popoverHeightEstimate - 12)
      : Math.min(viewportHeight - popoverHeightEstimate - 12, hoveredTonePopover.rect.bottom + 12)
    : 12;

  return (
    <div className="mt-4 flex h-full flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
            {isPlayerPlaying ? "Playing" : "Paused"}
          </span>
          <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
            {visiblePage + 1} / {pageCount}
          </span>
        </div>

        {showToneColors ? (
          <div className="flex min-w-28 flex-col items-end gap-1.5 text-xs">
            <span className="font-medium uppercase tracking-[0.14em] text-stone-500">
              Tone legend
            </span>
            <span className={`font-medium ${toneClasses("high")}`}>
              High
            </span>
            <span className={`font-medium ${toneClasses("rising")}`}>
              Rising
            </span>
            <span className={`font-medium ${toneClasses("mid")}`}>
              Mid
            </span>
            <span className={`font-medium ${toneClasses("falling")}`}>
              Falling
            </span>
            <span className={`font-medium ${toneClasses("low")}`}>
              Low
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 select-text" onMouseUp={onMouseUp}>
        {displayedSegments.map((segment, index) => {
          const absoluteIndex = pageStartIndex + index;

          return (
            <p
              key={`${segment.offset}-${segment.duration}`}
              data-sentence={segment.text}
              data-offset={segment.offset}
              data-duration={segment.duration}
              aria-current={activeSegmentIndex === absoluteIndex ? "true" : undefined}
              className={`rounded-xl border px-4 py-3 text-lg leading-loose transition-all sm:text-[1.6rem] ${
                activeSegmentIndex === absoluteIndex
                  ? "border-amber-300 bg-amber-100/80 shadow-[0_12px_24px_-18px_rgba(161,98,7,0.65)] ring-1 ring-amber-300/60"
                  : "border-transparent bg-stone-50/70 hover:border-amber-200/70 hover:bg-white"
              }`}
            >
              {getTranscriptParts(segment.text, segment.lang).map((part, partIndex) =>
                part.isWordLike ? (() => {
                  const transcriptSyllables = showToneColors
                    ? splitThaiSyllablesForTooltip(part.segment).map((syllable) => ({
                        text: syllable,
                        tone: inferTranscriptToneMetadata(syllable),
                      }))
                    : [];
                  const transcriptTone =
                    transcriptSyllables[0]?.tone ??
                    (showToneColors ? inferTranscriptToneMetadata(part.segment) : null);

                  return (
                    <span key={`${segment.offset}-${partIndex}`} className="group/word relative">
                      <span
                        data-word={part.segment}
                        tabIndex={showToneColors ? 0 : -1}
                        onMouseEnter={(event) => {
                          if (!showToneColors || !transcriptTone) {
                            return;
                          }

                          setHoveredTonePopover({
                            label: part.segment,
                            rect: event.currentTarget.getBoundingClientRect(),
                            transcriptSyllables,
                            transcriptTone,
                          });
                        }}
                        onMouseLeave={() => setHoveredTonePopover(null)}
                        onFocus={(event) => {
                          if (!showToneColors || !transcriptTone) {
                            return;
                          }

                          setHoveredTonePopover({
                            label: part.segment,
                            rect: event.currentTarget.getBoundingClientRect(),
                            transcriptSyllables,
                            transcriptTone,
                          });
                        }}
                        onBlur={() => setHoveredTonePopover(null)}
                        className={`cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-amber-200/80 focus:outline-none focus:ring-2 focus:ring-emerald-300/70 ${
                          showToneColors && transcriptTone
                            ? transcriptToneClasses(transcriptTone.label)
                            : ""
                        }`}
                      >
                        {part.segment}
                      </span>
                      {"\u200B"}
                    </span>
                  );
                })() : (
                  <span key={`${segment.offset}-${partIndex}`}>{part.segment}</span>
                ),
              )}
            </p>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">
          {pageStartIndex + 1}-
          {Math.min(
            pageStartIndex + TRANSCRIPT_SEGMENTS_PER_PAGE,
            transcript.segments.length,
          )}{" "}
          / {transcript.segments.length}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:flex">
          <button
            type="button"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onPreviousPage}
            disabled={visiblePage === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onNextPage}
            disabled={visiblePage >= pageCount - 1}
          >
            Next
          </button>
        </div>
      </div>

      {hoveredTonePopover && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100]"
              style={{
                left: `${popoverLeft}px`,
                top: `${popoverTop}px`,
              }}
            >
              <TonePopoverContent
                label={hoveredTonePopover.label}
                transcriptSyllables={hoveredTonePopover.transcriptSyllables}
                transcriptTone={hoveredTonePopover.transcriptTone}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function TranslationPanel({
  autoExportEnabled,
  copiedWord,
  isAuthenticated,
  isAutoExportReady,
  monthlyFlashcardExportsRemaining,
  hasReachedMonthlyFlashcardLimit,
  onCopyWord,
  onOpenSignIn,
  onGenerateFlashcard,
  onReplayContext,
  onSelectSuggestion,
  onToggleAutoExport,
  selectedSuggestion,
  selectedDeck,
  translation,
  wordStats,
}: TranslationPanelProps) {
  if (translation.status === "idle") {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--surface-border-strong)] bg-[color:var(--surface-overlay)] p-5 text-sm leading-7 text-[color:var(--text-main)]">
        Click a word or select a phrase in the transcript.
      </div>
    );
  }

  const primarySuggestion = translation.status === "ready"
    ? translation.data.suggestions[0] ?? null
    : null;
  const alternativeSuggestions = translation.status === "ready"
    ? translation.data.suggestions.slice(1, 5)
    : [];
  const resolvedSuggestion =
    translation.status === "ready"
      ? translation.data.suggestions.find(
          (suggestion) => suggestion.translation === selectedSuggestion,
        ) ?? primarySuggestion
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--surface-3)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[2rem] leading-none text-[color:var(--text-strong)] sm:text-[2.35rem]">
              {translation.target.text}
            </p>
            {wordStats?.lastClickedAt ? (
              <p className="mt-2 text-sm text-[color:var(--text-soft)]">
                Last checked {formatStudyTimestamp(wordStats.lastClickedAt) ?? "recently"}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {translation.target.source === "click" && translation.target.segmentOffset !== null ? (
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 text-sm text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={onReplayContext}
                aria-label="Replay current context"
                title="Replay current context"
              >
                Replay
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
              onClick={onCopyWord}
              aria-label="Copy selected word"
              title="Copy selected word"
            >
              {copiedWord ? "✓" : "⧉"}
            </button>
          </div>
        </div>
      </div>

      {translation.status === "loading" ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white/45 p-4">
          <SkeletonBlock className="h-7 w-1/2" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-4/5" />
          <div className="rounded-xl border border-stone-200 bg-white/60 p-3">
            <SkeletonBlock className="h-5 w-1/3" />
            <SkeletonBlock className="mt-3 h-4 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-3/4" />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white/60 p-3">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="mt-3 h-9 w-full" />
            <SkeletonBlock className="mt-3 h-16 w-full" />
          </div>
        </div>
      ) : null}

      {translation.status === "error" ? (
        <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] p-4 text-sm leading-7 text-[color:var(--danger-text)]">
          {translation.error}
        </div>
      ) : null}

      {translation.status === "ready" ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <section className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--surface-2)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                Meaning
              </p>
              <p className="mt-2 text-[1.55rem] leading-tight text-[color:var(--text-strong)]">
                {formatTranslationDisplay(resolvedSuggestion?.translation)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {translation.data.dictionarySourceUrl ? (
                  <a
                    href={translation.data.dictionarySourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Dictionary
                  </a>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                Context
              </p>
              <div className="mt-2 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] p-3">
                <p className="text-[0.98rem] leading-6 text-[color:var(--text-strong)]">
                  {translation.target.sentence}
                </p>
              </div>
            </section>

            {alternativeSuggestions.length > 0 ? (
              <section className="space-y-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  Other readings
                </p>
                <div className="space-y-2">
                  {translation.data.suggestions.slice(0, 3).map((suggestion) => {
                    const isActive =
                      suggestion.translation ===
                      (resolvedSuggestion?.translation ?? "");

                    return (
                      <button
                        key={`${suggestion.translation}-${suggestion.score}`}
                        type="button"
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          isActive
                            ? "border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]"
                            : "border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] hover:bg-[color:var(--surface-1)]"
                        }`}
                        onClick={() => onSelectSuggestion(suggestion.translation)}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-base text-[color:var(--text-strong)]">
                            {formatTranslationDisplay(suggestion.translation)}
                          </p>
                          <span className="rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-2.5 py-1 text-xs text-[color:var(--text-soft)]">
                            {Math.round(suggestion.score * 100)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {translation.data.exampleSentences.length > 0 ? (
              <section className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  Example
                </p>
                <div
                  className="mt-2 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] p-3"
                >
                  <p className="text-[0.98rem] leading-6 text-[color:var(--text-strong)]">
                    {translation.data.exampleSentences[0].text}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)]">
                    {translation.data.exampleSentences[0].translationHint}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="space-y-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                Pronunciation
              </p>
              {translation.data.dictionaryAudioUrl ? (
                <audio controls preload="none" className="w-full">
                  <source
                    src={translation.data.dictionaryAudioUrl}
                    type="audio/mpeg"
                  />
                </audio>
              ) : null}
              <PronunciationDetails pronunciation={translation.data.pronunciation} />
            </section>
          </div>

          <div className="border-t border-[color:var(--surface-border)] pt-3">
            <div className="grid gap-3 xl:grid-cols-1">
              {!isAuthenticated ? (
                <div className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--text-main)]">
                  Create and export flashcards after signing in.
                </div>
              ) : hasReachedMonthlyFlashcardLimit ? (
                <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">
                  You reached the free monthly flashcard export limit.
                </div>
              ) : monthlyFlashcardExportsRemaining !== null ? (
                <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm text-[color:var(--text-main)]">
                  {monthlyFlashcardExportsRemaining} free flashcard exports remaining this
                  month.
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-3 text-sm text-[color:var(--text-main)]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[color:var(--input-border)] text-[color:var(--accent-solid)]"
                  checked={autoExportEnabled}
                  onChange={onToggleAutoExport}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-[color:var(--text-strong)]">Auto export</span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-[color:var(--text-soft)]">
                    {autoExportEnabled
                      ? isAutoExportReady
                        ? `Connected. Exports straight to ${selectedDeck}.`
                        : "Enabled, but waiting for Anki + deck."
                      : isAutoExportReady
                        ? `Off. Review first, then export to ${selectedDeck}.`
                        : "Off. Review first."}
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-sm font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={isAuthenticated ? onGenerateFlashcard : onOpenSignIn}
              >
                {!isAuthenticated
                  ? "Sign in to create flashcards"
                  : hasReachedMonthlyFlashcardLimit
                    ? "Free export limit reached"
                  : autoExportEnabled && isAutoExportReady
                    ? "Auto export to Anki"
                    : "Export to Anki"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FlashcardDialog({
  autoExportEnabled,
  ankiAvailable,
  ankiDecks,
  exportMessage,
  flashcard,
  isAuthenticated,
  isDeckSelectionReady,
  isExporting,
  modelName,
  onCancel,
  onChange,
  onConfirm,
  onDeckChange,
  onOpenSignIn,
  onToggleAutoExport,
  selectedDeck,
  wordStats,
}: FlashcardDialogProps) {
  const isExported = Boolean(wordStats?.exportedToAnki);
  const resolvedSelectedDeck = isDeckSelectionReady ? selectedDeck : "";
  const canUseDeckSelection =
    isDeckSelectionReady && ankiAvailable && ankiDecks.length > 0 && !isExporting;

  return (
    <div
      className="absolute inset-0 z-20 overflow-y-auto bg-stone-950/50 p-3 backdrop-blur-sm sm:p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[color:var(--accent-border)] bg-[color:var(--surface-1)] text-[color:var(--text-strong)] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.75)] sm:max-h-[calc(100vh-2rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[color:var(--accent-border)] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--accent-text)]">
                  {isExported ? "Anki Export" : "Flashcard Preview"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {isExported ? "Review exported card" : "Review before exporting"}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={onCancel}
                aria-label="Close flashcard dialog"
              >
                ×
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[0.96fr_1.14fr]">
              <section className="space-y-4 rounded-[1.5rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] p-4 text-[color:var(--text-strong)] sm:p-5">
                <div className="space-y-1 pb-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                    Input
                  </p>
                  <h3 className="text-lg font-semibold text-[color:var(--text-strong)]">
                    Card data
                  </h3>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-main)]">Anki deck</span>
                  {!isAuthenticated ? (
                    <p className="text-sm text-[color:var(--text-soft)]">
                      Sign in before exporting this card to your local Anki.
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-3 py-2 text-sm">
                    <span className={ankiAvailable ? "text-[color:var(--success-text)]" : "text-[color:var(--danger-text)]"}>
                      {ankiAvailable ? `Connected · ${modelName}` : "Unavailable"}
                    </span>
                    <select
                      className="min-w-36 rounded-md border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 py-1.5 text-sm text-[color:var(--text-main)] outline-none"
                      value={resolvedSelectedDeck}
                      onChange={(event) => onDeckChange(event.target.value)}
                      disabled={!canUseDeckSelection}
                      suppressHydrationWarning
                    >
                      {ankiDecks.length === 0 ? (
                        <option value="">No decks</option>
                      ) : null}
                      {ankiDecks.map((deck) => (
                        <option key={deck} value={deck}>
                          {deck}
                        </option>
                      ))}
                    </select>
                  </div>
                  {exportMessage.text ? (
                    <p
                      className={`text-sm ${
                        exportMessage.kind === "error"
                          ? "text-[color:var(--danger-text)]"
                          : exportMessage.kind === "success"
                            ? "text-[color:var(--success-text)]"
                            : "text-[color:var(--text-soft)]"
                      }`}
                    >
                      {exportMessage.text}
                    </p>
                  ) : null}
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-main)]">Word in Thai</span>
                  <input
                    className="w-full rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 outline-none transition focus:border-[color:var(--surface-border-strong)] focus:ring-4 focus:ring-[color:var(--input-focus)]"
                    value={flashcard.word}
                    onChange={(event) => onChange("word", event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-main)]">
                    Translation in English
                  </span>
                  <input
                    className="w-full rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 outline-none transition focus:border-[color:var(--surface-border-strong)] focus:ring-4 focus:ring-[color:var(--input-focus)]"
                    value={flashcard.chosenTranslation}
                    onChange={(event) =>
                      onChange("chosenTranslation", event.target.value)
                    }
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-main)]">Context sentence</span>
                  <textarea
                    className="min-h-32 w-full rounded-lg border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 outline-none transition focus:border-[color:var(--surface-border-strong)] focus:ring-4 focus:ring-[color:var(--input-focus)]"
                    value={flashcard.sentence}
                    onChange={(event) => onChange("sentence", event.target.value)}
                  />
                </label>

                <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-3)] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[color:var(--text-main)]">Audio</p>
                      <p className="mt-1 text-sm text-[color:var(--text-soft)]">
                        {!flashcard.dictionaryAudioUrl
                          ? "Audio not available"
                          : flashcard.includeDictionaryAudio
                            ? "Audio available and added"
                            : "Audio available but not added"}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text-main)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[color:var(--input-border)] text-[color:var(--accent-solid)]"
                        checked={flashcard.includeDictionaryAudio}
                        onChange={(event) =>
                          onChange("includeDictionaryAudio", event.target.checked)
                        }
                        disabled={!flashcard.dictionaryAudioUrl}
                      />
                      Add to card
                    </label>
                  </div>
                </div>
              </section>

              <section className="space-y-5 border-t border-[color:var(--surface-border)] pt-5 lg:border-t-0 lg:border-l lg:border-[color:var(--accent-border)] lg:pl-6 lg:pt-0">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                    Preview
                  </p>
                  <h3 className="text-lg font-semibold text-[color:var(--text-strong)]">
                    Exported card look
                  </h3>
                </div>

                <FlashcardPreviewCard
                  flashcard={flashcard}
                  isExported={isExported}
                />

                {isExported ? (
                  <div className="rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-4 py-3 text-sm text-[color:var(--success-text)]">
                    <p className="font-medium">
                      Exported to {wordStats?.exportedDeckName ?? "Anki"}
                    </p>
                    <p className="mt-1 opacity-85">
                      Note {wordStats?.exportedNoteId ?? "unknown"}
                      {wordStats?.exportedAt
                        ? ` · ${formatStudyTimestamp(wordStats.exportedAt) ?? "recently"}`
                        : ""}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="border-t border-[color:var(--accent-border)] bg-[color:var(--surface-strong)]/95 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-start gap-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm text-[color:var(--text-main)]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[color:var(--input-border)] text-[color:var(--accent-solid)]"
                  checked={autoExportEnabled}
                  onChange={onToggleAutoExport}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-[color:var(--text-strong)]">Auto export</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[color:var(--text-soft)]">
                    Skip this review next time and export in one click when Anki is ready.
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-sm font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={onCancel}
              >
                {isExported ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isExported
                    ? "border border-[color:var(--input-border)] bg-[color:var(--input-bg)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-elevated)]"
                    : "bg-[color:var(--accent-solid)] text-[color:var(--surface-1)] hover:bg-[color:var(--accent-solid-hover)]"
                }`}
                onClick={isAuthenticated ? onConfirm : onOpenSignIn}
                disabled={isAuthenticated ? (!ankiAvailable || !selectedDeck || isExporting) : false}
              >
                {!isAuthenticated
                  ? "Sign in to export"
                  : isExporting
                    ? "Exporting..."
                    : isExported
                      ? "Export again"
                      : "Export to Anki"}
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<StudyTheme>("cozy");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<"settings" | "history">("settings");
  const [ankiAvailable, setAnkiAvailable] = useState(false);
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiModelName, setAnkiModelName] = useState("ThaiStudyBasic");
  const [ankiStatusState, setAnkiStatusState] =
    useState<AnkiConnectionState>("idle");
  const [ankiStatusDetail, setAnkiStatusDetail] = useState(
    "Open the sidebar to check your local Anki connection.",
  );
  const [videoHistory, setVideoHistory] = useState<StudyVideoHistoryEntry[]>([]);
  const [studyQuota, setStudyQuota] = useState<StudyQuotaResponse | null>(null);
  const [isLoadingStudyData, setIsLoadingStudyData] = useState(true);
  const [currentWordStats, setCurrentWordStats] = useState<StudyWordStats | null>(null);
  const [sessionState, setSessionState] = useState<{
    status: "loading" | "authenticated" | "unauthenticated";
    userId: string | null;
    mode: "supabase" | "none";
  }>({
    status: "loading",
    userId: null,
    mode: "none",
  });
  const [selectedDeck, setSelectedDeck] = useState("");
  const [autoExportToAnki, setAutoExportToAnki] = useState(false);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] = useState(false);
  const [hasResolvedHostedPreferences, setHasResolvedHostedPreferences] = useState(false);
  const [isExportingToAnki, setIsExportingToAnki] = useState(false);
  const [ankiExportMessage, setAnkiExportMessage] = useState<{
    kind: "idle" | "success" | "error";
    text: string | null;
  }>({ kind: "idle", text: null });
  const [videoInput, setVideoInput] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [copiedWord, setCopiedWord] = useState(false);
  const [showToneColors, setShowToneColors] = useState(false);
  const [preferredTranslation, setPreferredTranslation] = useState<string | null>(null);
  const [generatedFlashcard, setGeneratedFlashcard] =
    useState<GeneratedFlashcard | null>(null);
  const [transcriptPage, setTranscriptPage] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(
    null,
  );
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptState>(EMPTY_TRANSCRIPT);
  const [translation, setTranslation] =
    useState<TranslationState>(EMPTY_TRANSLATION);
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const playbackSyncFrameRef = useRef<number | null>(null);
  const transcriptAbortRef = useRef<AbortController | null>(null);
  const translationAbortRef = useRef<AbortController | null>(null);
  const selectionResetTimeoutRef = useRef<number | null>(null);
  const clipboardResetTimeoutRef = useRef<number | null>(null);
  const activeSegmentIndexRef = useRef<number | null>(null);
  const wordStatsRequestIdRef = useRef(0);
  const lastSavedPreferenceSignatureRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const canUseSavedStudyData = sessionState.status === "authenticated";
  const authStatusDetail =
    sessionState.status === "authenticated"
      ? "Saved study data is scoped to your signed-in account."
      : sessionState.status === "loading"
        ? "Checking whether saved study data is available for this session."
        : sessionState.mode === "supabase"
          ? "Saved study data needs a signed-in Supabase user."
          : "Saved study data is unavailable until Supabase is configured.";

  const dismissToast = useCallback((toastId: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback(
    (
      kind: AppToast["kind"],
      title: string,
      message: string,
      source?: string | null,
      durationMs?: number,
    ) => {
      const id = toastIdRef.current + 1;
      toastIdRef.current = id;
      setToasts((currentToasts) => [
        ...currentToasts,
        {
          id,
          kind,
          title,
          message,
          source: source ?? null,
        },
      ]);

      const timeoutMs =
        durationMs ?? (kind === "error" ? 9000 : kind === "success" ? 5000 : 6000);
      window.setTimeout(() => {
        dismissToast(id);
      }, timeoutMs);
    },
    [dismissToast],
  );

  const fetchHostedStudyPreferences = useCallback(async () => {
    if (!canUseSavedStudyData) {
      return null;
    }

    const response = await fetch("/api/study/preferences", {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as StudyPreferencesResponse;
  }, [canUseSavedStudyData]);

  const persistHostedStudyPreferences = useCallback(
    async (payload: ReturnType<typeof buildStudyPreferencesPayload>) => {
      if (!canUseSavedStudyData) {
        return false;
      }

      const response = await fetch("/api/study/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    },
    [canUseSavedStudyData],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedDeck(getStoredAnkiDeck());
      setAutoExportToAnki(getStoredAutoExportPreference());
      setTheme(getStoredTheme());
      setShowToneColors(getStoredToneColorsPreference());
      setHasLoadedStoredPreferences(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredPreferences) {
      return;
    }

    if (!selectedDeck) {
      window.localStorage.removeItem(ANKI_LAST_DECK_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ANKI_LAST_DECK_STORAGE_KEY, selectedDeck);
  }, [hasLoadedStoredPreferences, selectedDeck]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(
      ANKI_AUTO_EXPORT_STORAGE_KEY,
      autoExportToAnki ? "true" : "false",
    );
  }, [autoExportToAnki, hasLoadedStoredPreferences]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [hasLoadedStoredPreferences, theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(
      TONE_COLORS_STORAGE_KEY,
      showToneColors ? "true" : "false",
    );
  }, [hasLoadedStoredPreferences, showToneColors]);

  useEffect(() => {
    if (!hasLoadedStoredPreferences) {
      return;
    }

    if (hasResolvedHostedPreferences) {
      return;
    }

    if (sessionState.status === "loading") {
      return;
    }

    if (sessionState.status !== "authenticated") {
      return;
    }

    let cancelled = false;

    const syncHostedPreferences = async () => {
      const hostedPreferences = await fetchHostedStudyPreferences();

      if (cancelled) {
        return;
      }

      if (hostedPreferences?.hasStoredPreferences) {
        setSelectedDeck(hostedPreferences.defaultDeck ?? "");
        setAutoExportToAnki(hostedPreferences.autoExportToAnki);
        setTheme(hostedPreferences.theme);
        setShowToneColors(hostedPreferences.showToneColors);
        lastSavedPreferenceSignatureRef.current = buildStudyPreferencesSignature({
          defaultDeck: hostedPreferences.defaultDeck ?? null,
          autoExportToAnki: hostedPreferences.autoExportToAnki,
          theme: hostedPreferences.theme,
          showToneColors: hostedPreferences.showToneColors,
        });
        setHasResolvedHostedPreferences(true);
        return;
      }

      const localPayload = buildStudyPreferencesPayload({
        selectedDeck,
        autoExportToAnki,
        theme,
        showToneColors,
      });
      const seeded = await persistHostedStudyPreferences(localPayload);

      if (cancelled) {
        return;
      }

      if (seeded) {
        lastSavedPreferenceSignatureRef.current =
          buildStudyPreferencesSignature(localPayload);
      }
      setHasResolvedHostedPreferences(true);
    };

    void syncHostedPreferences();

    return () => {
      cancelled = true;
    };
  }, [
    autoExportToAnki,
    fetchHostedStudyPreferences,
    hasLoadedStoredPreferences,
    hasResolvedHostedPreferences,
    persistHostedStudyPreferences,
    selectedDeck,
    sessionState.status,
    showToneColors,
    theme,
  ]);

  useEffect(() => {
    if (
      !hasLoadedStoredPreferences ||
      !hasResolvedHostedPreferences ||
      sessionState.status !== "authenticated"
    ) {
      return;
    }

    const payload = buildStudyPreferencesPayload({
      selectedDeck,
      autoExportToAnki,
      theme,
      showToneColors,
    });
    const signature = buildStudyPreferencesSignature(payload);

    if (lastSavedPreferenceSignatureRef.current === signature) {
      return;
    }

    let cancelled = false;

    const persist = async () => {
      const saved = await persistHostedStudyPreferences(payload);
      if (!cancelled && saved) {
        lastSavedPreferenceSignatureRef.current = signature;
      }
    };

    void persist();

    return () => {
      cancelled = true;
    };
  }, [
    autoExportToAnki,
    hasLoadedStoredPreferences,
    hasResolvedHostedPreferences,
    persistHostedStudyPreferences,
    selectedDeck,
    sessionState.status,
    showToneColors,
    theme,
  ]);

  useEffect(() => {
    if (!isSidebarExpanded) {
      return;
    }

    function handlePointerDown(event: Event) {
      const sidebarElement = sidebarRef.current;
      const target = event.target;

      if (!sidebarElement || !(target instanceof Node)) {
        return;
      }

      if (sidebarElement.contains(target)) {
        return;
      }

      setIsSidebarExpanded(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isSidebarExpanded]);

  function clearSelectionResetTimeout() {
    if (selectionResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(selectionResetTimeoutRef.current);
    selectionResetTimeoutRef.current = null;
  }

  function clearClipboardResetTimeout() {
    if (clipboardResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clipboardResetTimeoutRef.current);
    clipboardResetTimeoutRef.current = null;
  }

  function clearPlaybackSyncFrame() {
    if (playbackSyncFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(playbackSyncFrameRef.current);
    playbackSyncFrameRef.current = null;
  }

  function setActiveSegment(nextIndex: number | null) {
    if (activeSegmentIndexRef.current === nextIndex) {
      return;
    }

    activeSegmentIndexRef.current = nextIndex;
    setActiveSegmentIndex(nextIndex);

    if (nextIndex === null) {
      return;
    }

    const nextPage = Math.floor(nextIndex / TRANSCRIPT_SEGMENTS_PER_PAGE);
    setTranscriptPage((currentPage) =>
      currentPage === nextPage ? currentPage : nextPage,
    );
  }

  async function fetchTranscript(videoId: string) {
    transcriptAbortRef.current?.abort();

    const abortController = new AbortController();
    transcriptAbortRef.current = abortController;

    setTranscript({
      status: "loading",
      segments: [],
      error: null,
    });
    setTranscriptPage(0);

    try {
      const response = await fetch(
        `/api/transcript?videoId=${encodeURIComponent(videoId)}&lang=${TRANSCRIPT_LANGUAGE}`,
        { signal: abortController.signal },
      );

      const payload = (await response.json()) as
        | TranscriptResponse
        | TranscriptErrorResponse;

      if (!response.ok) {
        const errorMessage =
          "error" in payload ? payload.error : "Could not fetch transcript.";
        const diagnosticCode =
          "code" in payload && typeof payload.code === "string" ? payload.code : null;
        throw new Error(
          diagnosticCode ? `${errorMessage} [${diagnosticCode}]` : errorMessage,
        );
      }

      if (!("segments" in payload)) {
        throw new Error("Could not fetch transcript.");
      }

      setTranscript({
        status: "ready",
        segments: payload.segments,
        error: null,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Could not fetch transcript.";

      setTranscript({
        status: "error",
        segments: [],
        error: message,
      });
      pushToast("error", "Transcript unavailable", message, "Transcript");
      setTranscriptPage(0);
    }
  }

  async function fetchContextualTranslation(target: TranslationTarget) {
    translationAbortRef.current?.abort();

    const abortController = new AbortController();
    translationAbortRef.current = abortController;
    setPreferredTranslation(null);

    setTranslation({
      status: "loading",
      target,
      data: null,
      error: null,
    });

    try {
      const response = await fetch("/api/contextual-translation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: target.text,
          sentence: target.sentence,
        }),
        signal: abortController.signal,
      });

      const payload = (await response.json()) as
        | ContextualTranslationResponse
        | TranslationErrorResponse;

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error
            : "Could not fetch contextual translation.",
        );
      }

      if (!("suggestions" in payload)) {
        throw new Error("Could not fetch contextual translation.");
      }

      setTranslation({
        status: "ready",
        target,
        data: payload,
        error: null,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Could not fetch contextual translation.";

      setTranslation({
        status: "error",
        target,
        data: null,
        error: message,
      });
      pushToast("error", "Translation failed", message, "Translation");
    }
  }

  const fetchStudyDataSnapshot = useCallback(async () => {
    if (!canUseSavedStudyData) {
      return { nextHistory: null, nextQuota: null };
    }

    const [historyResponse, quotaResponse] = await Promise.all([
      fetch("/api/study/video-history?limit=8", {
        cache: "no-store",
      }),
      fetch("/api/study/quota", {
        cache: "no-store",
      }),
    ]);

    const nextHistory = historyResponse.ok
      ? ((await historyResponse.json()) as StudyVideoHistoryResponse).videos
      : null;
    const nextQuota = quotaResponse.ok
      ? ((await quotaResponse.json()) as StudyQuotaResponse)
      : null;

    return { nextHistory, nextQuota };
  }, [canUseSavedStudyData]);

  async function signOutSession() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
      });
    } catch {}

    setSessionState((currentState) => ({
      status: "unauthenticated",
      userId: null,
      mode: currentState.mode,
    }));
    setVideoHistory([]);
    setStudyQuota(null);
    setCurrentWordStats(null);
    setHasResolvedHostedPreferences(true);
    lastSavedPreferenceSignatureRef.current = null;
  }

  async function refreshStudyData() {
    if (!canUseSavedStudyData) {
      setVideoHistory([]);
      setStudyQuota(null);
      setCurrentWordStats(null);
      setIsLoadingStudyData(false);
      return;
    }

    setIsLoadingStudyData(true);
    try {
      const { nextHistory, nextQuota } = await fetchStudyDataSnapshot();

      if (nextHistory) {
        setVideoHistory(nextHistory);
      }
      if (nextQuota) {
        setStudyQuota(nextQuota);
      }
    } catch {
    } finally {
      setIsLoadingStudyData(false);
    }
  }

  async function recordVideoOpen(videoId: string) {
    if (!canUseSavedStudyData) {
      return;
    }

    try {
      let videoTitle: string | null = null;
      try {
        const metadataResponse = await fetch(
          `/api/video-metadata?videoId=${encodeURIComponent(videoId)}`,
          { cache: "no-store" },
        );
        if (metadataResponse.ok) {
          const metadata = (await metadataResponse.json()) as VideoMetadataResponse;
          videoTitle = metadata.title;
        }
      } catch {}

      await fetch("/api/study/video-open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId, videoTitle }),
      });
      await refreshStudyData();
    } catch {}
  }

  async function recordWordClick(videoId: string, word: string, sentence: string) {
    if (!canUseSavedStudyData) {
      setCurrentWordStats(null);
      return;
    }

    const requestId = wordStatsRequestIdRef.current + 1;
    wordStatsRequestIdRef.current = requestId;
    setCurrentWordStats(null);

    try {
      const response = await fetch("/api/study/word-click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId, word, sentence }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as StudyWordStats;
      if (wordStatsRequestIdRef.current === requestId) {
        setCurrentWordStats(payload);
      }
      await refreshStudyData();
    } catch {}
  }

  async function recordAnkiExported(
    videoId: string,
    word: string,
    sentence: string,
    noteId: number,
    deckName: string,
    modelName: string,
  ) {
    if (!canUseSavedStudyData) {
      return;
    }

    try {
      const response = await fetch("/api/study/anki-exported", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          word,
          sentence,
          noteId,
          deckName,
          modelName,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as StudyWordStats;
        setCurrentWordStats((currentStats) =>
          currentStats && currentStats.word === payload.word ? payload : currentStats,
        );
      }

      await refreshStudyData();
    } catch {}
  }

  const refreshAnkiState = useCallback(async () => {
    setAnkiStatusState("checking");
    setAnkiStatusDetail("Checking AnkiConnect and available decks.");

    try {
      const [statusPayload, selfTestPayload] = await Promise.all([
        getAnkiStatus(),
        getAnkiSelfTest(),
      ]);
      let decksPayload: AnkiDecksResponse | null = null;

      try {
        decksPayload = await getAnkiDecks();
      } catch {}

      setAnkiAvailable(
        Boolean(
          statusPayload.available &&
            selfTestPayload.available &&
            selfTestPayload.modelReady &&
            selfTestPayload.canListDecks,
        ),
      );
      setAnkiModelName(statusPayload.modelName ?? "ThaiStudyBasic");

      if (decksPayload) {
        setAnkiDecks(decksPayload.decks);
        setSelectedDeck((currentDeck) =>
          [currentDeck, getStoredAnkiDeck()].find(
            (deckName) => deckName && decksPayload.decks.includes(deckName),
          ) ?? (decksPayload.decks[0] ?? ""),
        );
        if (
          statusPayload.available &&
          selfTestPayload.available &&
          selfTestPayload.modelReady &&
          selfTestPayload.canListDecks
        ) {
          setAnkiStatusState("connected");
          setAnkiStatusDetail(
            decksPayload.decks.length > 0
              ? `${decksPayload.decks.length} deck${decksPayload.decks.length === 1 ? "" : "s"} available in ${statusPayload.modelName ?? "ThaiStudyBasic"}.`
              : "Connected to Anki, but no decks were returned.",
          );
        }
      } else {
        setAnkiDecks([]);
        if (
          statusPayload.available &&
          selfTestPayload.available &&
          selfTestPayload.modelReady
        ) {
          setAnkiStatusState("issue");
          setAnkiStatusDetail("Anki is reachable, but the app could not list decks.");
        }
      }

      if (
        !statusPayload.available ||
        !selfTestPayload.available ||
        !selfTestPayload.modelReady
      ) {
        const message =
          selfTestPayload.error ??
          statusPayload.error ??
          "AnkiConnect is not available or the export model is not ready.";
        setAnkiStatusState("issue");
        setAnkiStatusDetail(message);
        setAnkiExportMessage({
          kind: "error",
          text: message,
        });
        pushToast("error", "Anki connection issue", message, "Anki");
        return;
      }

      setAnkiExportMessage({ kind: "idle", text: null });
    } catch {
      setAnkiAvailable(false);
      setAnkiDecks([]);
      setAnkiModelName("ThaiStudyBasic");
      setAnkiStatusState("issue");
      setAnkiStatusDetail("Could not reach the Anki export service.");
      setAnkiExportMessage({
        kind: "error",
        text: "Could not reach the Anki export service.",
      });
      pushToast(
        "error",
        "Anki connection failed",
        "Could not reach the Anki export service.",
        "Anki",
      );
    }
  }, [pushToast]);

  useEffect(() => {
    if (!isSidebarExpanded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshAnkiState();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSidebarExpanded, refreshAnkiState]);

  const syncPlayer = useCallback(
    (videoId: string) => {
      if (!isYouTubeApiReady || !window.YT?.Player || !playerContainerRef.current) {
        return;
      }

      if (playerRef.current) {
        playerRef.current.cueVideoById(videoId);
        return;
      }

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: "390",
        width: "640",
        videoId,
        playerVars: {
          playsinline: 1,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              setIsPlayerPlaying(true);
              return;
            }

            setIsPlayerPlaying(false);
            setActiveSegment(null);
          },
        },
      });
    },
    [isYouTubeApiReady],
  );

  function activateVideo(videoId: string) {
    setActiveVideoId(videoId);
    setCopiedWord(false);
    setCurrentWordStats(null);
    setGeneratedFlashcard(null);
    setTranslation(EMPTY_TRANSLATION);
    setInputError(null);
    setIsPlayerPlaying(false);
    setTranscriptPage(0);
    setActiveSegment(null);
    syncPlayer(videoId);
    void fetchTranscript(videoId);
    void recordVideoOpen(videoId);
  }

  function handleChangeSource() {
    transcriptAbortRef.current?.abort();
    translationAbortRef.current?.abort();
    clearPlaybackSyncFrame();
    clearSelectionResetTimeout();
    clearClipboardResetTimeout();
    playerRef.current?.destroy();
    playerRef.current = null;

    setActiveVideoId(null);
    setAnkiExportMessage({ kind: "idle", text: null });
    setCopiedWord(false);
    setCurrentWordStats(null);
    setGeneratedFlashcard(null);
    setTranslation(EMPTY_TRANSLATION);
    setInputError(null);
    setIsPlayerPlaying(false);
    setTranscriptPage(0);
    setTranscript(EMPTY_TRANSCRIPT);
    setActiveSegment(null);
  }

  function handleVideoInputChange(event: ChangeEvent<HTMLInputElement>) {
    setVideoInput(event.target.value);

    if (inputError) {
      setInputError(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextVideoId = extractVideoId(videoInput);
    if (!nextVideoId) {
      setInputError("Enter a valid YouTube video ID or URL.");
      return;
    }

    setVideoInput(nextVideoId);
    setInputError(null);
    activateVideo(nextVideoId);
  }

  function handleOpenHistoryVideo(videoId: string) {
    setVideoInput(videoId);
    setInputError(null);
    activateVideo(videoId);
  }

  const handleYouTubeApiReady = useCallback(() => {
    setIsYouTubeApiReady(true);
  }, []);

  function handleTranslate(
    text: string,
    sentence: string,
    source: TranslationTarget["source"],
    segmentOffset: number | null,
    segmentDuration: number | null,
  ) {
    const normalizedText = normalizeStudyText(text);
    const normalizedSentence = normalizeStudyText(sentence);
    if (!normalizedText || !normalizedSentence) {
      return;
    }

    setCopiedWord(false);
    if (source !== "click") {
      setCurrentWordStats(null);
    }
    setGeneratedFlashcard(null);
    void fetchContextualTranslation({
      text: normalizedText,
      sentence: normalizedSentence,
      source,
      segmentOffset,
      segmentDuration,
    });
  }

  function handleTranscriptMouseUp(event: MouseEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    const selectedText = selection ? normalizeStudyText(selection.toString()) : "";
    const selectionSentence = getSentenceFromNode(selection?.anchorNode ?? null);
    const selectionSegment = getSegmentMetadataFromNode(selection?.anchorNode ?? null);

    if (selection && !selection.isCollapsed && selectedText && selectionSentence) {
      clearSelectionResetTimeout();
      setCurrentWordStats(null);
      handleTranslate(
        selectedText,
        selectionSentence,
        "selection",
        selectionSegment.offset,
        selectionSegment.duration,
      );

      selectionResetTimeoutRef.current = window.setTimeout(() => {
        selection.removeAllRanges();
        selectionResetTimeoutRef.current = null;
      }, 0);
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const wordElement = target.closest<HTMLElement>("[data-word]");
    const word = wordElement?.dataset.word;
    const sentenceElement = target.closest<HTMLElement>("[data-sentence]");
    const sentence = sentenceElement?.dataset.sentence;
    const segmentOffset = Number(sentenceElement?.dataset.offset);
    const segmentDuration = Number(sentenceElement?.dataset.duration);

    if (word && sentence) {
      handleTranslate(
        word,
        sentence,
        "click",
        Number.isFinite(segmentOffset) ? segmentOffset : null,
        Number.isFinite(segmentDuration) ? segmentDuration : null,
      );
      if (activeVideoId) {
        void recordWordClick(activeVideoId, word, sentence);
      }
    }
  }

  async function handleCopyWord() {
    const word = translation.target?.text?.trim();
    if (!word || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(word);
      clearClipboardResetTimeout();
      setCopiedWord(true);
      clipboardResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedWord(false);
        clipboardResetTimeoutRef.current = null;
      }, 1600);
    } catch {
      setCopiedWord(false);
    }
  }

  function handleReplayContext() {
    if (translation.target?.segmentOffset === null || translation.target?.segmentOffset === undefined) {
      return;
    }

    playerRef.current?.seekTo(translation.target.segmentOffset, true);
  }

  function buildGeneratedFlashcard(
    currentTranslation: Extract<TranslationState, { status: "ready" }>,
    chosenTranslationOverride?: string | null,
  ) {
    const clipStart = currentTranslation.target.segmentOffset;
    const clipEnd =
      clipStart !== null && currentTranslation.target.segmentDuration !== null
        ? clipStart + currentTranslation.target.segmentDuration
        : null;

    return {
      videoId: activeVideoId ?? "",
      word: currentTranslation.data.flashcardPreview.front.word,
      chosenTranslation:
        chosenTranslationOverride ||
        currentTranslation.data.flashcardPreview.back.chosenTranslation,
      sentence: currentTranslation.data.flashcardPreview.back.exampleSentence,
      clipStart,
      clipEnd,
      dictionaryAudioUrl: currentTranslation.data.dictionaryAudioUrl,
      dictionarySourceUrl: currentTranslation.data.dictionarySourceUrl,
      includeDictionaryAudio: Boolean(currentTranslation.data.dictionaryAudioUrl),
      pronunciation: currentTranslation.data.pronunciation,
      tones: currentTranslation.data.pronunciation.syllables.map((syllable) => ({
        text: syllable.text,
        label: syllable.tone.label,
        consonantClass: syllable.tone.consonantClass,
        syllableType: syllable.tone.syllableType,
        toneMark: syllable.tone.toneMark,
        rule: syllable.tone.rule,
        explanation: syllable.tone.explanation,
      })),
    } satisfies GeneratedFlashcard;
  }

  async function exportFlashcardToAnki(flashcard: GeneratedFlashcard) {
    if (!selectedDeck) {
      return;
    }

    setAnkiExportMessage({ kind: "idle", text: null });
    setIsExportingToAnki(true);

    try {
      const quotaResponse = await fetch("/api/study/quota", {
        cache: "no-store",
      });
      if (quotaResponse.ok) {
        const quotaPayload = (await quotaResponse.json()) as StudyQuotaResponse;
        setStudyQuota(quotaPayload);
        if (quotaPayload.hasReachedMonthlyFlashcardLimit) {
          throw new Error(
            "You have reached the free monthly flashcard export limit. Upgrade or wait for the monthly reset.",
          );
        }
      }

      const payload = await exportFlashcardToLocalAnki({
        deckName: selectedDeck,
        word: flashcard.word,
        translation: flashcard.chosenTranslation,
        sentence: flashcard.sentence,
        romanized: flashcard.pronunciation.romanized,
        tones: flashcard.tones.map((tone) => `${tone.text} ${tone.label}`),
        toneDetails: flashcard.pronunciation.syllables.map((syllable) => ({
          text: syllable.text,
          label: syllable.tone.label,
          pronunciation: syllable.pronunciation,
          romanized: syllable.romanized,
          ipa: syllable.ipa,
          consonantClass: syllable.tone.consonantClass,
          syllableType: syllable.tone.syllableType,
          toneMark: syllable.tone.toneMark,
          rule: syllable.tone.rule,
          explanation: syllable.tone.explanation,
        })),
        sourceUrl: flashcard.dictionarySourceUrl,
        dictionaryAudioUrl:
          flashcard.includeDictionaryAudio ? flashcard.dictionaryAudioUrl : null,
        tags: ["thai-study"],
      });

      setAnkiExportMessage({
        kind: payload.duplicate ? "error" : "success",
        text: payload.duplicate
          ? `This card already exists in Anki as note ${payload.noteId}.`
          : `Exported to ${payload.modelName} as note ${payload.noteId}${
              payload.mediaStored.length > 0
                ? ` with ${payload.mediaStored.length} media file${payload.mediaStored.length > 1 ? "s" : ""}.`
                : "."
            }${payload.warning ? ` ${payload.warning}` : ""}`,
      });
      pushToast(
        payload.duplicate ? "info" : "success",
        payload.duplicate ? "Card already exported" : "Card exported",
        payload.duplicate
          ? `Anki already has this card as note ${payload.noteId}.`
          : `Exported to ${payload.modelName} as note ${payload.noteId}.`,
        "Anki",
      );
      if (flashcard.videoId) {
        await recordAnkiExported(
          flashcard.videoId,
          flashcard.word,
          flashcard.sentence,
          payload.noteId,
          selectedDeck,
          payload.modelName,
        );
      }
    } catch (error) {
      setGeneratedFlashcard(flashcard);
      const message =
        error instanceof Error
          ? error.message
          : "Could not export the note to Anki.";
      setAnkiExportMessage({
        kind: "error",
        text: message,
      });
      setAnkiAvailable(false);
      setAnkiStatusState("issue");
      setAnkiStatusDetail(message);
      pushToast("error", "Export failed", message, "Anki");
    } finally {
      setIsExportingToAnki(false);
    }
  }

  function handleGenerateFlashcard() {
    if (translation.status !== "ready" || !activeVideoId) {
      return;
    }

    if (!canUseSavedStudyData) {
      window.location.assign("/sign-in");
      return;
    }

    if (studyQuota?.hasReachedMonthlyFlashcardLimit) {
      setAnkiExportMessage({
        kind: "error",
        text: "You reached the free monthly flashcard export limit.",
      });
      return;
    }

    const nextFlashcard = buildGeneratedFlashcard(translation, preferredTranslation);
    setAnkiExportMessage({ kind: "idle", text: null });

    if (autoExportToAnki && ankiAvailable && selectedDeck) {
      void exportFlashcardToAnki(nextFlashcard);
      return;
    }

    setGeneratedFlashcard(nextFlashcard);
  }

  function handleFlashcardChange(field: keyof GeneratedFlashcard, value: string | boolean) {
    setGeneratedFlashcard((currentFlashcard) => {
      if (!currentFlashcard) {
        return currentFlashcard;
      }

      if (field === "clipStart" || field === "clipEnd") {
        return currentFlashcard;
      }

      return {
        ...currentFlashcard,
        [field]: value,
      };
    });
  }

  function handleCancelFlashcard() {
    setGeneratedFlashcard(null);
    setAnkiExportMessage({ kind: "idle", text: null });
  }

  function handleConfirmFlashcard() {
    if (!generatedFlashcard || !selectedDeck) {
      return;
    }

    void exportFlashcardToAnki(generatedFlashcard);
  }

  useEffect(() => {
    let cancelled = false;

    const loadSessionAndStudyData = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionPayload = (await sessionResponse.json()) as AppSessionResponse;
        if (cancelled) {
          return;
        }

        if (sessionResponse.ok && sessionPayload.authenticated && sessionPayload.user) {
          setSessionState({
            status: "authenticated",
            userId: sessionPayload.user.id,
            mode: sessionPayload.mode,
          });
          setHasResolvedHostedPreferences(false);
          lastSavedPreferenceSignatureRef.current = null;

          setIsLoadingStudyData(true);
          const { nextHistory, nextQuota } = await fetchStudyDataSnapshot();

          if (cancelled) {
            return;
          }

          if (nextHistory) {
            setVideoHistory(nextHistory);
          }
          if (nextQuota) {
            setStudyQuota(nextQuota);
          }
        } else {
          setSessionState({
            status: "unauthenticated",
            userId: null,
            mode: sessionPayload.mode,
          });
          setHasResolvedHostedPreferences(true);
          lastSavedPreferenceSignatureRef.current = null;
          setVideoHistory([]);
          setStudyQuota(null);
          setCurrentWordStats(null);
        }
      } catch {
        if (!cancelled) {
          setSessionState({
            status: "unauthenticated",
            userId: null,
            mode: "none",
          });
          setHasResolvedHostedPreferences(true);
          lastSavedPreferenceSignatureRef.current = null;
          setVideoHistory([]);
          setStudyQuota(null);
          setCurrentWordStats(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStudyData(false);
        }
      }
    };

    void loadSessionAndStudyData();

    return () => {
      cancelled = true;
    };
  }, [fetchStudyDataSnapshot]);

  useEffect(() => {
    if (!activeVideoId || !isYouTubeApiReady) {
      return;
    }

    syncPlayer(activeVideoId);
  }, [activeVideoId, isYouTubeApiReady, syncPlayer]);

  useEffect(() => {
    if (!isPlayerPlaying || transcript.segments.length === 0) {
      clearPlaybackSyncFrame();
      return;
    }

    const syncCurrentSegment = () => {
      const currentTime = playerRef.current?.getCurrentTime();

      if (typeof currentTime !== "number") {
        setActiveSegment(null);
        playbackSyncFrameRef.current =
          window.requestAnimationFrame(syncCurrentSegment);
        return;
      }

      setActiveSegment(findCurrentSegmentIndex(transcript.segments, currentTime));
      playbackSyncFrameRef.current =
        window.requestAnimationFrame(syncCurrentSegment);
    };

    syncCurrentSegment();

    return () => {
      clearPlaybackSyncFrame();
    };
  }, [isPlayerPlaying, transcript.segments]);

  useEffect(() => {
    return () => {
      clearPlaybackSyncFrame();
      clearSelectionResetTimeout();
      clearClipboardResetTimeout();
      transcriptAbortRef.current?.abort();
      translationAbortRef.current?.abort();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const hasActiveVideo = activeVideoId !== null;
  const transcriptPageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(transcript.segments.length / TRANSCRIPT_SEGMENTS_PER_PAGE),
      ),
    [transcript.segments.length],
  );
  const visibleTranscriptPage = Math.min(transcriptPage, transcriptPageCount - 1);
  const transcriptPageStart = visibleTranscriptPage * TRANSCRIPT_SEGMENTS_PER_PAGE;
  const displayedSegments = useMemo(
    () =>
      transcript.segments.slice(
        transcriptPageStart,
        transcriptPageStart + TRANSCRIPT_SEGMENTS_PER_PAGE,
      ),
    [transcript.segments, transcriptPageStart],
  );
  const activeVideoHistoryEntry = useMemo(
    () =>
      activeVideoId
        ? videoHistory.find((entry) => entry.videoId === activeVideoId) ?? null
        : null,
    [activeVideoId, videoHistory],
  );
  const isAutoExportReady = ankiAvailable && Boolean(selectedDeck);

  return (
    <>
      <Script
        src={YOUTUBE_IFRAME_API_URL}
        strategy="afterInteractive"
        onReady={handleYouTubeApiReady}
      />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      <main className="relative isolate h-screen overflow-hidden">
        <div
          data-theme={theme}
          className="absolute inset-0 -z-10"
          style={{ background: "var(--app-background)" }}
        />

        <div data-theme={theme} className="mx-auto flex h-screen max-w-[98vw] gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <Sidebar
            authStatusDetail={authStatusDetail}
            ankiDecks={ankiDecks}
            ankiAvailable={ankiAvailable}
            ankiStatusDetail={ankiStatusDetail}
            ankiStatusState={ankiStatusState}
            activeSection={activeSidebarSection}
            autoExportEnabled={autoExportToAnki}
            currentVideoTitle={activeVideoHistoryEntry?.videoTitle ?? null}
            currentVideoId={activeVideoId}
            hasActiveVideo={hasActiveVideo}
            isAuthenticated={canUseSavedStudyData}
            isSupabaseConfigured={sessionState.mode === "supabase"}
            isDeckSelectionReady={hasLoadedStoredPreferences}
            isExpanded={isSidebarExpanded}
            isLoadingHistory={isLoadingStudyData}
            monthlyFlashcardExportsRemaining={
              studyQuota?.monthlyFlashcardExportsRemaining ?? null
            }
            monthlyFlashcardLimit={studyQuota?.monthlyFlashcardLimit ?? null}
            quotaResetsAt={studyQuota?.resetsAt ?? null}
            onChangeSource={handleChangeSource}
            onClose={() => setIsSidebarExpanded(false)}
            onDeckChange={setSelectedDeck}
            onOpenSignIn={() => {
              window.location.assign("/sign-in");
            }}
            onOpenSection={(section) => {
              setActiveSidebarSection(section);
              setIsSidebarExpanded(true);
            }}
            onOpenHistoryVideo={handleOpenHistoryVideo}
            onRefreshAnki={() => {
              void refreshAnkiState();
            }}
            onToggleAutoExport={() =>
              setAutoExportToAnki((currentValue) => !currentValue)
            }
            onToggleTheme={() =>
              setTheme((currentTheme) =>
                currentTheme === "cozy" ? "night" : "cozy",
              )
            }
            onSignOut={() => {
              void signOutSession();
            }}
            recentVideos={videoHistory}
            selectedDeck={selectedDeck}
            sidebarRef={sidebarRef}
            showToneColors={showToneColors}
            theme={theme}
            onToggleToneColors={() =>
              setShowToneColors((currentValue) => !currentValue)
            }
          />

          {hasActiveVideo ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <section className="flex flex-col gap-3 rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-5 py-4 shadow-[0_24px_50px_-44px_rgba(58,43,24,0.22)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    Current Video
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold text-[color:var(--text-strong)]">
                    {activeVideoHistoryEntry?.videoTitle || activeVideoId}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 text-sm font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                  onClick={handleChangeSource}
                >
                  Change Video
                </button>
              </section>

              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[24fr_44fr_24fr] xl:items-stretch">
                <section className="flex items-center rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 shadow-[0_24px_50px_-44px_rgba(58,43,24,0.24)] backdrop-blur">
                  <div className="w-full rounded-xl border border-stone-950/8 bg-stone-950/92 p-3 shadow-inner shadow-black/10">
                    <div
                      ref={playerContainerRef}
                      className="aspect-video w-full overflow-hidden rounded-lg bg-black"
                    />
                  </div>
                </section>

                <section className="min-h-0 overflow-hidden rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 shadow-[0_24px_50px_-44px_rgba(58,43,24,0.22)] backdrop-blur sm:p-6">
                  <TranscriptPanel
                    activeSegmentIndex={activeSegmentIndex}
                    displayedSegments={displayedSegments}
                    isPlayerPlaying={isPlayerPlaying}
                    onMouseUp={handleTranscriptMouseUp}
                    onNextPage={() =>
                      setTranscriptPage((currentPage) =>
                        Math.min(transcriptPageCount - 1, currentPage + 1),
                      )
                    }
                    onPreviousPage={() =>
                      setTranscriptPage((currentPage) => Math.max(0, currentPage - 1))
                    }
                    pageCount={transcriptPageCount}
                    pageStartIndex={transcriptPageStart}
                    showToneColors={showToneColors}
                    transcript={transcript}
                    visiblePage={visibleTranscriptPage}
                  />
                </section>

                <aside className="min-h-0 overflow-hidden rounded-[1.4rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-2)] p-4 text-stone-800 shadow-[0_24px_50px_-44px_rgba(58,43,24,0.2)] backdrop-blur">
                  <TranslationPanel
                    autoExportEnabled={autoExportToAnki}
                    copiedWord={copiedWord}
                    isAuthenticated={canUseSavedStudyData}
                    isAutoExportReady={isAutoExportReady}
                    monthlyFlashcardExportsRemaining={
                      studyQuota?.monthlyFlashcardExportsRemaining ?? null
                    }
                    hasReachedMonthlyFlashcardLimit={
                      studyQuota?.hasReachedMonthlyFlashcardLimit ?? false
                    }
                    onCopyWord={handleCopyWord}
                    onOpenSignIn={() => {
                      window.location.assign("/sign-in");
                    }}
                    onGenerateFlashcard={handleGenerateFlashcard}
                    onReplayContext={handleReplayContext}
                    onSelectSuggestion={setPreferredTranslation}
                    onToggleAutoExport={() =>
                      setAutoExportToAnki((currentValue) => !currentValue)
                    }
                    selectedSuggestion={preferredTranslation}
                    selectedDeck={selectedDeck}
                    translation={translation}
                    wordStats={currentWordStats}
                  />
                </aside>
              </div>
            </div>
          ) : (
            <SourcePicker
              isHydrated={isHydrated}
              inputError={inputError}
              isLoadingHistory={isLoadingStudyData}
              onInputChange={handleVideoInputChange}
              onSubmit={handleSubmit}
              videoInput={videoInput}
            />
          )}
        </div>

        {generatedFlashcard ? (
          <FlashcardDialog
            autoExportEnabled={autoExportToAnki}
            ankiAvailable={ankiAvailable}
            ankiDecks={ankiDecks}
            exportMessage={ankiExportMessage}
            flashcard={generatedFlashcard}
            isAuthenticated={canUseSavedStudyData}
            isDeckSelectionReady={hasLoadedStoredPreferences}
            isExporting={isExportingToAnki}
            modelName={ankiModelName}
            onCancel={handleCancelFlashcard}
            onChange={handleFlashcardChange}
            onConfirm={handleConfirmFlashcard}
            onDeckChange={setSelectedDeck}
            onOpenSignIn={() => {
              window.location.assign("/sign-in");
            }}
            onToggleAutoExport={() =>
              setAutoExportToAnki((currentValue) => !currentValue)
            }
            selectedDeck={selectedDeck}
            wordStats={currentWordStats}
          />
        ) : null}
      </main>
    </>
  );
}
