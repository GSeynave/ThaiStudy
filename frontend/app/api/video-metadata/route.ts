type VideoMetadataResponse = {
  videoId: string;
  title: string | null;
};

type VideoMetadataError = {
  error: string;
};

function jsonError(message: string, status: number) {
  const payload: VideoMetadataError = { error: message };
  return Response.json(payload, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId")?.trim();

  if (!videoId) {
    return jsonError("Missing videoId query parameter.", 400);
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return Response.json(
        { videoId, title: null satisfies string | null },
        { status: 200 },
      );
    }

    const payload = (await response.json()) as { title?: string };
    const result: VideoMetadataResponse = {
      videoId,
      title: payload.title?.trim() || null,
    };
    return Response.json(result);
  } catch {
    return Response.json({ videoId, title: null satisfies string | null }, { status: 200 });
  }
}
