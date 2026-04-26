"use client";

import { useCallback, useRef, useState } from "react";

import type { AppToast } from "@/components/toast";

export function useAppToasts() {
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const toastIdRef = useRef(0);

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

  return {
    dismissToast,
    pushToast,
    toasts,
  };
}
