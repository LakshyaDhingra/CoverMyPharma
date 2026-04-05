import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 3001);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";
const DEFAULT_OUTPUT_FORMAT =
  process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";

function applyCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, payload) {
  applyCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk;
  }

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    applyCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY && DEFAULT_VOICE_ID),
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/tts") {
    if (!ELEVENLABS_API_KEY) {
      sendJson(response, 500, {
        error: "ELEVENLABS_API_KEY is missing from the server environment.",
      });
      return;
    }

    if (!DEFAULT_VOICE_ID) {
      sendJson(response, 500, {
        error: "ELEVENLABS_VOICE_ID is missing from the server environment.",
      });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const text =
        typeof body.text === "string" ? body.text.trim().slice(0, 2500) : "";
      const voiceId =
        typeof body.voiceId === "string" && body.voiceId.trim()
          ? body.voiceId.trim()
          : DEFAULT_VOICE_ID;

      if (!text) {
        sendJson(response, 400, { error: "No text was provided for synthesis." });
        return;
      }

      const upstreamResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${encodeURIComponent(DEFAULT_OUTPUT_FORMAT)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: DEFAULT_MODEL_ID,
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.8,
            },
          }),
        },
      );

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const errorText = await upstreamResponse.text();
        sendJson(response, upstreamResponse.status || 502, {
          error: "ElevenLabs rejected the speech request.",
          details: errorText.slice(0, 500),
        });
        return;
      }

      applyCorsHeaders(response);
      response.writeHead(200, {
        "Content-Type":
          upstreamResponse.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
      });

      for await (const chunk of upstreamResponse.body) {
        response.write(chunk);
      }

      response.end();
      return;
    } catch (error) {
      sendJson(response, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      });
      return;
    }
  }

  sendJson(response, 404, { error: "Route not found." });
});

server.listen(PORT, () => {
  console.log(`ElevenLabs proxy listening on http://localhost:${PORT}`);
});
