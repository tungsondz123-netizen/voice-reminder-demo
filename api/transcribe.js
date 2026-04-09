const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function toJsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function mapOpenAIError(status, payload) {
  const message = payload?.error?.message || payload?.message || "";

  if (status === 401) {
    return "OPENAI_API_KEY khong hop le hoac da het hieu luc.";
  }

  if (status === 429) {
    return "Tai khoan OpenAI API cua ban chua co quota hoac chua bat billing cho transcription.";
  }

  if (status === 403) {
    return "API key hien tai khong duoc phep dung transcription model nay.";
  }

  if (message) {
    return message;
  }

  return "OpenAI transcription failed.";
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return toJsonResponse({ error: "Method not allowed" }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return toJsonResponse({ error: "Missing OPENAI_API_KEY on the server" }, 500);
    }

    try {
      const incoming = await request.formData();
      const file = incoming.get("file");
      const prompt = incoming.get("prompt");

      if (!(file instanceof File)) {
        return toJsonResponse({ error: "Missing audio file" }, 400);
      }

      const upstream = new FormData();
      upstream.append("file", file, file.name || "voice-note.m4a");
      upstream.append("model", "gpt-4o-mini-transcribe");
      upstream.append("response_format", "json");
      upstream.append("language", "vi");

      if (typeof prompt === "string" && prompt.trim()) {
        upstream.append("prompt", prompt.trim());
      }

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: upstream,
      });

      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        return toJsonResponse(
          {
            error: mapOpenAIError(response.status, parsed),
            upstream_status: response.status,
            upstream_payload: parsed,
          },
          response.status,
        );
      }

      const data = parsed || {};
      return toJsonResponse({ text: data.text || "" }, 200);
    } catch (error) {
      return toJsonResponse(
        {
          error: error instanceof Error ? error.message : "Unexpected transcription error",
        },
        500,
      );
    }
  },
};
