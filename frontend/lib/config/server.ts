import "server-only";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";

export function getBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL?.trim() || DEFAULT_BACKEND_BASE_URL;
}

export function getTranscriptApiKey() {
  return process.env.TRANSCRIPT_API_KEY?.trim() || null;
}

export function hasTranscriptApiKey() {
  return Boolean(getTranscriptApiKey());
}
