"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  exportFlashcardToLocalAnki,
  getAnkiDecks,
  getAnkiSelfTest,
  getAnkiStatus,
  type AnkiDecksResponse,
} from "@/lib/anki/local-bridge";
import { getStoredAnkiDeck, type GeneratedFlashcard, type StudyQuotaResponse } from "@/lib/study/shared";

type PushToast = (
  kind: "success" | "error" | "info",
  title: string,
  message: string,
  source?: string | null,
  durationMs?: number,
) => void;

export function useAnkiIntegration({
  isSidebarExpanded,
  pushToast,
  recordAnkiExported,
  selectedDeck,
  setSelectedDeck,
  setStudyQuota,
}: {
  isSidebarExpanded: boolean;
  pushToast: PushToast;
  recordAnkiExported: (
    videoId: string,
    word: string,
    sentence: string,
    noteId: number,
    deckName: string,
    modelName: string,
  ) => Promise<void>;
  selectedDeck: string;
  setSelectedDeck: Dispatch<SetStateAction<string>>;
  setStudyQuota: Dispatch<SetStateAction<StudyQuotaResponse | null>>;
}) {
  const [ankiAvailable, setAnkiAvailable] = useState(false);
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiModelName, setAnkiModelName] = useState("ThaiStudyBasic");
  const [ankiStatusState, setAnkiStatusState] =
    useState<"idle" | "checking" | "connected" | "issue">("idle");
  const [ankiStatusDetail, setAnkiStatusDetail] = useState(
    "Open the sidebar to check your local Anki connection.",
  );
  const [isExportingToAnki, setIsExportingToAnki] = useState(false);
  const [ankiExportMessage, setAnkiExportMessage] = useState<{
    kind: "idle" | "success" | "error";
    text: string | null;
  }>({ kind: "idle", text: null });

  const refreshAnkiState = useCallback(
    async (options?: { suppressToast?: boolean }) => {
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

        const isReady = Boolean(
          statusPayload.available &&
            selfTestPayload.available &&
            selfTestPayload.modelReady &&
            selfTestPayload.canListDecks,
        );

        setAnkiAvailable(isReady);
        setAnkiModelName(statusPayload.modelName ?? "ThaiStudyBasic");

        if (decksPayload) {
          setAnkiDecks(decksPayload.decks);
          setSelectedDeck((currentDeck) =>
            [currentDeck, getStoredAnkiDeck()].find(
              (deckName) => deckName && decksPayload.decks.includes(deckName),
            ) ?? (decksPayload.decks[0] ?? ""),
          );
          if (isReady) {
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

        if (!isReady) {
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
          if (!options?.suppressToast) {
            pushToast("error", "Anki connection issue", message, "Anki");
          }
          return {
            available: false as const,
            message,
          };
        }

        setAnkiExportMessage({ kind: "idle", text: null });
        return {
          available: true as const,
        };
      } catch {
        const message = "Could not reach the Anki export service.";
        setAnkiAvailable(false);
        setAnkiDecks([]);
        setAnkiModelName("ThaiStudyBasic");
        setAnkiStatusState("issue");
        setAnkiStatusDetail(message);
        setAnkiExportMessage({
          kind: "error",
          text: message,
        });
        if (!options?.suppressToast) {
          pushToast("error", "Anki connection failed", message, "Anki");
        }
        return {
          available: false as const,
          message,
        };
      }
    },
    [pushToast, setSelectedDeck],
  );

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

  const exportFlashcardToAnki = useCallback(
    async (flashcard: GeneratedFlashcard) => {
      if (!selectedDeck) {
        return;
      }

      setAnkiExportMessage({ kind: "idle", text: null });
      setIsExportingToAnki(true);

      try {
        const connectionState = await refreshAnkiState({ suppressToast: true });
        if (!connectionState.available) {
          throw new Error(connectionState.message);
        }

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
        const message =
          error instanceof Error ? error.message : "Could not export the note to Anki.";
        setAnkiExportMessage({
          kind: "error",
          text: message,
        });
        setAnkiAvailable(false);
        setAnkiStatusState("issue");
        setAnkiStatusDetail(message);
        pushToast("error", "Export failed", message, "Anki");
        throw error;
      } finally {
        setIsExportingToAnki(false);
      }
    },
    [pushToast, recordAnkiExported, refreshAnkiState, selectedDeck, setStudyQuota],
  );

  return {
    ankiAvailable,
    ankiDecks,
    ankiExportMessage,
    ankiModelName,
    ankiStatusDetail,
    ankiStatusState,
    exportFlashcardToAnki,
    isExportingToAnki,
    refreshAnkiState,
    setAnkiExportMessage,
  };
}
