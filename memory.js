/**
 * Memória persistente de clientes da Mary.
 * Primário: PostgreSQL (Railway) — permanente, sobrevive a deploys.
 * Fallback: JSON em memória — usado se o banco não estiver disponível.
 */

const { Pool } = require("pg");

let pool = null;
let useDb = false;

// Tenta conectar ao PostgreSQL
async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log("[Memory] DATABASE_URL não definida — usando memória local");
    return false;
  }
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 5000,
    });

    // Cria tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_memory (
        contact     TEXT PRIMARY KEY,
        nome        TEXT,
        endereco    TEXT,
        bairro      TEXT,
        tipo_imovel TEXT,
        servicos    TEXT,
        pref_horario TEXT,
        observacoes TEXT,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log("[Memory] ✅ PostgreSQL conectado e tabela pronta");
    return true;
  } catch (e) {
    console.warn("[Memory] ⚠️ PostgreSQL indisponível, usando memória local:", e.message);
    pool = null;
    return false;
  }
}

// Memória local como fallback
const _local = {};

// Inicializa conexão ao subir o servidor
initDb().then(ok => { useDb = ok; });

// ── API pública ───────────────────────────────────────────────────────────────

async function getMemory(contact) {
  if (useDb && pool) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM client_memory WHERE contact = $1",
        [contact]
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        nome: row.nome,
        endereco: row.endereco,
        bairro: row.bairro,
        tipo_imovel: row.tipo_imovel,
        servicos_solicitados: row.servicos ? JSON.parse(row.servicos) : [],
        preferencia_horario: row.pref_horario,
        observacoes: row.observacoes,
        updated_at: row.updated_at,
      };
    } catch (e) {
      console.warn("[Memory] Erro ao ler DB:", e.message);
    }
  }
  return _local[contact] || null;
}

async function updateMemory(contact, updates) {
  // Mescla com dados existentes
  const existing = await getMemory(contact) || {};
  const merged = {
    ...existing,
    ...updates,
    servicos_solicitados: [
      ...new Set([
        ...(existing.servicos_solicitados || []),
        ...(updates.servicos_solicitados || []),
      ]),
    ],
  };

  if (useDb && pool) {
    try {
      await pool.query(
        `INSERT INTO client_memory (contact, nome, endereco, bairro, tipo_imovel, servicos, pref_horario, observacoes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT (contact) DO UPDATE SET
           nome         = COALESCE(EXCLUDED.nome, client_memory.nome),
           endereco     = COALESCE(EXCLUDED.endereco, client_memory.endereco),
           bairro       = COALESCE(EXCLUDED.bairro, client_memory.bairro),
           tipo_imovel  = COALESCE(EXCLUDED.tipo_imovel, client_memory.tipo_imovel),
           servicos     = EXCLUDED.servicos,
           pref_horario = COALESCE(EXCLUDED.pref_horario, client_memory.pref_horario),
           observacoes  = COALESCE(EXCLUDED.observacoes, client_memory.observacoes),
           updated_at   = NOW()`,
        [
          contact,
          merged.nome || null,
          merged.endereco || null,
          merged.bairro || null,
          merged.tipo_imovel || null,
          JSON.stringify(merged.servicos_solicitados || []),
          merged.preferencia_horario || null,
          merged.observacoes || null,
        ]
      );
      console.log(`[Memory] ✅ DB salvo para "${contact}"`);
      return;
    } catch (e) {
      console.warn("[Memory] Erro ao salvar DB:", e.message);
    }
  }

  // Fallback local
  _local[contact] = { ...merged, updated_at: new Date().toISOString() };
  console.log(`[Memory] 💾 Local salvo para "${contact}"`);
}

function getMemoryContext(contact) {
  // Retorna uma Promise — chamador deve usar await
  return getMemory(contact).then(mem => {
    if (!mem) return null;
    const lines = [];
    if (mem.nome)                     lines.push(`Nome: ${mem.nome}`);
    if (mem.endereco)                 lines.push(`Endereço: ${mem.endereco}`);
    if (mem.bairro)                   lines.push(`Bairro: ${mem.bairro}`);
    if (mem.tipo_imovel)              lines.push(`Imóvel: ${mem.tipo_imovel}`);
    if (mem.servicos_solicitados?.length)
                                      lines.push(`Serviços anteriores: ${mem.servicos_solicitados.join(", ")}`);
    if (mem.preferencia_horario)      lines.push(`Prefere: ${mem.preferencia_horario}`);
    if (mem.observacoes)              lines.push(`Obs: ${mem.observacoes}`);
    if (mem.updated_at) {
      const d = new Date(mem.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      lines.push(`Último contato: ${d}`);
    }
    return lines.length ? lines.join("\n") : null;
  });
}

async function getAllMemory() {
  if (useDb && pool) {
    try {
      const { rows } = await pool.query(
        "SELECT contact, nome, endereco, bairro, servicos, updated_at FROM client_memory ORDER BY updated_at DESC"
      );
      const result = {};
      rows.forEach(r => {
        result[r.contact] = {
          nome: r.nome,
          endereco: r.endereco,
          bairro: r.bairro,
          servicos_solicitados: r.servicos ? JSON.parse(r.servicos) : [],
          updated_at: r.updated_at,
        };
      });
      return { source: "postgresql", total: rows.length, clientes: result };
    } catch (e) {
      console.warn("[Memory] Erro ao listar DB:", e.message);
    }
  }
  return { source: "local", total: Object.keys(_local).length, clientes: _local };
}

module.exports = { getMemory, updateMemory, getMemoryContext, getAllMemory };
