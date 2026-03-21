/**
 * Auth state do Baileys com filesystem + backup PostgreSQL.
 *
 * Usa o useMultiFileAuthState NATIVO do Baileys (sem serialização customizada),
 * evitando erros "Bad MAC" causados por corrupção de chaves Signal.
 *
 * Fluxo:
 *  1. Startup: restaura arquivos de auth do PostgreSQL para /tmp/baileys_auth/
 *  2. Usa useMultiFileAuthState('/tmp/baileys_auth') — serialização 100% Baileys
 *  3. Cada saveCreds: faz backup dos arquivos para PostgreSQL
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const AUTH_DIR = "/tmp/baileys_auth";

let _pool = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  }
  return _pool;
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS baileys_files (
      filename TEXT PRIMARY KEY,
      content  TEXT NOT NULL,
      saved_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/** Restaura arquivos do PostgreSQL para o disco */
async function restoreFromDb() {
  const pool = getPool();
  if (!pool) return false;
  try {
    await ensureTable(pool);
    const { rows } = await pool.query("SELECT filename, content FROM baileys_files");
    if (!rows.length) return false;

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    rows.forEach(({ filename, content }) => {
      fs.writeFileSync(path.join(AUTH_DIR, filename), Buffer.from(content, "base64"));
    });
    console.log(`[Auth] ✅ Restaurados ${rows.length} arquivos de auth do PostgreSQL`);
    return true;
  } catch (e) {
    console.warn("[Auth] Não conseguiu restaurar auth do DB:", e.message);
    return false;
  }
}

/** Faz backup de todos os arquivos de auth para o PostgreSQL */
async function backupToDb() {
  const pool = getPool();
  if (!pool) return;
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    for (const filename of files) {
      const content = fs.readFileSync(path.join(AUTH_DIR, filename)).toString("base64");
      await pool.query(
        `INSERT INTO baileys_files (filename, content, saved_at) VALUES ($1, $2, NOW())
         ON CONFLICT (filename) DO UPDATE SET content = EXCLUDED.content, saved_at = NOW()`,
        [filename, content]
      );
    }
  } catch (e) {
    console.warn("[Auth] Não conseguiu fazer backup para DB:", e.message);
  }
}

/** Limpa sessão (logout) */
async function clearAuthState() {
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM baileys_files");
    } catch {}
  }
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch {}
  console.log("[Auth] Sessão limpa");
}

/** Inicializa auth state usando Baileys nativo + backup PostgreSQL */
async function usePostgresAuthState() {
  // Restaura arquivos do DB para o disco
  await restoreFromDb();

  // Cria diretório se não existir
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Usa o useMultiFileAuthState NATIVO do Baileys — serialização correta garantida
  const { useMultiFileAuthState } = await import("@whiskeysockets/baileys");
  const { state, saveCreds: _saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Intercepta saveCreds para fazer backup no PostgreSQL também
  const saveCreds = async () => {
    await _saveCreds();
    await backupToDb();
  };

  return { state, saveCreds };
}

module.exports = { usePostgresAuthState, clearAuthState };
