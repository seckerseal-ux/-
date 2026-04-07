const GOOGLE_TTS_BASE_URL = "https://translate.googleapis.com/translate_tts";
const MAX_TTS_CHARACTERS = 220;

function jsonResponse(payload: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeText(value: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolveLocale(accent: string | null) {
  return accent === "us" ? "en-US" : "en-GB";
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const text = normalizeText(url.searchParams.get("text"));

  if (!text) {
    return jsonResponse({ error: "Missing text parameter." }, 400);
  }

  if (text.length > MAX_TTS_CHARACTERS) {
    return jsonResponse({ error: "Text is too long for a single TTS request." }, 413);
  }

  const query = new URLSearchParams({
    ie: "UTF-8",
    client: "gtx",
    tl: resolveLocale(url.searchParams.get("accent")),
    q: text,
  });

  try {
    const upstream = await fetch(`${GOOGLE_TTS_BASE_URL}?${query.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 Netlify Pronunciation Proxy",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return jsonResponse({ error: "Upstream TTS service unavailable." }, 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      },
    });
  } catch (error) {
    return jsonResponse({ error: "Unable to reach upstream TTS service." }, 502);
  }
};

export const config = {
  path: "/api/pronunciation",
};
