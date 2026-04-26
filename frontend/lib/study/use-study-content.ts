"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react";

import {
  type ContextualTranslationResponse,
  type GeneratedFlashcard,
  type StudyWordStats,
  type TranscriptErrorResponse,
  type TranscriptResponse,
  type TranscriptState,
  type TranslationErrorResponse,
  type TranslationState,
  type TranslationTarget,
  EMPTY_TRANSLATION,
  EMPTY_TRANSCRIPT,
  TRANSCRIPT_LANGUAGE,
  getSegmentMetadataFromNode,
  getSentenceFromNode,
  normalizeStudyText,
} from "@/lib/study/shared";

type PushToast = (
  kind: "success" | "error" | "info",
  title: string,
  message: string,
  source?: string | null,
  durationMs?: number,
) => void;

export function useStudyContent({
  activeVideoId,
  ankiAvailable,
  autoExportToAnki,
  canUseSavedStudyData,
  exportFlashcardToAnki,
  hasReachedMonthlyFlashcardLimit,
  pushToast,
  recordWordClick,
  selectedDeck,
  setCurrentWordStats,
}: {
  activeVideoId: string | null;
  ankiAvailable: boolean;
  autoExportToAnki: boolean;
  canUseSavedStudyData: boolean;
  exportFlashcardToAnki: (flashcard: GeneratedFlashcard) => Promise<void>;
  hasReachedMonthlyFlashcardLimit: boolean;
  pushToast: PushToast;
  recordWordClick: (
    requestId: number,
    videoId: string,
    word: string,
    sentence: string,
  ) => Promise<{ requestId: number; payload: StudyWordStats } | null>;
  selectedDeck: string;
  setCurrentWordStats: Dispatch<SetStateAction<StudyWordStats | null>>;
}) {
  const [copiedWord, setCopiedWord] = useState(false);
  const [preferredTranslation, setPreferredTranslation] = useState<string | null>(null);
  const [generatedFlashcard, setGeneratedFlashcard] = useState<GeneratedFlashcard | null>(null);
  const [transcript, setTranscript] = useState<TranscriptState>(EMPTY_TRANSCRIPT);
  const [translation, setTranslation] = useState<TranslationState>(EMPTY_TRANSLATION);

  const transcriptAbortRef = useRef<AbortController | null>(null);
  const translationAbortRef = useRef<AbortController | null>(null);
  const selectionResetTimeoutRef = useRef<number | null>(null);
  const clipboardResetTimeoutRef = useRef<number | null>(null);
  const wordStatsRequestIdRef = useRef(0);

  const clearSelectionResetTimeout = useCallback(() => {
    if (selectionResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(selectionResetTimeoutRef.current);
    selectionResetTimeoutRef.current = null;
  }, []);

  const clearClipboardResetTimeout = useCallback(() => {
    if (clipboardResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(clipboardResetTimeoutRef.current);
    clipboardResetTimeoutRef.current = null;
  }, []);

  const fetchTranscript = useCallback(
    async (videoId: string, resetTranscriptPage: () => void) => {
      transcriptAbortRef.current?.abort();

      const abortController = new AbortController();
      transcriptAbortRef.current = abortController;

      setTranscript({
        status: "loading",
        segments: [],
        error: null,
      });
      resetTranscriptPage();

      try {
        const response = await fetch(
          `/api/transcript?videoId=${encodeURIComponent(videoId)}&lang=${TRANSCRIPT_LANGUAGE}`,
          { signal: abortController.signal },
        );

        const payload = (await response.json()) as TranscriptResponse | TranscriptErrorResponse;

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
        resetTranscriptPage();
      }
    },
    [pushToast],
  );

  const fetchContextualTranslation = useCallback(
    async (target: TranslationTarget) => {
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
            "error" in payload ? payload.error : "Could not fetch contextual translation.",
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
    },
    [pushToast],
  );

  const handleTranslate = useCallback(
    (
      text: string,
      sentence: string,
      source: TranslationTarget["source"],
      segmentOffset: number | null,
      segmentDuration: number | null,
    ) => {
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
    },
    [fetchContextualTranslation, setCurrentWordStats],
  );

  const handleTranscriptMouseUp = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
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
          const requestId = wordStatsRequestIdRef.current + 1;
          wordStatsRequestIdRef.current = requestId;
          void recordWordClick(requestId, activeVideoId, word, sentence).then((result) => {
            if (result && wordStatsRequestIdRef.current === result.requestId) {
              setCurrentWordStats(result.payload);
            }
          });
        }
      }
    },
    [
      activeVideoId,
      clearSelectionResetTimeout,
      handleTranslate,
      recordWordClick,
      setCurrentWordStats,
    ],
  );

  const handleCopyWord = useCallback(async () => {
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
  }, [clearClipboardResetTimeout, translation.target?.text]);

  const buildGeneratedFlashcard = useCallback(
    (
      currentTranslation: Extract<TranslationState, { status: "ready" }>,
      chosenTranslationOverride?: string | null,
    ) => {
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
    },
    [activeVideoId],
  );

  const handleGenerateFlashcard = useCallback(() => {
    if (translation.status !== "ready" || !activeVideoId) {
      return { shouldOpenSignIn: false };
    }

    if (!canUseSavedStudyData) {
      return { shouldOpenSignIn: true };
    }

    if (hasReachedMonthlyFlashcardLimit) {
      return { shouldOpenSignIn: false, error: "You reached the free monthly flashcard export limit." };
    }

    const nextFlashcard = buildGeneratedFlashcard(translation, preferredTranslation);

    if (autoExportToAnki && ankiAvailable && selectedDeck) {
      void exportFlashcardToAnki(nextFlashcard).catch(() => {
        setGeneratedFlashcard(nextFlashcard);
      });
      return { shouldOpenSignIn: false };
    }

    setGeneratedFlashcard(nextFlashcard);
    return { shouldOpenSignIn: false };
  }, [
    activeVideoId,
    ankiAvailable,
    autoExportToAnki,
    buildGeneratedFlashcard,
    canUseSavedStudyData,
    exportFlashcardToAnki,
    hasReachedMonthlyFlashcardLimit,
    preferredTranslation,
    selectedDeck,
    translation,
  ]);

  const handleFlashcardChange = useCallback(
    (field: keyof GeneratedFlashcard, value: string | boolean) => {
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
    },
    [],
  );

  const handleCancelFlashcard = useCallback(() => {
    setGeneratedFlashcard(null);
  }, []);

  const handleConfirmFlashcard = useCallback(() => {
    if (!generatedFlashcard || !selectedDeck) {
      return;
    }

    void exportFlashcardToAnki(generatedFlashcard).catch(() => {
      setGeneratedFlashcard(generatedFlashcard);
    });
  }, [exportFlashcardToAnki, generatedFlashcard, selectedDeck]);

  const resetContentState = useCallback(() => {
    transcriptAbortRef.current?.abort();
    translationAbortRef.current?.abort();
    clearSelectionResetTimeout();
    clearClipboardResetTimeout();
    setCopiedWord(false);
    setCurrentWordStats(null);
    setGeneratedFlashcard(null);
    setPreferredTranslation(null);
    setTranslation(EMPTY_TRANSLATION);
    setTranscript(EMPTY_TRANSCRIPT);
  }, [clearClipboardResetTimeout, clearSelectionResetTimeout, setCurrentWordStats]);

  useEffect(() => {
    return () => {
      clearSelectionResetTimeout();
      clearClipboardResetTimeout();
      transcriptAbortRef.current?.abort();
      translationAbortRef.current?.abort();
    };
  }, [clearClipboardResetTimeout, clearSelectionResetTimeout]);

  return {
    copiedWord,
    fetchTranscript,
    generatedFlashcard,
    handleCancelFlashcard,
    handleConfirmFlashcard,
    handleCopyWord,
    handleFlashcardChange,
    handleGenerateFlashcard,
    handleTranscriptMouseUp,
    preferredTranslation,
    resetContentState,
    setGeneratedFlashcard,
    setPreferredTranslation,
    transcript,
    translation,
  };
}
