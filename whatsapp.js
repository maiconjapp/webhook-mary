/**
 * Baileys WhatsApp Bot — Mary
 *
 * Conecta ao WhatsApp como dispositivo vinculado.
 * Recebe mensagens, analisa imagens, transcreve áudio e responde via Mary.
 * Comportamento humanizado: delay antes de responder, indicador de digitação.
 */

const { usePostgresAuthState } = require("./baileys-auth");
const { transcribeAudio } = require("./audio");
const { handler } = require("./netlify/functions/webhook");
const qrcode = require("qrcode");

// Estado global
let sock = null;
let qrCodeDataURL = null;
let isConnected = false;
let reconnectTimer = null;

// ── Controles de comportamento ────────────────────────────────────────────────

// Números bloqueados (não responde nunca) — carregado da env BLOCKED_NUMBERS
// Formato: "5524999999999,5521888888888" (só os dígitos, sem @s.whatsapp.net)
function getBlockedNumbers() {
  const raw = process.env.BLOCKED_NUMBERS || "";
  return new Set(raw.split(",").map(n => n.trim()).filter(Boolean));
}

// Conversas onde um humano respondeu recentemente — Mary fica em silêncio
// Map<contact, timestamp_ultimo_reply_humano>
const humanHandledUntil = new Map();
const HUMAN_SILENCE_MS = 60 * 60 * 1000; // 1 hora de silêncio após humano responder

function markHumanHandled(contact) {
  humanHandledUntil.set(contact, Date.now());
  console.log(`[WhatsApp] 🙋 Humano assumiu conversa de "${contact}" — Mary em silêncio por 1h`);
}

function isHumanHandling(contact) {
  if (!humanHandledUntil.has(contact)) return false;
  const since = humanHandledUntil.get(contact);
  if (Date.now() - since > HUMAN_SILENCE_MS) {
    humanHandledUntil.delete(contact);
    return false;
  }
  return true;
}

function getStatus() { return isConnected; }
function getQR() { return qrCodeDataURL; }
function getHumanHandled() { return humanHandledUntil; }

// ── Inicialização ─────────────────────────────────────────────────────────────

