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
import type { FetchParams } from "youtube-transcript-plus";

const DEFAULT_LANGUAGE = "th";

type TranscriptRouteResponse = {
  segments: TranscriptSegment[];
};

type TranscriptRouteError = {
  error: string;
};

const YOUTUBE_FETCH_TIMEOUT_MS = 12000;
const YOUTUBE_FETCH_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "th,en-US;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://www.youtube.com/",
  Origin: "https://www.youtube.com",
  Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+471; PREF=hl=th&tz=UTC",
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

async function youtubeFetch({ url, method = "GET", body, headers = {}, signal }: FetchParams) {
  const mergedSignal = signal ?? AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS);

  return fetch(url, {
    method,
    body,
    headers: {
      ...YOUTUBE_FETCH_HEADERS,
      ...headers,
    },
    cache: "no-store",
    signal: mergedSignal,
  });
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
      await fetchTranscript(videoId, {
        lang,
        retries: 2,
        retryDelay: 1200,
        videoFetch: youtubeFetch,
        playerFetch: youtubeFetch,
        transcriptFetch: youtubeFetch,
      }),
    );
    const payload: TranscriptRouteResponse = { segments };
    return Response.json(payload);
  } catch (error) {
    return getTranscriptErrorResponse(error);
  }
}
