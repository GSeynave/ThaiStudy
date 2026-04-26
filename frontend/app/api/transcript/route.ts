import { getCachedTranscript, type TranscriptSegment } from "@/lib/transcript/provider";

type TranscriptRouteResponse = {
  segments: TranscriptSegment[];
};

type TranscriptRouteError = {
  error: string;
  code?: string;
};

function jsonError(message: string, status: number, code?: string) {
  const payload: TranscriptRouteError = { error: message, code };
  return Response.json(payload, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId")?.trim();

  if (!videoId) {
    return jsonError("Missing videoId query parameter.", 400, "transcript_missing_video_id");
  }

  try {
    const segments = await getCachedTranscript(videoId);
    const payload: TranscriptRouteResponse = { segments };
    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch transcript.";

    if (message === "Transcript provider is not configured.") {
      return jsonError(message, 503, "transcript_provider_not_configured");
    }

    if (message === "No transcript is available for this video.") {
      return jsonError(message, 404, "transcript_not_available");
    }

    if (message === "Transcript provider rejected the API key.") {
      return jsonError(message, 503, "transcript_provider_auth_failed");
    }

    if (message === "Transcript provider account has no available credits.") {
      return jsonError(message, 503, "transcript_provider_no_credits");
    }

    if (message === "Transcript provider rate-limited the request. Try again later.") {
      return jsonError(message, 429, "transcript_provider_rate_limited");
    }

    if (
      message.startsWith("Transcript provider returned HTTP ") ||
      message === "Transcript provider returned no transcript segments."
    ) {
      return jsonError(message, 502, "transcript_provider_bad_response");
    }

    return jsonError("Could not fetch transcript.", 500, "transcript_unknown_error");
  }
}
