import { proxyBackendGet } from "../../_lib/backend-proxy";

export async function GET() {
  return proxyBackendGet("/api/anki/decks", {
    detail:
      "Could not reach the backend Anki service. Start the FastAPI backend and try again.",
  });
}
