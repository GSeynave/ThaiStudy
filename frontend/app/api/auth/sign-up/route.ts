import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { logServerEvent } from "@/lib/ops/server-log";

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePassword(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    logServerEvent("error", "auth.password_sign_up_not_configured");
    return Response.json(
      { error: "Supabase auth is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);

  if (!email) {
    logServerEvent("warn", "auth.password_sign_up_missing_email");
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  if (!password) {
    logServerEvent("warn", "auth.password_sign_up_missing_password");
    return Response.json({ error: "Password is required." }, { status: 400 });
  }

  const callbackUrl = new URL("/auth/callback", request.url);
  callbackUrl.searchParams.set("next", "/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    logServerEvent("warn", "auth.password_sign_up_failed", {
      message: error.message,
    });
    return Response.json({ error: error.message }, { status: 400 });
  }

  logServerEvent("info", "auth.password_sign_up_succeeded", {
    requiresEmailConfirmation: !data.session,
  });

  return Response.json({
    ok: true,
    requiresEmailConfirmation: !data.session,
    message: data.session
      ? "Account created and signed in."
      : "Check your email to confirm your account, then sign in.",
  });
}
