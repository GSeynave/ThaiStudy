"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ToastViewport, type AppToast } from "@/components/toast";

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInPageSkeleton />}>
      <SignInPageContent />
    </Suspense>
  );
}

function SignInPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "idle" | "success" | "error";
    text: string | null;
  }>({
    kind: "idle",
    text: null,
  });
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const toastIdRef = useRef(0);

  const callbackError = searchParams.get("error");
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const dismissToast = useCallback((toastId: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback(
    (kind: AppToast["kind"], title: string, text: string, source?: string | null) => {
      const id = toastIdRef.current + 1;
      toastIdRef.current = id;
      setToasts((currentToasts) => [
        ...currentToasts,
        { id, kind, title, message: text, source: source ?? null },
      ]);
      window.setTimeout(() => dismissToast(id), kind === "error" ? 9000 : 6000);
    },
    [dismissToast],
  );

  useEffect(() => {
    if (!callbackError) {
      return;
    }

    pushToast("error", "Sign-in failed", callbackError, "Authentication");
  }, [callbackError, pushToast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage({
        kind: "error",
        text: "Enter the email address you want to use for sign-in.",
      });
      pushToast(
        "error",
        "Email required",
        "Enter the email address you want to use for sign-in.",
        "Authentication",
      );
      return;
    }

    if (!password) {
      setMessage({
        kind: "error",
        text: "Enter your password.",
      });
      pushToast("error", "Password required", "Enter your password.", "Authentication");
      return;
    }

    if (authMode === "sign-up" && password.length < 8) {
      setMessage({
        kind: "error",
        text: "Use at least 8 characters for your password.",
      });
      pushToast(
        "error",
        "Password too short",
        "Use at least 8 characters for your password.",
        "Authentication",
      );
      return;
    }

    if (authMode === "sign-up" && password !== confirmPassword) {
      setMessage({
        kind: "error",
        text: "Password confirmation does not match.",
      });
      pushToast(
        "error",
        "Password mismatch",
        "Password confirmation does not match.",
        "Authentication",
      );
      return;
    }

    setIsSubmitting(true);
    setMessage({ kind: "idle", text: null });

    try {
      const response = await fetch(
        authMode === "sign-in" ? "/api/auth/sign-in" : "/api/auth/sign-up",
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({ email, password }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string; requiresEmailConfirmation?: boolean }
        | null;

      if (!response.ok) {
        const text =
          payload?.error ??
          (authMode === "sign-in" ? "Could not sign in." : "Could not create account.");
        setMessage({
          kind: "error",
          text,
        });
        pushToast(
          "error",
          authMode === "sign-in" ? "Sign-in failed" : "Sign-up failed",
          text,
          "Authentication",
        );
        return;
      }

      const text =
        payload?.message ??
        (authMode === "sign-in"
          ? "Signed in successfully."
          : "Account created successfully.");
      setMessage({
        kind: "success",
        text,
      });
      pushToast(
        "success",
        authMode === "sign-in" ? "Signed in" : "Account created",
        text,
        "Authentication",
      );

      if (authMode === "sign-in" || !payload?.requiresEmailConfirmation) {
        window.location.assign("/");
        return;
      }
    } catch {
      setMessage({
        kind: "error",
        text: authMode === "sign-in" ? "Could not sign in." : "Could not create account.",
      });
      pushToast(
        "error",
        authMode === "sign-in" ? "Sign-in failed" : "Sign-up failed",
        authMode === "sign-in" ? "Could not sign in." : "Could not create account.",
        "Authentication",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true);
    setMessage({ kind: "idle", text: null });

    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ next: "/" }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!response.ok || !payload?.url) {
        const text = payload?.error ?? "Could not start Google sign-in.";
        setMessage({
          kind: "error",
          text,
        });
        pushToast("error", "Google sign-in failed", text, "Authentication");
        return;
      }

      window.location.assign(payload.url);
    } catch {
      setMessage({
        kind: "error",
        text: "Could not start Google sign-in.",
      });
      pushToast(
        "error",
        "Google sign-in failed",
        "Could not start Google sign-in.",
        "Authentication",
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <section className="w-full">
          <div className="rounded-[1.75rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]/94 px-6 py-7 shadow-[0_24px_60px_-40px_rgba(34,27,18,0.28)] backdrop-blur sm:px-8 sm:py-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Thai Study
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-strong)] sm:text-4xl">
              Sign in to keep your study data separate.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-main)] sm:text-base">
              Use Google or an email and password. Once the session is active, study
              history and hosted data stay scoped to your account.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-4 text-sm font-medium text-[color:var(--text-strong)] transition hover:bg-[color:var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isSupabaseConfigured || isGoogleSubmitting || isSubmitting}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285v3.818h5.445c-.22 1.234-.939 2.28-2.024 2.979l3.271 2.538c1.905-1.756 3.008-4.341 3.008-7.395 0-.699-.063-1.37-.18-2.02z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 4.964-.895 6.619-2.418l-3.271-2.538c-.908.608-2.07.968-3.348.968-2.572 0-4.752-1.737-5.53-4.072H3.09v2.622A9.997 9.997 0 0 0 12 22z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M6.47 13.94A5.996 5.996 0 0 1 6.16 12c0-.674.117-1.326.31-1.94V7.438H3.09A9.997 9.997 0 0 0 2 12c0 1.61.386 3.13 1.09 4.562z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12 5.988c1.468 0 2.786.505 3.822 1.496l2.864-2.864C16.959 3.01 14.695 2 12 2A9.997 9.997 0 0 0 3.09 7.438l3.38 2.622c.778-2.335 2.958-4.072 5.53-4.072z"
                    />
                  </svg>
                </span>
                {isGoogleSubmitting ? "Opening Google..." : "Connect with Google"}
              </button>
            </div>

            <div className="mt-5 flex rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-2)] p-1">
              <button
                type="button"
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  authMode === "sign-in"
                    ? "bg-[color:var(--surface-1)] text-[color:var(--text-strong)] shadow-sm"
                    : "text-[color:var(--text-soft)]"
                }`}
                onClick={() => {
                  setAuthMode("sign-in");
                  setMessage({ kind: "idle", text: null });
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  authMode === "sign-up"
                    ? "bg-[color:var(--surface-1)] text-[color:var(--text-strong)] shadow-sm"
                    : "text-[color:var(--text-soft)]"
                }`}
                onClick={() => {
                  setAuthMode("sign-up");
                  setMessage({ kind: "idle", text: null });
                }}
              >
                Create account
              </button>
            </div>

            <form className="mt-8 max-w-xl space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-strong)]">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none"
                  autoComplete="email"
                  disabled={!isSupabaseConfigured || isSubmitting}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-strong)]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    authMode === "sign-in" ? "Enter your password" : "Create a password"
                  }
                  className="w-full rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none"
                  autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                  disabled={!isSupabaseConfigured || isSubmitting || isGoogleSubmitting}
                />
              </label>

              {authMode === "sign-up" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[color:var(--text-strong)]">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    className="w-full rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none"
                    autoComplete="new-password"
                    disabled={!isSupabaseConfigured || isSubmitting || isGoogleSubmitting}
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--accent-solid)] px-4 text-sm font-medium text-[color:var(--surface-3)] transition hover:bg-[color:var(--accent-solid-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isSupabaseConfigured || isSubmitting || isGoogleSubmitting}
                >
                  {isSubmitting
                    ? authMode === "sign-in"
                      ? "Signing in..."
                      : "Creating account..."
                    : authMode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </button>
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-4 text-sm font-medium text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-elevated)]"
                >
                  Back to app
                </Link>
              </div>
            </form>

            {!isSupabaseConfigured ? (
              <div className="mt-5 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">
                Supabase auth is not configured yet. Set `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env.local`.
              </div>
            ) : null}

            {callbackError ? (
              <div className="mt-5 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">
                {callbackError}
              </div>
            ) : null}

            {message.text ? (
              <div
                className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                  message.kind === "error"
                    ? "border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]"
                    : "border border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]"
                }`}
              >
                {message.text}
              </div>
            ) : null}
          </div>
        </section>
      </div>
      </main>
    </>
  );
}

function SignInPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <section className="w-full">
          <div className="rounded-[1.75rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]/94 px-6 py-7 shadow-[0_24px_60px_-40px_rgba(34,27,18,0.28)] backdrop-blur sm:px-8 sm:py-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Thai Study
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-strong)] sm:text-4xl">
              Sign in to keep your study data separate.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-main)] sm:text-base">
              Loading sign-in…
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