async function startWhatsApp() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  try {
    const {
      default: makeWASocket,
      DisconnectReason,
      fetchLatestBaileysVersion,
      downloadContentFromMessage,
      makeCacheableSignalKeyStore,
    } = await import("@whiskeysockets/baileys");

    const { version } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Baileys versão ${version.join(".")}`);

    const { state, saveCreds } = await usePostgresAuthState();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, { level: "silent", ...console }),
      },
      // Aparece como dispositivo linkado, não como bot
      browser: ["Mary Assistente", "Chrome", "120.0.0"],
      // Não aparece como online o tempo todo
      markOnlineOnConnect: false,
      // Não baixa histórico completo — economia de memória
      syncFullHistory: false,
      // Ignora updates de broadcast/status
      shouldIgnoreJid: (jid) =>
        jid === "status@broadcast" || jid.endsWith("@newsletter"),
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        qrCodeDataURL = await qrcode.toDataURL(qr);
        console.log("[WhatsApp] 📱 QR code gerado — acesse /qr para escanear");
      }

      if (connection === "close") {
        isConnected = false;
        qrCodeDataURL = null;
        const code = lastDisconnect?.error?.output?.statusCode;
        const { loggedOut, restartRequired } = DisconnectReason;

        if (code === loggedOut) {
          console.log("[WhatsApp] ❌ Deslogado — limpa sessão e reconecta");
          await clearAuthState();
          reconnectTimer = setTimeout(startWhatsApp, 3000);
        } else if (code === restartRequired) {
          console.log("[WhatsApp] 🔄 Restart necessário");
          reconnectTimer = setTimeout(startWhatsApp, 2000);
        } else {
          console.log(`[WhatsApp] 🔌 Desconectado (código ${code}) — reconectando em 10s`);
          reconnectTimer = setTimeout(startWhatsApp, 10000);
        }
      } else if (connection === "open") {
        isConnected = true;
        qrCodeDataURL = null;
        console.log("[WhatsApp] ✅ Conectado e pronto!");
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        // Detecta quando o PRÓPRIO DONO do WhatsApp respondeu manualmente
        // (msg.key.fromMe = true E não veio via Baileys automático)
        if (msg.key.fromMe && msg.key.remoteJid && !msg.key.remoteJid.endsWith("@g.us")) {
          const contact = msg.key.remoteJid.replace("@s.whatsapp.net", "");
          // Se o dono enviou mensagem para um cliente, Mary fica em silêncio nessa conversa
          markHumanHandled(contact);
          continue;
        }
        handleMessage(msg, { downloadContentFromMessage }).catch((e) =>
          console.error("[WhatsApp] Erro ao processar msg:", e.message)
        );
      }
    });

  } catch (err) {
    console.error("[WhatsApp] Erro ao iniciar:", err.message);
    reconnectTimer = setTimeout(startWhatsApp, 15000);
  }
}

// ── Processamento de mensagem ──────────────────────────────────────────────────

async function handleMessage(msg, { downloadContentFromMessage }) {
  // Só mensagens recebidas (não enviadas pelo dono)
  if (msg.key.fromMe) return;

  const jid = msg.key.remoteJid;

  // ── Sempre ignora grupos e broadcasts ────────────────────────────────────────
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return;

  const contact = jid.replace("@s.whatsapp.net", "");

  // ── Verifica números bloqueados ───────────────────────────────────────────────
  if (getBlockedNumbers().has(contact)) {
    console.log(`[WhatsApp] 🚫 Número bloqueado: ${contact}`);
    return;
  }

  // ── Verifica se humano está gerenciando essa conversa ─────────────────────────
  if (isHumanHandling(contact)) {
    console.log(`[WhatsApp] 🙋 Humano gerenciando "${contact}" — Mary ignorando`);
    return;
  }

  const messageContent = msg.message;
  if (!messageContent) return;

  // ── Extrai conteúdo da mensagem ──────────────────────────────────────────────
  let text = "";
  let mediaType = "text";
  let imageBase64 = null;

  if (messageContent.conversation) {
    text = messageContent.conversation;

  } else if (messageContent.extendedTextMessage?.text) {
    text = messageContent.extendedTextMessage.text;

  } else if (messageContent.imageMessage) {
    mediaType = "image";
    text = messageContent.imageMessage.caption || "[Foto sem legenda]";

    try {
      const stream = await downloadContentFromMessage(
        messageContent.imageMessage,
        "image"
      );
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      imageBase64 = Buffer.concat(chunks).toString("base64");
      console.log(`[WhatsApp] 📷 Imagem baixada (${Math.round(imageBase64.length * 0.75 / 1024)}KB)`);
    } catch (e) {
      console.warn("[WhatsApp] Não conseguiu baixar imagem:", e.message);
    }

  } else if (messageContent.audioMessage) {
    mediaType = "audio";
    text = "[Áudio]";

    try {
      const mimeType = messageContent.audioMessage.mimetype || "audio/ogg";
      const stream = await downloadContentFromMessage(
        messageContent.audioMessage,
        "audio"
      );
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      console.log(`[WhatsApp] 🎤 Áudio baixado (${Math.round(buffer.length / 1024)}KB) — transcrevendo...`);

      const transcription = await transcribeAudio(buffer, mimeType);
      if (transcription) {
        text = `[Áudio do cliente transcrito: "${transcription}"]`;
        mediaType = "text"; // trata como texto após transcrição
        console.log(`[WhatsApp] 📝 Transcrição: "${transcription.substring(0, 80)}..."`);
      }
    } catch (e) {
      console.warn("[WhatsApp] Não conseguiu transcrever áudio:", e.message);
    }

  } else if (messageContent.videoMessage) {
    mediaType = "video";
    text = "[Vídeo]";

  } else if (messageContent.documentMessage) {
    mediaType = "document";
    text = `[Documento: ${messageContent.documentMessage.fileName || "arquivo"}]`;

  } else if (messageContent.stickerMessage) {
    // Sticker: reage com emoji de coração e continua
    text = "[Sticker/figurinha]";
    mediaType = "sticker";

  } else if (messageContent.reactionMessage) {
    return; // ignora reações

  } else {
    return; // ignora tipos não suportados
  }

  if (!text.trim()) return;

  const senderName = msg.pushName || contact;

  console.log(`[WhatsApp] 📩 ${senderName}: "${text.substring(0, 60)}"`);

  // Marca como lida
  await sock.readMessages([msg.key]).catch(() => {});

  // ── Delay humanizado: 2-5s antes de começar a "digitar" ─────────────────────
  await sleep(2000 + Math.random() * 3000);

  // Indicador de digitação
  await sock.sendPresenceUpdate("composing", jid).catch(() => {});

  // ── Chama o webhook para gerar a resposta ────────────────────────────────────
  const event = {
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contact: senderName,
      platform: "WhatsApp-Baileys",
      message: text,
      mediaType,
      imageBase64,
      history: [],
    }),
  };

  let reply = "";
  try {
    const result = await handler(event);
    const parsed = JSON.parse(result.body);
    reply = parsed.reply || "";
  } catch (e) {
    console.error("[WhatsApp] Erro no handler:", e.message);
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    return;
  }

  if (!reply.trim()) {
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    return;
  }

  // ── Delay de "digitação" baseado no tamanho da resposta ─────────────────────
  // Simula ~120 chars/segundo como uma digitação rápida humana, limite 8s
  const typingMs = Math.min(1500 + reply.length * 25, 8000);
  await sleep(typingMs);

  await sock.sendPresenceUpdate("paused", jid).catch(() => {});

  // ── Envia resposta ────────────────────────────────────────────────────────────
  await sock.sendMessage(jid, { text: reply });
  console.log(`[WhatsApp] ✅ Resposta enviada para ${senderName} (${reply.length} chars)`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearAuthState() {
  try {
    const { Pool } = require("pg");
    if (!process.env.DATABASE_URL) return;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
    await pool.query("DELETE FROM baileys_auth");
    await pool.end();
    console.log("[WhatsApp] Sessão limpa do banco");
  } catch (e) {
    console.warn("[WhatsApp] Não conseguiu limpar sessão:", e.message);
  }
}

function getSock() { return sock; }

// Permite que o dashboard mostre/gerencie conversas humanas e números bloqueados
function getHumanHandledList() {
  const result = {};
  for (const [contact, ts] of humanHandledUntil) {
    result[contact] = { since: new Date(ts).toISOString(), until: new Date(ts + HUMAN_SILENCE_MS).toISOString() };
  }
  return result;
}

module.exports = { startWhatsApp, getQR, getStatus, getSock, markHumanHandled, getHumanHandledList };
