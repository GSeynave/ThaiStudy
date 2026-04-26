import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type AppSession = {
  userId: string;
  email: string | null;
  mode: "supabase";
};

export async function getRequestSession(): Promise<AppSession | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    mode: "supabase",
  };
}

export async function buildAuthHeaders() {
  const session = await getRequestSession();
  if (!session) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();

  const accessToken = authSession?.access_token?.trim();
  if (!accessToken) {
    return null;
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function jsonAuthRequired() {
  return Response.json(
    { error: "Authentication required for saved study data." },
    { status: 401 },
  );
}
