import { buildAuthHeaders, jsonAuthRequired } from "../../_lib/auth";
import { proxyBackendPost, readJsonBody } from "../../_lib/backend-proxy";

export async function POST(request: Request) {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  const body = await readJsonBody(request, {
    error: "The video-open request body must be valid JSON.",
  });
  if (body instanceof Response) {
    return body;
  }

  return proxyBackendPost("/api/study/video-open", body, {
    error:
      "Could not reach the backend study history service. Start the FastAPI backend and try again.",
  }, authHeaders);
}
