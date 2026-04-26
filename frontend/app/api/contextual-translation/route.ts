type TranslationProxyError = {
  error: string;
};

import { proxyBackendPost, readJsonBody } from "../_lib/backend-proxy";

export async function POST(request: Request) {
  const body = await readJsonBody(request, {
    error: "The translation request body must be valid JSON.",
  } satisfies TranslationProxyError);
  if (body instanceof Response) {
    return body;
  }

  return proxyBackendPost("/api/contextual-translation", body, {
    error:
      "Could not reach the backend translation service. Start the FastAPI backend and try again.",
  } satisfies TranslationProxyError);
}
