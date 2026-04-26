"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";

import {
  FlashcardDialog as StudyFlashcardDialog,
  Sidebar as StudySidebar,
  SourcePicker as StudySourcePicker,
  TranscriptPanel as StudyTranscriptPanel,
  TranslationPanel as StudyTranslationPanel,
} from "@/components/study/panels";
import {
  YOUTUBE_IFRAME_API_URL,
  extractVideoId,
} from "@/lib/study/shared";
import { useAppToasts } from "@/lib/study/use-app-toasts";
import { useAnkiIntegration } from "@/lib/study/use-anki-integration";
import { useStudyContent } from "@/lib/study/use-study-content";
import { useStudyPreferences } from "@/lib/study/use-study-preferences";
import { useStudySession } from "@/lib/study/use-study-session";
import { useVideoPlayer } from "@/lib/study/use-video-player";
import { ToastViewport } from "@/components/toast";

export default function Home() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<"settings" | "history">("settings");
  const [videoInput, setVideoInput] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLElement | null>(null);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { dismissToast, pushToast, toasts } = useAppToasts();
  const {
    canUseSavedStudyData,
    currentWordStats,
    isLoadingStudyData,
    recordAnkiExported,
    recordVideoOpen,
    recordWordClick,
    sessionState,
    setCurrentWordStats,
    setStudyQuota,
    signOutSession,
    studyQuota,
    videoHistory,
  } = useStudySession();
  const {
    autoExportToAnki,
    hasLoadedStoredPreferences,
    selectedDeck,
    setAutoExportToAnki,
    setSelectedDeck,
    setShowToneColors,
    setTheme,
    showToneColors,
    theme,
  } = useStudyPreferences({
    canUseSavedStudyData,
    sessionStatus: sessionState.status,
  });
  const {
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
  } = useAnkiIntegration({
    isSidebarExpanded,
    pushToast,
    recordAnkiExported,
    selectedDeck,
    setSelectedDeck,
    setStudyQuota,
  });
  const {
    copiedWord,
    fetchTranscript,
    generatedFlashcard,
    handleCancelFlashcard,
    handleConfirmFlashcard,
    handleCopyWord,
    handleFlashcardChange,
    handleGenerateFlashcard: handleGenerateFlashcardAction,
    handleTranscriptMouseUp,
    preferredTranslation,
    resetContentState,
    setPreferredTranslation,
    transcript,
    translation,
  } = useStudyContent({
    activeVideoId,
    ankiAvailable,
    autoExportToAnki,
    canUseSavedStudyData,
    exportFlashcardToAnki,
    hasReachedMonthlyFlashcardLimit:
      studyQuota?.hasReachedMonthlyFlashcardLimit ?? false,
    pushToast,
    recordWordClick,
    selectedDeck,
    setCurrentWordStats,
  });
  const {
    activeSegmentIndex,
    displayedSegments,
    handleYouTubeApiReady,
    isPlayerPlaying,
    playerContainerRef,
    resetPlayerState,
    seekTo,
    setTranscriptPage,
    transcriptPageCount,
    transcriptPageStart,
    visibleTranscriptPage,
  } = useVideoPlayer({
    activeVideoId,
    transcriptSegments: transcript.segments,
  });
  const authStatusDetail =
    sessionState.status === "authenticated"
      ? "Saved study data is scoped to your signed-in account."
      : sessionState.status === "loading"
        ? "Checking whether saved study data is available for this session."
        : sessionState.mode === "supabase"
          ? "Saved study data needs a signed-in Supabase user."
          : "Saved study data is unavailable until Supabase is configured.";

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

  function activateVideo(videoId: string) {
    setActiveVideoId(videoId);
    setInputError(null);
    resetPlayerState();
    resetContentState();
    void fetchTranscript(videoId, () => setTranscriptPage(0));
    void recordVideoOpen(videoId);
  }

  function handleChangeSource() {
    setActiveVideoId(null);
    setAnkiExportMessage({ kind: "idle", text: null });
    setInputError(null);
    resetPlayerState();
    resetContentState();
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

  function handleReplayContext() {
    if (translation.target?.segmentOffset === null || translation.target?.segmentOffset === undefined) {
      return;
    }

    seekTo(translation.target.segmentOffset);
  }

  function handleGenerateFlashcard() {
    const result = handleGenerateFlashcardAction();
    if (result.shouldOpenSignIn) {
      window.location.assign("/sign-in");
      return;
    }
    if (result.error) {
      setAnkiExportMessage({
        kind: "error",
        text: result.error,
      });
    }
  }

  useEffect(() => {
    return () => {
      resetPlayerState();
      resetContentState();
    };
  }, [resetContentState, resetPlayerState]);

  const hasActiveVideo = activeVideoId !== null;
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
          <StudySidebar
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
                  <StudyTranscriptPanel
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
                  <StudyTranslationPanel
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
            <StudySourcePicker
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
          <StudyFlashcardDialog
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
