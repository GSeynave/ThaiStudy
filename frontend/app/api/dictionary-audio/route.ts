const ALLOWED_AUDIO_HOSTS = new Set([
  "www.thai-language.com",
  "thai-language.com",
  "audio.thai-language.com",
]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isAllowedAudioUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }
    return ALLOWED_AUDIO_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceUrl = searchParams.get("url")?.trim();

  if (!sourceUrl) {
    return jsonError("Missing url query parameter.", 400);
  }

  if (!isAllowedAudioUrl(sourceUrl)) {
    return jsonError("Audio source URL is not allowed.", 400);
  }

  try {
    const upstream = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 ThaiStudy/0.1",
      },
    });

    if (!upstream.ok) {
      return jsonError("Could not fetch dictionary audio.", 502);
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const audioBuffer = await upstream.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not fetch dictionary audio.", 502);
  }
}
