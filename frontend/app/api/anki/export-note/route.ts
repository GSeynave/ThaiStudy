import { buildAuthHeaders, jsonAuthRequired } from "../../_lib/auth";
import { proxyBackendPost, readJsonBody } from "../../_lib/backend-proxy";
import { getBackendBaseUrl } from "@/lib/config/server";
import { logServerEvent } from "@/lib/ops/server-log";

export async function POST(request: Request) {
  const authHeaders = await buildAuthHeaders();
  if (!authHeaders) {
    return jsonAuthRequired();
  }

  const body = await readJsonBody(request, {
    detail: "The Anki export request body must be valid JSON.",
  });
  if (body instanceof Response) {
    return body;
  }

  try {
    const quotaResponse = await fetch(`${getBackendBaseUrl()}/api/study/quota`, {
      cache: "no-store",
      headers: authHeaders,
    });
    const quotaPayload = (await quotaResponse.json()) as
      | {
          hasReachedMonthlyFlashcardLimit?: boolean;
          monthlyFlashcardExportsRemaining?: number;
        }
      | { detail?: string };

    if (
      quotaResponse.ok &&
      "hasReachedMonthlyFlashcardLimit" in quotaPayload &&
      quotaPayload.hasReachedMonthlyFlashcardLimit
    ) {
      return Response.json(
        {
          detail: `You have reached the free monthly flashcard export limit. Upgrade or wait for the monthly reset.`,
        },
        { status: 402 },
      );
    }
  } catch {
    logServerEvent("error", "anki_export.quota_check_failed", {
      path: "/api/study/quota",
      backendBaseUrl: getBackendBaseUrl(),
    });
    return Response.json(
      {
        detail:
          "Could not verify the flashcard export quota. Start the FastAPI backend and try again.",
      },
      { status: 502 },
    );
  }

  return proxyBackendPost("/api/anki/export-note", body, {
    detail:
      "Could not reach the backend Anki export service. Start the FastAPI backend and try again.",
  }, authHeaders);
}
