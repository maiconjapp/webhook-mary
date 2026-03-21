const http = require("http");
const { handler } = require("./netlify/functions/webhook");
const { getAllMemory, getAllClientsForDashboard, getDashboardStats,
        getBlockedNumbers, blockNumber, unblockNumber } = require("./memory");
const { startWhatsApp, getQR, getStatus, getSock, getHumanHandledList } = require("./whatsapp");
const { sendFollowUpBatch, isBatchInProgress } = require("./followup");
const { getDashboardHTML } = require("./dashboard");
const { chatWithAssistant } = require("./assistant");

const PORT = process.env.PORT || 3000;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;

// ── Auth simples para dashboard ───────────────────────────────────────────────
function checkAuth(req, res) {
  if (!DASHBOARD_TOKEN) return true; // sem token definido = aberto
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token") || req.headers["x-dashboard-token"];
  if (token !== DASHBOARD_TOKEN) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized — adicione ?token=SEU_TOKEN na URL");
    return false;
  }
  return true;
}

// ── Servidor HTTP ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  // ── Status público ──────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/") {
    const waStatus = getStatus() ? "✅ conectado" : getQR() ? "📱 aguardando QR" : "❌ desconectado";
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Mary webhook online 🤖\nWhatsApp: ${waStatus}`);
    return;
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/dashboard") {
    if (!checkAuth(req, res)) return;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getDashboardHTML());
    return;
  }

  // ── API: Status WhatsApp + stats ────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/status") {
    if (!checkAuth(req, res)) return;
    try {
      const stats = await getDashboardStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        connected: getStatus(),
        qr: getQR(),
        batch_in_progress: isBatchInProgress(),
        human_handled: getHumanHandledList(),
        stats: {
          total_clients: stats.total,
          active_last_30d: stats.active_30d,
          followups_sent_today: stats.sent_today,
        },
      }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Lista de clientes ──────────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/clients") {
    if (!checkAuth(req, res)) return;
    try {
      const clients = await getAllClientsForDashboard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(clients));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Números bloqueados ─────────────────────────────────────────────────

  if (req.method === "GET" && path === "/api/blocked") {
    if (!checkAuth(req, res)) return;
    try {
      const list = await getBlockedNumbers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(list));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === "POST" && path === "/api/blocked") {
    if (!checkAuth(req, res)) return;
    let raw = ""; req.on("data", c => raw += c);
    req.on("end", async () => {
      try {
        const { contact, label } = JSON.parse(raw);
        if (!contact) { res.writeHead(400); res.end(JSON.stringify({ error: "contact obrigatório" })); return; }
        // Normaliza: remove +, espaços, traços
        const clean = contact.replace(/[\s\+\-\(\)]/g, "");
        await blockNumber(clean, label || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, contact: clean }));
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (req.method === "DELETE" && path.startsWith("/api/blocked/")) {
    if (!checkAuth(req, res)) return;
    try {
      const contact = decodeURIComponent(path.replace("/api/blocked/", ""));
      await unblockNumber(contact);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── API: Chat assistente ────────────────────────────────────────────────────

  if (req.method === "POST" && path === "/api/chat") {
    if (!checkAuth(req, res)) return;
    let raw = ""; req.on("data", c => raw += c);
    req.on("end", async () => {
      try {
        const { message, sessionId } = JSON.parse(raw);
        if (!message) { res.writeHead(400); res.end(JSON.stringify({ error: "message obrigatório" })); return; }
        const sid = sessionId || `${Date.now()}-${Math.random()}`;
        const reply = await chatWithAssistant(sid, message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply, sessionId: sid }));
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // ── API: Enviar follow-up (streaming) ───────────────────────────────────────
  if (req.method === "POST" && path === "/api/followup") {
    if (!checkAuth(req, res)) return;

    let rawBody = "";
    req.on("data", (c) => (rawBody += c));
    req.on("end", async () => {
      try {
        const { contacts, template } = JSON.parse(rawBody);

        if (!Array.isArray(contacts) || contacts.length === 0) {
          res.writeHead(400); res.end(JSON.stringify({ error: "Nenhum contato selecionado" })); return;
        }
        if (contacts.length > 5) {
          res.writeHead(400); res.end(JSON.stringify({ error: "Máximo 5 contatos por lote" })); return;
        }
        if (!getStatus()) {
          res.writeHead(503); res.end(JSON.stringify({ error: "WhatsApp não conectado. Escaneie o QR em /qr" })); return;
        }
        if (isBatchInProgress()) {
          res.writeHead(409); res.end(JSON.stringify({ error: "Já existe um lote em andamento" })); return;
        }

        // Resposta em streaming — cada linha é um JSON
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        });

        let sent = 0, failed = 0;

        const results = await sendFollowUpBatch(
          contacts,
          template,
          getSock,
          (progress) => {
            res.write(JSON.stringify(progress) + "\n");
            if (progress.status === "sent") sent++;
            if (progress.status === "failed") failed++;
          }
        );

        res.write(JSON.stringify({ done: true, sent, failed }) + "\n");
        res.end();
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        } else {
          res.write(JSON.stringify({ done: true, error: e.message, sent: 0, failed: 0 }) + "\n");
          res.end();
        }
      }
    });
    return;
  }

  // ── QR code page ────────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/qr") {
    const qr = getQR();
    if (getStatus()) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#111b21;color:#e9edef">
        <h2>✅ WhatsApp já conectado!</h2><p>Mary está online.</p>
        <a href="/dashboard" style="color:#25d366">→ Abrir Dashboard</a>
      </body></html>`);
    } else if (qr) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="30"><title>Mary — QR</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#111b21;color:#e9edef">
        <h2>📱 Vincule o WhatsApp</h2>
        <p style="color:#8696a0">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
        <img src="${qr}" style="border:4px solid #25d366;border-radius:10px;padding:8px;background:white;max-width:260px"/>
        <p style="color:#8696a0;font-size:13px">Atualiza a cada 30s</p>
      </body></html>`);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="5"></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#111b21;color:#e9edef">
        <h2>⏳ Gerando QR...</h2><p>Aguarde e recarregue.</p>
      </body></html>`);
    }
    return;
  }

  // ── Reset sessão WhatsApp ───────────────────────────────────────────────────
  if (req.method === "POST" && path === "/qr/reset") {
    if (!checkAuth(req, res)) return;
    try {
      const { clearAuthState } = require("./baileys-auth");
      await clearAuthState();
      setTimeout(() => startWhatsApp(), 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, msg: "Sessão reiniciada — acesse /qr em 10s" }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Memória (legado) ────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/memoria") {
    try {
      const result = await getAllMemory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Webhook HTTP (Android app como backup) ──────────────────────────────────
  if (req.method === "POST" && path === "/webhook") {
    let rawBody = "";
    req.on("data", (c) => (rawBody += c));
    req.on("end", async () => {
      try {
        const result = await handler({
          httpMethod: req.method,
          headers: req.headers,
          body: rawBody,
        });
        res.writeHead(result.statusCode, result.headers || { "Content-Type": "application/json" });
        res.end(result.body);
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
    return;
  }

  res.writeHead(404); res.end("Not Found");
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`\n🤖 Mary webhook na porta ${PORT}`);
  console.log(`📊 Dashboard: /dashboard`);
  console.log(`📱 QR code:   /qr`);
  console.log(`🧠 Memória:   /memoria\n`);
  startWhatsApp().catch((e) => console.error("[WhatsApp] Falha:", e.message));
});
