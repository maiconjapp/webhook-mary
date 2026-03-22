/**
 * WhatsApp Bot — Mary
 * Usa whatsapp-web.js (Puppeteer + Chrome headless) em vez de Baileys.
 * Sem problemas de Bad MAC — usa a criptografia real do WhatsApp Web.
 */

const qrcode = require("qrcode");
const { transcribeAudio } = require("./audio");
const { handler } = require("./netlify/functions/webhook");
const { isBlocked } = require("./memory");
const { backupSession, restoreSession, clearSession } = require("./session-store");
const path = require("path");
const fs = require("fs");

let client = null;
let qrCodeDataURL = null;
let isConnected = false;
let reconnectTimer = null;

// Dedup por ID de mensagem — evita processar a mesma mensagem duas vezes
const _processedMsgIds = new Set();

// Conversas onde humano respondeu — Mary fica em silêncio
const humanHandledUntil = new Map();
const HUMAN_SILENCE_MS = 60 * 60 * 1000; // 1 hora

// Histórico de sessão por contato (evita perda de contexto entre mensagens)
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3h sem mensagem limpa histórico
const MAX_HISTORY = 20; // últimas 20 trocas

function getSessionHistory(contact) {
  const entry = sessionHistory.get(contact);
  if (!entry) return [];
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  const filtered = entry.filter(m => m.ts > cutoff);
  if (filtered.length !== entry.length) sessionHistory.set(contact, filtered);
  return filtered.map(({ role, content }) => ({ role, content }));
}

function addToSessionHistory(contact, role, content) {
  const hist = sessionHistory.get(contact) || [];
  hist.push({ role, content, ts: Date.now() });
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
  sessionHistory.set(contact, hist);
}

function getStatus() { return isConnected; }
function getQR()     { return qrCodeDataURL; }
function getSock()   { return client; } // compatibilidade com followup.js

function markHumanHandled(contact) {
  humanHandledUntil.set(contact, Date.now());
  console.log(`[WhatsApp] 🙋 Humano assumiu conversa de "${contact}" — Mary em silêncio por 1h`);
}

function isHumanHandling(contact) {
  if (!humanHandledUntil.has(contact)) return false;
  if (Date.now() - humanHandledUntil.get(contact) > HUMAN_SILENCE_MS) {
    humanHandledUntil.delete(contact);
    return false;
  }
  return true;
}

function getHumanHandledList() {
  const result = {};
  for (const [c, ts] of humanHandledUntil) {
    result[c] = {
      since: new Date(ts).toISOString(),
      until: new Date(ts + HUMAN_SILENCE_MS).toISOString(),
    };
  }
  return result;
}

// ── Inicialização ─────────────────────────────────────────────────────────────

