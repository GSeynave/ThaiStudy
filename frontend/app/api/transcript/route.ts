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
  code?: string;
};

type TranscriptDiagnostic =
  | {
      kind: "upstream";
      code: string;
      message: string;
      status: number;
    }
  | {
      kind: "disabled";
    }
  | {
      kind: "language";
      available: string[];
    }
  | {
      kind: "not-found";
    };

const YOUTUBE_FETCH_TIMEOUT_MS = 12000;
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
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

function jsonError(message: string, status: number, code?: string) {
  const payload: TranscriptRouteError = { error: message, code };
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

async function diagnoseTranscriptFailure(
  videoId: string,
  lang: string,
): Promise<TranscriptDiagnostic> {
  const watchResponse = await youtubeFetch({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    lang,
  });

  if (!watchResponse.ok) {
    if (watchResponse.status === 429) {
      return {
        kind: "upstream",
        code: "youtube_watch_rate_limited",
        message: "YouTube rate-limited the hosted watch-page request.",
        status: 429,
      };
    }

    return {
      kind: "upstream",
      code: "youtube_watch_http_error",
      message: `YouTube watch page returned HTTP ${watchResponse.status}.`,
      status: 502,
    };
  }

  const watchBody = await watchResponse.text();
  if (watchBody.includes('class="g-recaptcha"')) {
    return {
      kind: "upstream",
      code: "youtube_watch_recaptcha",
      message: "YouTube challenged the hosted watch-page request.",
      status: 429,
    };
  }

  const apiKeyMatch =
    watchBody.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ??
    watchBody.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);
  if (!apiKeyMatch) {
    return {
      kind: "upstream",
      code: "youtube_watch_missing_api_key",
      message: "YouTube watch page did not expose an Innertube API key.",
      status: 502,
    };
  }

  const playerResponse = await youtubeFetch({
    url: `https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`,
    method: "POST",
    lang,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
        },
      },
      videoId,
    }),
  });

  if (!playerResponse.ok) {
    if (playerResponse.status === 429) {
      return {
        kind: "upstream",
        code: "youtube_player_rate_limited",
        message: "YouTube rate-limited the hosted player request.",
        status: 429,
      };
    }

    return {
      kind: "upstream",
      code: "youtube_player_http_error",
      message: `YouTube player endpoint returned HTTP ${playerResponse.status}.`,
      status: 502,
    };
  }

  const playerJson = (await playerResponse.json()) as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: Array<{ languageCode?: string; baseUrl?: string; url?: string }>;
      };
    };
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{ languageCode?: string; baseUrl?: string; url?: string }>;
    };
    playabilityStatus?: { status?: string };
  };

  const tracklist =
    playerJson.captions?.playerCaptionsTracklistRenderer ??
    playerJson.playerCaptionsTracklistRenderer;
  const tracks = tracklist?.captionTracks;
  const isPlayable = playerJson.playabilityStatus?.status === "OK";

  if (!playerJson.captions || !tracklist) {
    if (isPlayable) {
      return { kind: "disabled" };
    }

    return {
      kind: "upstream",
      code: "youtube_player_missing_captions",
      message: "YouTube player response did not expose caption tracks.",
      status: 502,
    };
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { kind: "disabled" };
  }

  const selectedTrack = tracks.find((track) => track.languageCode === lang);
  if (!selectedTrack) {
    return {
      kind: "language",
      available: tracks
        .map((track) => track.languageCode)
        .filter((value): value is string => Boolean(value)),
    };
  }

  const transcriptBaseUrl = selectedTrack.baseUrl ?? selectedTrack.url;
  if (!transcriptBaseUrl) {
    return {
      kind: "upstream",
      code: "youtube_transcript_url_missing",
      message: "YouTube did not expose a transcript URL for the selected caption track.",
      status: 502,
    };
  }

  const transcriptUrl = transcriptBaseUrl.replace(/&fmt=[^&]+/, "");
  const transcriptResponse = await youtubeFetch({
    url: transcriptUrl,
    lang,
  });

  if (!transcriptResponse.ok) {
    if (transcriptResponse.status === 429) {
      return {
        kind: "upstream",
        code: "youtube_transcript_rate_limited",
        message: "YouTube rate-limited the hosted transcript XML request.",
        status: 429,
      };
    }

    return {
      kind: "upstream",
      code: "youtube_transcript_http_error",
      message: `YouTube transcript XML returned HTTP ${transcriptResponse.status}.`,
      status: 502,
    };
  }

  const transcriptBody = await transcriptResponse.text();
  if ([...transcriptBody.matchAll(RE_XML_TRANSCRIPT)].length === 0) {
    return {
      kind: "upstream",
      code: "youtube_transcript_empty_xml",
      message: "YouTube transcript XML was returned without readable segments.",
      status: 502,
    };
  }

  return { kind: "not-found" };
}

async function getTranscriptErrorResponse(
  error: unknown,
  videoId: string,
  lang: string,
) {
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
    try {
      const diagnostic = await diagnoseTranscriptFailure(videoId, lang);
      if (diagnostic.kind === "disabled") {
        return jsonError("Transcripts are disabled for this video.", 404);
      }

      if (diagnostic.kind === "language") {
        return jsonError(
          diagnostic.available.length > 0
            ? `This video does not have a transcript in the requested language. Available languages: ${diagnostic.available.join(", ")}.`
            : "This video does not have a transcript in the requested language.",
          404,
          "youtube_transcript_language_unavailable",
        );
      }

      if (diagnostic.kind === "upstream") {
        return jsonError(
          `YouTube transcript fetch failed upstream: ${diagnostic.message}`,
          diagnostic.status,
          diagnostic.code,
        );
      }
    } catch {
      return jsonError("Could not verify transcript availability.", 502, "youtube_diagnostic_failed");
    }

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
    return getTranscriptErrorResponse(error, videoId, lang);
  }
}
