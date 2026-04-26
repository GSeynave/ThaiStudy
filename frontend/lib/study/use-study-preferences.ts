"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type StudyPreferencesResponse,
  type StudyTheme,
  ANKI_AUTO_EXPORT_STORAGE_KEY,
  ANKI_LAST_DECK_STORAGE_KEY,
  THEME_STORAGE_KEY,
  TONE_COLORS_STORAGE_KEY,
  buildStudyPreferencesPayload,
  buildStudyPreferencesSignature,
  getStoredAnkiDeck,
  getStoredAutoExportPreference,
  getStoredTheme,
  getStoredToneColorsPreference,
} from "@/lib/study/shared";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useStudyPreferences({
  canUseSavedStudyData,
  sessionStatus,
}: {
  canUseSavedStudyData: boolean;
  sessionStatus: SessionStatus;
}) {
  const [selectedDeck, setSelectedDeck] = useState("");
  const [autoExportToAnki, setAutoExportToAnki] = useState(false);
  const [theme, setTheme] = useState<StudyTheme>("cozy");
  const [showToneColors, setShowToneColors] = useState(false);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] = useState(false);
  const [hasResolvedHostedPreferences, setHasResolvedHostedPreferences] = useState(false);
  const lastSavedPreferenceSignatureRef = useRef<string | null>(null);

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
    if (typeof window === "undefined" || !hasLoadedStoredPreferences) {
      return;
    }

    if (!selectedDeck) {
      window.localStorage.removeItem(ANKI_LAST_DECK_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ANKI_LAST_DECK_STORAGE_KEY, selectedDeck);
  }, [hasLoadedStoredPreferences, selectedDeck]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(
      ANKI_AUTO_EXPORT_STORAGE_KEY,
      autoExportToAnki ? "true" : "false",
    );
  }, [autoExportToAnki, hasLoadedStoredPreferences]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [hasLoadedStoredPreferences, theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedStoredPreferences) {
      return;
    }

    window.localStorage.setItem(
      TONE_COLORS_STORAGE_KEY,
      showToneColors ? "true" : "false",
    );
  }, [hasLoadedStoredPreferences, showToneColors]);

  useEffect(() => {
    if (!hasLoadedStoredPreferences || hasResolvedHostedPreferences) {
      return;
    }

    if (sessionStatus === "loading" || sessionStatus !== "authenticated") {
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
    sessionStatus,
    showToneColors,
    theme,
  ]);

  useEffect(() => {
    if (
      !hasLoadedStoredPreferences ||
      !hasResolvedHostedPreferences ||
      sessionStatus !== "authenticated"
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
    sessionStatus,
    showToneColors,
    theme,
  ]);

  const resetHostedPreferenceState = useCallback(() => {
    setHasResolvedHostedPreferences(true);
    lastSavedPreferenceSignatureRef.current = null;
  }, []);

  const invalidateHostedPreferenceState = useCallback(() => {
    setHasResolvedHostedPreferences(false);
    lastSavedPreferenceSignatureRef.current = null;
  }, []);

  return {
    autoExportToAnki,
    hasLoadedStoredPreferences,
    hasResolvedHostedPreferences,
    invalidateHostedPreferenceState,
    resetHostedPreferenceState,
    selectedDeck,
    setAutoExportToAnki,
    setSelectedDeck,
    setShowToneColors,
    setTheme,
    showToneColors,
    theme,
  };
}
