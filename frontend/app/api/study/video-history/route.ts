import { buildAuthHeaders, jsonAuthRequired } from "../../_lib/auth";
import { proxyBackendAuthedGet } from "../../_lib/backend-proxy";

export async function GET(request: Request) {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return proxyBackendAuthedGet(`/api/study/video-history${query}`, authHeaders, {
    detail:
      "Could not reach the backend study history service. Start the FastAPI backend and try again.",
  });
}
