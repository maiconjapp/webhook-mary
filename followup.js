/**
 * CRM Follow-up — envia mensagens de aquecimento para clientes inativos.
 *
 * Anti-ban: máximo 5 por lote, delay aleatório de 30-60s entre cada envio,
 * indicador de digitação antes de enviar, exatamente como o comportamento humano.
 */

const { markFollowUpSent } = require("./memory");

// Impede dois lotes rodando ao mesmo tempo
let batchInProgress = false;

/**
 * Personaliza a mensagem substituindo tokens.
 * Tokens disponíveis: {nome}, {servico_recente}
 */
function personalize(template, client) {
  const nome = client.nome ? client.nome.split(" ")[0] : "tudo bem";
  const servicos = client.servicos || [];
  const servico = servicos.length > 0 ? servicos[servicos.length - 1] : "reparos em casa";

  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{servico_recente\}/g, servico);
}

/**
 * Envia lote de follow-ups com comportamento humanizado.
 * @param {Array} contacts - Array de objetos {contact, nome, servicos, ...} (máx 5)
 * @param {string} template - Mensagem com tokens {nome} e {servico_recente}
 * @param {Function} getSock - Função que retorna o socket Baileys
 * @param {Function} onProgress - Callback chamado a cada passo: ({contact, status, msg})
 */
async function sendFollowUpBatch(contacts, template, getSock, onProgress) {
  if (batchInProgress) {
    throw new Error("Já existe um lote em andamento. Aguarde terminar.");
  }

  // Máximo 5 por lote — proteção server-side
  if (contacts.length > 5) {
    throw new Error("Máximo de 5 contatos por lote para evitar ban.");
  }

  // getSock() retorna o client do whatsapp-web.js
  const sock = getSock();
  if (!sock) {
    throw new Error("WhatsApp não está conectado. Vincule o dispositivo em /qr");
  }

  batchInProgress = true;
  const results = [];

  try {
    for (let i = 0; i < contacts.length; i++) {
      const client = contacts[i];

      // Valida se contact é um número de telefone real (10–15 dígitos)
      if (!/^\d{10,15}$/.test((client.contact || '').replace(/\D/g, ''))) {
        console.warn(`[FollowUp] ⚠️ Contato inválido ignorado: "${client.contact}"`);
        results.push({ contact: client.contact, status: "skipped", error: "não é telefone válido" });
        onProgress?.({ contact: client.contact, nome: client.nome, status: "failed", error: "contato inválido — não é telefone" });
        continue;
      }

      // whatsapp-web.js usa @c.us (não @s.whatsapp.net do Baileys)
      const jid = `${client.contact}@c.us`;
      const msg = personalize(template, client);

      onProgress?.({ contact: client.contact, nome: client.nome, status: "sending" });

      try {
        // Marca imediatamente para evitar duplo envio em caso de crash
        await markFollowUpSent(client.contact);

        // Indicador de digitação via whatsapp-web.js
        let chat = null;
        try {
          chat = await sock.getChatById(jid);
          await chat.sendStateTyping();
        } catch (_) {} // não crítico — continua mesmo sem typing

        // Delay de digitação: 1.5–3s
        await sleep(1500 + Math.random() * 1500);

        // Envia a mensagem — API whatsapp-web.js
        await sock.sendMessage(jid, msg);

        // Para o indicador de digitação
        try { if (chat) await chat.clearState(); } catch (_) {}

        results.push({ contact: client.contact, status: "sent" });
        onProgress?.({ contact: client.contact, nome: client.nome, status: "sent", msg });

        console.log(`[FollowUp] ✅ Enviado para ${client.nome || client.contact}`);

      } catch (e) {
        results.push({ contact: client.contact, status: "failed", error: e.message });
        onProgress?.({ contact: client.contact, nome: client.nome, status: "failed", error: e.message });
        console.warn(`[FollowUp] ❌ Falha para ${client.contact}:`, e.message);
      }

      // Delay entre mensagens: 30–60s (exceto após o último)
      if (i < contacts.length - 1) {
        const delay = 30000 + Math.random() * 30000;
        const delayS = Math.round(delay / 1000);
        onProgress?.({ contact: null, status: "waiting", msg: `Aguardando ${delayS}s antes do próximo envio...` });
        await sleep(delay);
      }
    }
  } finally {
    batchInProgress = false;
  }

  return results;
}

function isBatchInProgress() { return batchInProgress; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Template padrão
const DEFAULT_TEMPLATE = `Oi {nome}! Tudo bem? 😊

Passando pra ver se você precisa de alguma coisa aqui em casa — {servico_recente} ou qualquer outro serviço.

Qualquer coisa é só chamar! 🔧`;

module.exports = { sendFollowUpBatch, isBatchInProgress, DEFAULT_TEMPLATE };
