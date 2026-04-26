import { buildAuthHeaders, jsonAuthRequired } from "../_lib/auth";
import { proxyBackendAuthedGet, proxyBackendAuthedJson } from "../_lib/backend-proxy";

const backendError = {
  detail: "Could not reach the backend account service. Start the FastAPI backend and try again.",
};

export async function GET() {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  return proxyBackendAuthedGet("/api/account", authHeaders, backendError);
}

export async function DELETE() {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  return proxyBackendAuthedJson("DELETE", "/api/account/data", authHeaders, {}, backendError);
}
