import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function resolveSafeNextPath(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return Response.json(
      { error: "Supabase auth is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { next?: string } | null;
  const nextPath = resolveSafeNextPath(body?.next);

  const callbackUrl = new URL("/auth/callback", request.url);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (!data.url) {
    return Response.json(
      { error: "Could not start Google sign-in." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    url: data.url,
  });
}
