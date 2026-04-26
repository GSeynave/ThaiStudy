import { NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function resolveSafeNextPath(value: string | null) {
  if (!value) {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = resolveSafeNextPath(url.searchParams.get("next"));
  const signInUrl = new URL("/sign-in", url.origin);

  if (!hasSupabaseConfig()) {
    signInUrl.searchParams.set("error", "Supabase auth is not configured.");
    return NextResponse.redirect(signInUrl);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    signInUrl.searchParams.set("error", "Missing auth callback code.");
    return NextResponse.redirect(signInUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    signInUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
