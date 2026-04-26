import "server-only";

type ServerLogLevel = "info" | "warn" | "error";
type ServerLogDetails = Record<string, unknown>;

function compactDetails(details: ServerLogDetails) {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
}

export function logServerEvent(
  level: ServerLogLevel,
  event: string,
  details: ServerLogDetails = {},
) {
  console[level](`[app] ${event}`, {
    at: new Date().toISOString(),
    ...compactDetails(details),
  });
}
