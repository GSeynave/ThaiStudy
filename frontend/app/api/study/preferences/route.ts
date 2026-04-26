import { buildAuthHeaders, jsonAuthRequired } from "../../_lib/auth";
import {
  proxyBackendAuthedGet,
  proxyBackendAuthedJson,
  readJsonBody,
} from "../../_lib/backend-proxy";

const backendError = {
  detail:
    "Could not reach the backend preferences service. Start the FastAPI backend and try again.",
};

export async function GET() {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  return proxyBackendAuthedGet("/api/study/preferences", authHeaders, backendError);
}

export async function PUT(request: Request) {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  const body = await readJsonBody(
    request,
    { error: "A valid preferences payload is required." },
    400,
  );
  if (body instanceof Response) {
    return body;
  }

  return proxyBackendAuthedJson(
    "PUT",
    "/api/study/preferences",
    authHeaders,
    body,
    backendError,
  );
}