async function startWhatsApp() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  try {
    // Restaura sessão do PostgreSQL antes de iniciar (sobrevive redeploys)
    await restoreSession();

    const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: "/tmp/wwebjs_auth" }),
      puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
        headless: true,
        protocolTimeout: 120000,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",   // usa /tmp em vez de /dev/shm
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",               // sem processos filho (mais estável em container)
          // SEM --single-process: esse flag causa crashes durante autenticação QR
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--metrics-recording-only",
          "--mute-audio",
          "--hide-scrollbars",
        ],
      },
    });

    // QR code
    client.on("qr", async (qr) => {
      qrCodeDataURL = await qrcode.toDataURL(qr);
      console.log("[WhatsApp] 📱 QR gerado — acesse /qr para escanear");
    });

    // Autenticado — salva sessão no PostgreSQL imediatamente
    client.on("authenticated", async () => {
      console.log("[WhatsApp] 🔐 Autenticado!");
      // Aguarda o whatsapp-web.js gravar os arquivos de sessão no disco
      setTimeout(() => backupSession(), 5000);
    });

    // Conectado e pronto — faz backup periódico da sessão a cada 30min
    client.on("ready", () => {
      isConnected = true;
      qrCodeDataURL = null;
      console.log("[WhatsApp] ✅ Conectado e pronto!");
      // Backup periódico a cada 30 minutos (garante sessão atualizada)
      if (!client._sessionBackupInterval) {
        client._sessionBackupInterval = setInterval(() => backupSession(), 30 * 60 * 1000);
      }
    });

    // Desconectado
    client.on("disconnected", (reason) => {
      isConnected = false;
      console.log("[WhatsApp] ❌ Desconectado:", reason);
      client = null;
      reconnectTimer = setTimeout(startWhatsApp, 10000);
    });

    // Mensagem recebida
    client.on("message", async (msg) => {
      try {
        await handleMessage(msg, MessageMedia);
      } catch (e) {
        console.error("[WhatsApp] Erro ao processar msg:", e.message);
      }
    });

    // Detecta quando o dono (Maicon) responde manualmente
    client.on("message_create", async (msg) => {
      if (msg.fromMe && msg.to && !msg.to.endsWith("@g.us")) {
        const contact = msg.to.replace("@c.us", "");
        markHumanHandled(contact);
      }
    });

    await client.initialize();

  } catch (err) {
    console.error("[WhatsApp] Erro ao iniciar:", err.message);
    // Limpa instância morta antes de reconectar
    if (client) {
      try { await client.destroy(); } catch (_) {}
      client = null;
    }
    isConnected = false;
    reconnectTimer = setTimeout(startWhatsApp, 15000);
  }
}

// ── Processamento de mensagem ──────────────────────────────────────────────────

