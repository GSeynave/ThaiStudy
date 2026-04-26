"use client";

export type AppToast = {
  id: number;
  kind: "error" | "success" | "info";
  title: string;
  message: string;
  source?: string | null;
};

type ToastViewportProps = {
  toasts: AppToast[];
  onDismiss: (id: number) => void;
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.45)] backdrop-blur ${
            toast.kind === "error"
              ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]"
              : toast.kind === "success"
                ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]"
                : "border-[color:var(--accent-border)] bg-[color:var(--surface-1)] text-[color:var(--text-main)]"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.source ? (
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] opacity-80">
                  {toast.source}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6">{toast.message}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-current/15 bg-white/20 text-base transition hover:bg-white/30"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
