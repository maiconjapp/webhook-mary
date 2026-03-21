/**
 * Transcrição de áudio usando Groq Whisper (gratuito).
 * Recebe um Buffer com o arquivo de áudio e retorna o texto transcrito.
 */

const https = require("https");
const FormData = require("form-data");

async function transcribeAudio(buffer, mimeType = "audio/ogg") {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey === "not-configured") {
    console.warn("[Audio] GROQ_API_KEY não definida, transcrição indisponível");
    return null;
  }

  // Extensão baseada no tipo MIME
  const ext = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3"
    : mimeType.includes("wav") ? "wav"
    : mimeType.includes("webm") ? "webm"
    : "ogg";

  const form = new FormData();
  form.append("file", buffer, {
    filename: `audio.${ext}`,
    contentType: mimeType,
  });
  form.append("model", "whisper-large-v3");
  form.append("language", "pt");
  form.append("response_format", "text");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/audio/transcriptions",
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${groqKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          console.warn("[Audio] Groq Whisper erro:", res.statusCode, data);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      console.warn("[Audio] Erro de rede Whisper:", err.message);
      resolve(null);
    });

    form.pipe(req);
  });
}

module.exports = { transcribeAudio };
