import { proxyBackendGet } from "../../_lib/backend-proxy";

export async function GET() {
  return proxyBackendGet("/api/anki/self-test", {
    available: false,
    modelReady: false,
    canListDecks: false,
    error:
      "Could not reach the backend Anki self-test service. Start the FastAPI backend and try again.",
  });
}
