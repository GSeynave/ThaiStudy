import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptInvalidLangError,
  YoutubeTranscriptInvalidVideoIdError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  type TranscriptSegment,
} from "youtube-transcript-plus";

const DEFAULT_LANGUAGE = "th";

type TranscriptRouteResponse = {
  segments: TranscriptSegment[];
};

type TranscriptRouteError = {
  error: string;
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function jsonError(message: string, status: number) {
  const payload: TranscriptRouteError = { error: message };
  return Response.json(payload, { status });
}

function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, value: string) => {
    if (value.startsWith("#x") || value.startsWith("#X")) {
      const codePoint = Number.parseInt(value.slice(2), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (value.startsWith("#")) {
      const codePoint = Number.parseInt(value.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    return HTML_ENTITY_MAP[value] ?? entity;
  });
}

function normalizeTranscriptText(text: string) {
  let normalized = text;

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeHtmlEntities(normalized);
    if (decoded === normalized) {
      return decoded;
    }

    normalized = decoded;
  }

  return normalized;
}

function normalizeTranscriptSegments(segments: TranscriptSegment[]) {
  return segments.map((segment) => ({
    ...segment,
    text: normalizeTranscriptText(segment.text),
  }));
}

function getTranscriptErrorResponse(error: unknown) {
  if (error instanceof YoutubeTranscriptInvalidVideoIdError) {
    return jsonError("Enter a valid YouTube video ID or URL.", 400);
  }

  if (error instanceof YoutubeTranscriptInvalidLangError) {
    return jsonError("The requested transcript language is invalid.", 400);
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return jsonError("This YouTube video is unavailable.", 404);
  }

  if (error instanceof YoutubeTranscriptDisabledError) {
    return jsonError("Transcripts are disabled for this video.", 404);
  }

  if (error instanceof YoutubeTranscriptNotAvailableError) {
    return jsonError("No transcript is available for this video.", 404);
  }

  if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return jsonError("This video does not have a transcript in the requested language.", 404);
  }

  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return jsonError("YouTube rate-limited the transcript request. Try again later.", 429);
  }

  return jsonError("Could not fetch transcript.", 500);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId")?.trim();
  const lang = searchParams.get("lang")?.trim() || DEFAULT_LANGUAGE;

  if (!videoId) {
    return jsonError("Missing videoId query parameter.", 400);
  }

  try {
    const segments = normalizeTranscriptSegments(
      await fetchTranscript(videoId, { lang }),
    );
    const payload: TranscriptRouteResponse = { segments };
    return Response.json(payload);
  } catch (error) {
    return getTranscriptErrorResponse(error);
  }
}
