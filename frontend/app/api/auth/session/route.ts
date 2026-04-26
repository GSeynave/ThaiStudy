import { getRequestSession } from "../../_lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function GET() {
  const session = await getRequestSession();

  if (!session) {
    return Response.json({
      authenticated: false,
      user: null,
      mode: hasSupabaseConfig() ? "supabase" : "none",
    });
  }

  return Response.json({
    authenticated: true,
    user: {
      id: session.userId,
    },
    mode: session.mode,
  });
}
