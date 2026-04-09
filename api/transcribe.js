const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: JSON_HEADERS,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY on the server" }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    try {
      const incoming = await request.formData();
      const file = incoming.get("file");
      const prompt = incoming.get("prompt");

      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: "Missing audio file" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
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
      if (!response.ok) {
        return new Response(text || JSON.stringify({ error: "OpenAI transcription failed" }), {
          status: response.status,
          headers: JSON_HEADERS,
        });
      }

      const data = text ? JSON.parse(text) : {};
      return new Response(JSON.stringify({ text: data.text || "" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unexpected transcription error",
        }),
        {
          status: 500,
          headers: JSON_HEADERS,
        },
      );
    }
  },
};
