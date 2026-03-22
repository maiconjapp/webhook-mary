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

  // Normaliza MIME: WhatsApp envia "audio/ogg; codecs=opus" — remove tudo após ";"
  const baseMime = mimeType.split(";")[0].trim().toLowerCase();

  // Extensão baseada no tipo MIME normalizado
  const ext = baseMime.includes("mp4") || baseMime.includes("m4a") ? "m4a"
    : baseMime.includes("mpeg") || baseMime.includes("mp3") ? "mp3"
    : baseMime.includes("wav") ? "wav"
    : baseMime.includes("webm") ? "webm"
    : baseMime.includes("opus") ? "opus"
    : "ogg"; // padrão: ogg (WhatsApp ptt)

  console.log(`[Audio] MIME: "${mimeType}" → ext: ".${ext}"`);

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