async function handleMessage(msg, MessageMedia) {
  // Ignora mensagens próprias
  if (msg.fromMe) return;

  // Só processa contatos individuais reais (@c.us) — ignora grupos, sistema, status
  if (!msg.from.endsWith("@c.us")) return;

  // Dedup por ID de mensagem — evita dupla resposta
  const msgId = msg.id?._serialized || `${msg.from}:${msg.timestamp}`;
  if (_processedMsgIds.has(msgId)) {
    console.log(`[WhatsApp] 🔁 Ignorando msg duplicada: ${msgId}`);
    return;
  }
  _processedMsgIds.add(msgId);
  setTimeout(() => _processedMsgIds.delete(msgId), 120000); // limpa após 2min

  // Ignora mensagens com mais de 2 minutos (replay de histórico na reconexão)
  const msgAgeMs = Date.now() - (msg.timestamp * 1000);
  if (msgAgeMs > 120000) {
    console.log(`[WhatsApp] ⏭️ Mensagem antiga ignorada (${Math.round(msgAgeMs/1000)}s): "${(msg.body||'').substring(0,30)}"`);
    return;
  }

  const contact = msg.from.replace("@c.us", "");

  // Verifica bloqueados
  if (await isBlocked(contact)) {
    console.log(`[WhatsApp] 🚫 Bloqueado: ${contact}`);
    return;
  }

  // Verifica se humano está gerenciando
  if (isHumanHandling(contact)) {
    console.log(`[WhatsApp] 🙋 Humano gerenciando "${contact}" — ignorando`);
    return;
  }

  let text = "";
  let mediaType = "text";
  let imageBase64 = null;
  let imageMimeType = "image/jpeg";

  // ── Tipo de mensagem ────────────────────────────────────────────────────────
  if (msg.hasMedia) {
    console.log(`[WhatsApp] ⬇️ Baixando mídia tipo="${msg.type}"...`);
    const media = await msg.downloadMedia().catch((e) => {
      console.warn(`[WhatsApp] ⚠️ Falha ao baixar mídia: ${e.message}`);
      return null;
    });

    if (msg.type === "image" || msg.type === "sticker") {
      mediaType = msg.type === "sticker" ? "sticker" : "image";
      text = msg.body || "[Foto]";
      if (media?.data) {
        imageBase64 = media.data; // já é base64 no wwebjs
        imageMimeType = media.mimetype || "image/jpeg";
        console.log(`[WhatsApp] 📷 Imagem baixada (${Math.round(media.data.length * 0.75 / 1024)}KB, ${imageMimeType})`);
      } else {
        console.warn(`[WhatsApp] ⚠️ Imagem sem dados — visão indisponível`);
      }

    } else if (msg.type === "ptt" || msg.type === "audio") {
      mediaType = "audio";
      text = "[Áudio]";
      if (media?.data) {
        const buffer = Buffer.from(media.data, "base64");
        const mime = media.mimetype || "audio/ogg";
        console.log(`[WhatsApp] 🎤 Áudio baixado (${Math.round(buffer.length / 1024)}KB, ${mime}) — transcrevendo...`);
        const transcription = await transcribeAudio(buffer, mime);
        if (transcription) {
          text = `[Áudio transcrito: "${transcription}"]`;
          mediaType = "text";
          console.log(`[WhatsApp] 📝 Transcrição: "${transcription.substring(0, 80)}"`);
        } else {
          console.warn(`[WhatsApp] ⚠️ Transcrição retornou vazia`);
        }
      } else {
        console.warn(`[WhatsApp] ⚠️ Áudio sem dados — transcrição indisponível`);
      }

    } else if (msg.type === "video") {
      mediaType = "video";
      text = "[Vídeo]";

    } else if (msg.type === "document") {
      mediaType = "document";
      text = `[Documento: ${msg.body || "arquivo"}]`;
    }

  } else {
    text = msg.body || "";
  }

  if (!text.trim()) return;

  const senderName = (await msg.getContact().catch(() => null))?.pushname || contact;
  console.log(`[WhatsApp] 📩 ${senderName}: "${text.substring(0, 60)}"`);

  // Marca como lida
  await msg.getChat().then(c => c.sendSeen()).catch(() => {});

  // Delay humanizado: 2–5s
  await sleep(2000 + Math.random() * 3000);

  // Indicador de digitando
  const chat = await msg.getChat().catch(() => null);
  if (chat) await chat.sendStateTyping().catch(() => {});

  // Histórico de sessão (mantém contexto da conversa atual)
  const history = getSessionHistory(contact);

  // Chama Mary
  const event = {
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: senderName,
      platform: "WhatsApp-Web",
      message: text,
      mediaType,
      imageBase64,
      imageMimeType,
      history,
    }),
  };

  let reply = "";
  try {
    const result = await handler(event);
    const parsed = JSON.parse(result.body);
    reply = parsed.reply || "";
  } catch (e) {
    console.error("[WhatsApp] Erro no handler:", e.message);
    if (chat) await chat.clearState().catch(() => {});
    return;
  }

  if (!reply.trim()) {
    if (chat) await chat.clearState().catch(() => {});
    return;
  }

  // Delay de digitação baseado no tamanho da resposta
  const typingMs = Math.min(1500 + reply.length * 25, 8000);
  await sleep(typingMs);

  if (chat) await chat.clearState().catch(() => {});

  // Envia resposta
  await client.sendMessage(msg.from, reply);
  console.log(`[WhatsApp] ✅ Resposta enviada para ${senderName} (${reply.length} chars)`);

  // Salva no histórico de sessão
  addToSessionHistory(contact, "user", text);
  addToSessionHistory(contact, "assistant", reply);
}

// ── Limpa sessão ───────────────────────────────────────────────────────────────

async function clearAuthState() {
  try {
    if (client) {
      if (client._sessionBackupInterval) clearInterval(client._sessionBackupInterval);
      await client.destroy().catch(() => {});
      client = null;
    }
    isConnected = false;

    // Limpa arquivos de sessão locais
    const dir = "/tmp/wwebjs_auth";
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

    // Limpa sessão do PostgreSQL
    await clearSession();

    console.log("[WhatsApp] Sessão limpa");
  } catch (e) {
    console.warn("[WhatsApp] Erro ao limpar sessão:", e.message);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startWhatsApp, getQR, getStatus, getSock, getHumanHandledList, clearAuthState };
