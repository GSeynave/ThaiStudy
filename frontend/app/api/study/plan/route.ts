import { buildAuthHeaders, jsonAuthRequired } from "../../_lib/auth";
import { proxyBackendAuthedGet } from "../../_lib/backend-proxy";

export async function GET() {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  return proxyBackendAuthedGet("/api/study/plan", authHeaders, {
    detail:
      "Could not reach the backend plan service. Start the FastAPI backend and try again.",
  });
}
