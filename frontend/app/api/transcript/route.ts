import {
  getCachedTranscript,
  TranscriptProviderError,
  type TranscriptProviderName,
  type TranscriptSegment,
} from "@/lib/transcript/provider";

type TranscriptRouteResponse = {
  provider: TranscriptProviderName;
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
    const transcript = await getCachedTranscript(videoId);
    const payload: TranscriptRouteResponse = transcript;
    return Response.json(payload);
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      const status =
        error.code === "transcript_not_available"
          ? 404
          : error.code === "transcript_provider_rate_limited"
            ? 429
            : error.code === "transcript_provider_bad_response"
              ? 502
              : 503;
      return jsonError(error.message, status, error.code);
    }

    return jsonError("Could not fetch transcript.", 500, "transcript_unknown_error");
  }
}
