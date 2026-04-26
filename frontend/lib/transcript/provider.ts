import "server-only";

import { unstable_cache } from "next/cache";
import { getTranscriptApiKey } from "@/lib/config/server";
import { logServerEvent } from "@/lib/ops/server-log";

export type TranscriptSegment = {
  text: string;
  offset: number;
  duration: number;
  lang: string;
};

export type TranscriptProviderName = "transcriptapi";

export type TranscriptFetchResult = {
  provider: TranscriptProviderName;
  segments: TranscriptSegment[];
};

export type TranscriptProviderErrorCode =
  | "transcript_provider_not_configured"
  | "transcript_not_available"
  | "transcript_provider_auth_failed"
  | "transcript_provider_no_credits"
  | "transcript_provider_rate_limited"
  | "transcript_provider_bad_response"
  | "transcript_unknown_error";

type TranscriptApiResponse = {
  language?: string;
  transcript?: Array<{
    text?: string;
    start?: number;
    duration?: number;
  }>;
};

type TranscriptApiSegment = {
  text: string;
  start: number;
  duration: number;
};

const DEFAULT_LANGUAGE = "th";
const TRANSCRIPT_API_BASE_URL = "https://transcriptapi.com/api/v2";
const TRANSCRIPT_REQUEST_TIMEOUT_MS = 12000;
const TRANSCRIPT_PROVIDER_NAME: TranscriptProviderName = "transcriptapi";
const NEGATIVE_TRANSCRIPT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const negativeTranscriptCache = new Map<string, number>();

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

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

export class TranscriptProviderError extends Error {
  constructor(
    readonly code: TranscriptProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TranscriptProviderError";
  }
}

function createTranscriptProviderError(
  code: TranscriptProviderErrorCode,
  message: string,
) {
  return new TranscriptProviderError(code, message);
}

function readNegativeTranscriptCache(videoId: string) {
  const expiresAt = negativeTranscriptCache.get(videoId);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    negativeTranscriptCache.delete(videoId);
    return false;
  }

  return true;
}

function writeNegativeTranscriptCache(videoId: string) {
  negativeTranscriptCache.set(videoId, Date.now() + NEGATIVE_TRANSCRIPT_CACHE_TTL_MS);
}

function clearNegativeTranscriptCache(videoId: string) {
  negativeTranscriptCache.delete(videoId);
}

async function fetchTranscriptFromProvider(videoId: string): Promise<TranscriptFetchResult> {
  const apiKey = getTranscriptApiKey();
  if (!apiKey) {
    throw createTranscriptProviderError(
      "transcript_provider_not_configured",
      "Transcript provider is not configured.",
    );
  }

  const response = await fetch(
    `${TRANSCRIPT_API_BASE_URL}/youtube/transcript?video_url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TRANSCRIPT_REQUEST_TIMEOUT_MS),
    },
  );

  if (response.status === 404) {
    logServerEvent("warn", "transcript.provider_not_available", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw createTranscriptProviderError(
      "transcript_not_available",
      "No transcript is available for this video.",
    );
  }

  if (response.status === 401) {
    logServerEvent("error", "transcript.provider_auth_failed", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw createTranscriptProviderError(
      "transcript_provider_auth_failed",
      "Transcript provider rejected the API key.",
    );
  }

  if (response.status === 402) {
    logServerEvent("error", "transcript.provider_no_credits", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw createTranscriptProviderError(
      "transcript_provider_no_credits",
      "Transcript provider account has no available credits.",
    );
  }

  if (response.status === 429) {
    logServerEvent("warn", "transcript.provider_rate_limited", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw createTranscriptProviderError(
      "transcript_provider_rate_limited",
      "Transcript provider rate-limited the request. Try again later.",
    );
  }

  if (!response.ok) {
    logServerEvent("error", "transcript.provider_bad_response", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw createTranscriptProviderError(
      "transcript_provider_bad_response",
      `Transcript provider returned HTTP ${response.status}.`,
    );
  }

  const payload = (await response.json()) as TranscriptApiResponse;
  if (!Array.isArray(payload.transcript) || payload.transcript.length === 0) {
    logServerEvent("error", "transcript.provider_empty_segments", {
      provider: "transcriptapi",
      videoId,
    });
    throw createTranscriptProviderError(
      "transcript_provider_bad_response",
      "Transcript provider returned no transcript segments.",
    );
  }

  const segments = payload.transcript
    .filter(
      (segment): segment is TranscriptApiSegment =>
        typeof segment.text === "string" &&
        typeof segment.start === "number" &&
        typeof segment.duration === "number",
    )
    .map(
      (segment): TranscriptSegment => ({
        text: normalizeTranscriptText(segment.text),
        offset: segment.start,
        duration: segment.duration,
        lang: payload.language ?? DEFAULT_LANGUAGE,
      }),
    );

  logServerEvent("info", "transcript.provider_fetch_success", {
    provider: TRANSCRIPT_PROVIDER_NAME,
    videoId,
    segmentCount: segments.length,
  });

  return {
    provider: TRANSCRIPT_PROVIDER_NAME,
    segments,
  };
}

async function fetchCachedTranscriptResult(videoId: string): Promise<TranscriptFetchResult> {
  try {
    return await fetchTranscriptFromProvider(videoId);
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not fetch transcript.";
    logServerEvent("error", "transcript.provider_unknown_failure", {
      provider: TRANSCRIPT_PROVIDER_NAME,
      videoId,
      message,
    });
    throw createTranscriptProviderError("transcript_unknown_error", message);
  }
}

export const getCachedTranscript = unstable_cache(
  async (videoId: string) => fetchCachedTranscriptResult(videoId),
  ["transcriptapi-youtube-transcript"],
  {
    tags: ["transcripts"],
    revalidate: false,
  },
);

export async function getTranscript(videoId: string): Promise<TranscriptFetchResult> {
  if (readNegativeTranscriptCache(videoId)) {
    logServerEvent("info", "transcript.negative_cache_hit", {
      provider: TRANSCRIPT_PROVIDER_NAME,
      videoId,
    });
    throw createTranscriptProviderError(
      "transcript_not_available",
      "No transcript is available for this video.",
    );
  }

  try {
    const transcript = await getCachedTranscript(videoId);
    clearNegativeTranscriptCache(videoId);
    return transcript;
  } catch (error) {
    if (
      error instanceof TranscriptProviderError &&
      error.code === "transcript_not_available"
    ) {
      writeNegativeTranscriptCache(videoId);
    }

    throw error;
  }
}
