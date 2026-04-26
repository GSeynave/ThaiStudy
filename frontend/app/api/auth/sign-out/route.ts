import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return Response.json(
      { error: "Supabase auth is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
  });
}
