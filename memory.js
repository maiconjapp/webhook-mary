/**
 * Memória persistente de clientes da Mary.
 * Salva em /app/client_memory.json no Railway.
 * Sobrevive entre requisições e restarts — só é zerada num novo deploy.
 */

const fs = require("fs");
const path = require("path");

// Railway usa /app como diretório raiz; localmente usa a pasta do projeto
const MEMORY_FILE = process.env.RAILWAY_ENVIRONMENT
  ? "/app/client_memory.json"
  : path.join(__dirname, "client_memory.json");

// Carrega memória na inicialização do servidor
let _memory = {};
try {
  if (fs.existsSync(MEMORY_FILE)) {
    _memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    console.log(`[Memory] Carregado: ${Object.keys(_memory).length} cliente(s)`);
  } else {
    console.log("[Memory] Arquivo novo — iniciando memória vazia");
  }
} catch (e) {
  console.warn("[Memory] Erro ao carregar memória:", e.message);
  _memory = {};
}

// Salva de forma assíncrona para não bloquear a resposta
function _save() {
  fs.writeFile(MEMORY_FILE, JSON.stringify(_memory, null, 2), (err) => {
    if (err) console.warn("[Memory] Erro ao salvar:", err.message);
  });
}

/**
 * Retorna o perfil do cliente ou null se não existe.
 * @param {string} contact - nome/identificador do contato
 */
function getMemory(contact) {
  return _memory[contact] || null;
}

/**
 * Atualiza (merge) os dados do cliente e salva.
 * @param {string} contact
 * @param {object} updates - campos a atualizar (mesclados com os existentes)
 */
function updateMemory(contact, updates) {
  const existing = _memory[contact] || {};
  _memory[contact] = {
    ...existing,
    ...updates,
    // Mescla arrays sem duplicar
    servicos_solicitados: [
      ...new Set([
        ...(existing.servicos_solicitados || []),
        ...(updates.servicos_solicitados || []),
      ]),
    ],
    updated_at: new Date().toISOString(),
  };
  _save();
}

/**
 * Retorna um resumo legível da memória para incluir no prompt.
 * @param {string} contact
 */
function getMemoryContext(contact) {
  const mem = getMemory(contact);
  if (!mem) return null;

  const lines = [];
  if (mem.nome) lines.push(`Nome confirmado: ${mem.nome}`);
  if (mem.endereco) lines.push(`Endereço: ${mem.endereco}`);
  if (mem.bairro) lines.push(`Bairro: ${mem.bairro}`);
  if (mem.tipo_imovel) lines.push(`Tipo de imóvel: ${mem.tipo_imovel}`);
  if (mem.servicos_solicitados?.length)
    lines.push(`Serviços anteriores: ${mem.servicos_solicitados.join(", ")}`);
  if (mem.preferencia_horario) lines.push(`Preferência de horário: ${mem.preferencia_horario}`);
  if (mem.observacoes) lines.push(`Observações: ${mem.observacoes}`);
  if (mem.updated_at) {
    const d = new Date(mem.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    lines.push(`Último contato: ${d}`);
  }

  return lines.length ? lines.join("\n") : null;
}

/**
 * Retorna todos os clientes (para debug/admin).
 */
function getAllMemory() {
  return _memory;
}

module.exports = { getMemory, updateMemory, getMemoryContext, getAllMemory };
