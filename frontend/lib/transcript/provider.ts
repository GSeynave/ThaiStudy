import "server-only";

import { unstable_cache } from "next/cache";

export type TranscriptSegment = {
  text: string;
  offset: number;
  duration: number;
  lang: string;
};

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

function getTranscriptApiKey() {
  return process.env.TRANSCRIPT_API_KEY?.trim() || null;
}

async function fetchTranscriptFromProvider(videoId: string) {
  const apiKey = getTranscriptApiKey();
  if (!apiKey) {
    throw new Error("Transcript provider is not configured.");
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
    console.warn("[transcript] provider_not_available", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw new Error("No transcript is available for this video.");
  }

  if (response.status === 401) {
    console.error("[transcript] provider_auth_failed", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw new Error("Transcript provider rejected the API key.");
  }

  if (response.status === 402) {
    console.error("[transcript] provider_no_credits", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw new Error("Transcript provider account has no available credits.");
  }

  if (response.status === 429) {
    console.warn("[transcript] provider_rate_limited", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw new Error("Transcript provider rate-limited the request. Try again later.");
  }

  if (!response.ok) {
    console.error("[transcript] provider_bad_response", {
      provider: "transcriptapi",
      videoId,
      status: response.status,
    });
    throw new Error(`Transcript provider returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as TranscriptApiResponse;
  if (!Array.isArray(payload.transcript) || payload.transcript.length === 0) {
    console.error("[transcript] provider_empty_segments", {
      provider: "transcriptapi",
      videoId,
    });
    throw new Error("Transcript provider returned no transcript segments.");
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

  console.info("[transcript] provider_fetch_success", {
    provider: "transcriptapi",
    videoId,
    segmentCount: segments.length,
  });

  return segments;
}

export const getCachedTranscript = unstable_cache(
  async (videoId: string) => fetchTranscriptFromProvider(videoId),
  ["transcriptapi-youtube-transcript"],
  {
    tags: ["transcripts"],
    revalidate: false,
  },
);
