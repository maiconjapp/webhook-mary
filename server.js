const http = require("http");
const { handler } = require("./netlify/functions/webhook");
const { getAllMemory } = require("./memory");
const { startWhatsApp, getQR, getStatus } = require("./whatsapp");

const PORT = process.env.PORT || 3000;

// ── Servidor HTTP ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {

  // Status do servidor
  if (req.method === "GET" && req.url === "/") {
    const whatsappStatus = getStatus() ? "✅ conectado" : (getQR() ? "📱 aguardando QR scan" : "❌ desconectado");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Mary webhook online 🤖\nWhatsApp: ${whatsappStatus}`);
    return;
  }

  // QR code — escanear com o WhatsApp para vincular
  if (req.method === "GET" && req.url === "/qr") {
    const qr = getQR();
    if (getStatus()) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ WhatsApp já está conectado!</h2>
        <p>Mary está online e recebendo mensagens.</p>
      </body></html>`);
    } else if (qr) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><head>
        <meta http-equiv="refresh" content="30">
        <title>Mary — Vincular WhatsApp</title>
      </head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f9f9f9">
        <h2>📱 Vincule o WhatsApp da Mary</h2>
        <p>Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo → escaneie:</p>
        <img src="${qr}" style="border:4px solid #25D366;border-radius:12px;padding:8px;background:white" />
        <p style="color:#888;font-size:13px">Página atualiza automaticamente a cada 30s</p>
      </body></html>`);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><head>
        <meta http-equiv="refresh" content="5">
        <title>Mary — Aguardando...</title>
      </head><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>⏳ Gerando QR code...</h2>
        <p>Aguarde alguns segundos e recarregue a página.</p>
      </body></html>`);
    }
    return;
  }

  // Reinicia sessão WhatsApp (desvincula e gera novo QR)
  if (req.method === "POST" && req.url === "/qr/reset") {
    try {
      const { Pool } = require("pg");
      if (process.env.DATABASE_URL) {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
        await pool.query("DELETE FROM baileys_auth");
        await pool.end();
      }
      setTimeout(() => startWhatsApp(), 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, msg: "Sessão reiniciada — acesse /qr em 10s" }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Memória dos clientes
  if (req.method === "GET" && req.url === "/memoria") {
    try {
      const result = await getAllMemory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Webhook HTTP (usado pelo Android como backup)
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  let rawBody = "";
  req.on("data", (chunk) => (rawBody += chunk));
  req.on("end", async () => {
    try {
      const event = {
        httpMethod: req.method,
        headers: req.headers,
        body: rawBody,
      };
      const result = await handler(event);
      res.writeHead(result.statusCode, result.headers || { "Content-Type": "application/json" });
      res.end(result.body);
    } catch (err) {
      console.error("Webhook error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
});

// ── Sobe servidor + inicia WhatsApp ──────────────────────────────────────────

server.listen(PORT, async () => {
  console.log(`\n🤖 Mary webhook rodando na porta ${PORT}`);
  console.log(`📱 Para vincular WhatsApp: /qr`);
  console.log(`🧠 Para ver memória: /memoria\n`);

  // Inicia Baileys em background
  startWhatsApp().catch((e) => {
    console.error("[WhatsApp] Falha na inicialização:", e.message);
  });
});
