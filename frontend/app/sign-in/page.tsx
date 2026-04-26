"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "idle" | "success" | "error";
    text: string | null;
  }>({
    kind: "idle",
    text: null,
  });

  const callbackError = searchParams.get("error");
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage({
        kind: "error",
        text: "Enter the email address you want to use for sign-in.",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage({ kind: "idle", text: null });

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        setMessage({
          kind: "error",
          text: payload?.error ?? "Could not start sign-in.",
        });
        return;
      }

      setMessage({
        kind: "success",
        text: payload?.message ?? "Check your email for the sign-in link.",
      });
    } catch {
      setMessage({
        kind: "error",
        text: "Could not start sign-in.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <section className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]/94 px-6 py-7 shadow-[0_24px_60px_-40px_rgba(34,27,18,0.28)] backdrop-blur sm:px-8 sm:py-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Thai Study
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-strong)] sm:text-4xl">
              Sign in to keep your study data separate.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-main)] sm:text-base">
              Use your email to receive a magic link. Once the session is active, study
              history and future hosted data will be scoped to your account.
            </p>

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

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--accent-solid)] px-4 text-sm font-medium text-[color:var(--surface-3)] transition hover:bg-[color:var(--accent-solid-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isSupabaseConfigured || isSubmitting}
                >
                  {isSubmitting ? "Sending link..." : "Send magic link"}
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

          <aside className="rounded-[1.75rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-2)]/92 px-6 py-7 shadow-[0_24px_60px_-40px_rgba(34,27,18,0.2)] backdrop-blur sm:px-8 sm:py-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Why Sign In
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[color:var(--text-main)]">
              <p>
                Study history and export state need a stable user identity before the app
                can move to hosted Postgres storage.
              </p>
              <p>
                Supabase manages the session cookie. Thai Study uses that identity to scope
                saved activity before it is forwarded to the backend.
              </p>
              <p>
                Anki still stays local on your machine. This sign-in flow only covers the
                hosted app account boundary.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
