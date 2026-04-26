"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type TranscriptSegment,
  type YouTubePlayer,
  TRANSCRIPT_SEGMENTS_PER_PAGE,
  findCurrentSegmentIndex,
} from "@/lib/study/shared";

export function useVideoPlayer({
  activeVideoId,
  transcriptSegments,
}: {
  activeVideoId: string | null;
  transcriptSegments: TranscriptSegment[];
}) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState(false);
  const [transcriptPage, setTranscriptPage] = useState(0);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playbackSyncFrameRef = useRef<number | null>(null);
  const activeSegmentIndexRef = useRef<number | null>(null);

  const clearPlaybackSyncFrame = useCallback(() => {
    if (playbackSyncFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(playbackSyncFrameRef.current);
    playbackSyncFrameRef.current = null;
  }, []);

  const setResolvedActiveSegment = useCallback((nextIndex: number | null) => {
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
  }, []);

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
            setResolvedActiveSegment(null);
          },
        },
      });
    },
    [isYouTubeApiReady, setResolvedActiveSegment],
  );

  useEffect(() => {
    if (!activeVideoId || !isYouTubeApiReady) {
      return;
    }

    syncPlayer(activeVideoId);
  }, [activeVideoId, isYouTubeApiReady, syncPlayer]);

  useEffect(() => {
    if (!isPlayerPlaying || transcriptSegments.length === 0) {
      clearPlaybackSyncFrame();
      return;
    }

    const syncCurrentSegment = () => {
      const currentTime = playerRef.current?.getCurrentTime();

      if (typeof currentTime !== "number") {
        setResolvedActiveSegment(null);
        playbackSyncFrameRef.current = window.requestAnimationFrame(syncCurrentSegment);
        return;
      }

      setResolvedActiveSegment(findCurrentSegmentIndex(transcriptSegments, currentTime));
      playbackSyncFrameRef.current = window.requestAnimationFrame(syncCurrentSegment);
    };

    syncCurrentSegment();

    return () => {
      clearPlaybackSyncFrame();
    };
  }, [clearPlaybackSyncFrame, isPlayerPlaying, setResolvedActiveSegment, transcriptSegments]);

  useEffect(() => {
    return () => {
      clearPlaybackSyncFrame();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [clearPlaybackSyncFrame]);

  const transcriptPageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(transcriptSegments.length / TRANSCRIPT_SEGMENTS_PER_PAGE),
      ),
    [transcriptSegments.length],
  );
  const visibleTranscriptPage = Math.min(transcriptPage, transcriptPageCount - 1);
  const transcriptPageStart = visibleTranscriptPage * TRANSCRIPT_SEGMENTS_PER_PAGE;
  const displayedSegments = useMemo(
    () =>
      transcriptSegments.slice(
        transcriptPageStart,
        transcriptPageStart + TRANSCRIPT_SEGMENTS_PER_PAGE,
      ),
    [transcriptPageStart, transcriptSegments],
  );

  const handleYouTubeApiReady = useCallback(() => {
    setIsYouTubeApiReady(true);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const resetPlayerState = useCallback(() => {
    clearPlaybackSyncFrame();
    playerRef.current?.destroy();
    playerRef.current = null;
    setIsPlayerPlaying(false);
    setTranscriptPage(0);
    setResolvedActiveSegment(null);
  }, [clearPlaybackSyncFrame, setResolvedActiveSegment]);

  return {
    activeSegmentIndex,
    displayedSegments,
    handleYouTubeApiReady,
    isPlayerPlaying,
    isYouTubeApiReady,
    playerContainerRef,
    resetPlayerState,
    seekTo,
    setTranscriptPage,
    transcriptPageCount,
    transcriptPageStart,
    visibleTranscriptPage,
  };
}
