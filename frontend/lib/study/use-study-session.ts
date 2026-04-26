"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AppSessionResponse,
  type StudyQuotaResponse,
  type StudyVideoHistoryEntry,
  type StudyVideoHistoryResponse,
  type StudyWordStats,
  type VideoMetadataResponse,
} from "@/lib/study/shared";

export type StudySessionState = {
  status: "loading" | "authenticated" | "unauthenticated";
  userId: string | null;
  mode: "supabase" | "none";
};

export function useStudySession({
}: Record<string, never> = {}) {
  const [sessionState, setSessionState] = useState<StudySessionState>({
    status: "loading",
    userId: null,
    mode: "none",
  });
  const [videoHistory, setVideoHistory] = useState<StudyVideoHistoryEntry[]>([]);
  const [studyQuota, setStudyQuota] = useState<StudyQuotaResponse | null>(null);
  const [isLoadingStudyData, setIsLoadingStudyData] = useState(true);
  const [currentWordStats, setCurrentWordStats] = useState<StudyWordStats | null>(null);
  const canUseSavedStudyData = sessionState.status === "authenticated";

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

  const refreshStudyData = useCallback(async () => {
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
  }, [canUseSavedStudyData, fetchStudyDataSnapshot]);

  const signOutSession = useCallback(async () => {
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
  }, []);

  const recordVideoOpen = useCallback(
    async (videoId: string) => {
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
    },
    [canUseSavedStudyData, refreshStudyData],
  );

  const recordWordClick = useCallback(
    async (requestId: number, videoId: string, word: string, sentence: string) => {
      if (!canUseSavedStudyData) {
        setCurrentWordStats(null);
        return null;
      }

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
          return null;
        }

        const payload = (await response.json()) as StudyWordStats;
        await refreshStudyData();
        return { requestId, payload };
      } catch {
        return null;
      }
    },
    [canUseSavedStudyData, refreshStudyData],
  );

  const recordAnkiExported = useCallback(
    async (
      videoId: string,
      word: string,
      sentence: string,
      noteId: number,
      deckName: string,
      modelName: string,
    ) => {
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
    },
    [canUseSavedStudyData, refreshStudyData],
  );

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

  return {
    canUseSavedStudyData,
    currentWordStats,
    isLoadingStudyData,
    recordAnkiExported,
    recordVideoOpen,
    recordWordClick,
    refreshStudyData,
    sessionState,
    setCurrentWordStats,
    setStudyQuota,
    signOutSession,
    studyQuota,
    videoHistory,
  };
}
