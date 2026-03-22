/**
 * Persiste a sessão do whatsapp-web.js no PostgreSQL.
 * Cada redeploy restaura a sessão do banco — nunca precisa escanear QR de novo.
 */

const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const SESSION_DIR = "/tmp/wwebjs_auth";
const TABLE = "wwebjs_session";

let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  }
  return pool;
}

async function ensureTable() {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY DEFAULT 'default',
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/** Compacta a pasta de sessão em tar.gz e salva no PostgreSQL */
async function backupSession() {
  const db = getPool();
  if (!db) return;

  try {
    if (!fs.existsSync(SESSION_DIR)) {
      console.log("[Session] Pasta de sessão não encontrada, nada a fazer");
      return;
    }

    // Cria tar.gz em memória
    const tarPath = "/tmp/wwebjs_session.tar.gz";
    execSync(`tar -czf ${tarPath} -C /tmp wwebjs_auth`, { stdio: "ignore" });

    const data = fs.readFileSync(tarPath);
    fs.unlinkSync(tarPath);

    await ensureTable();
    await db.query(`
      INSERT INTO ${TABLE} (id, data, updated_at)
      VALUES ('default', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
    `, [data]);

    console.log(`[Session] ✅ Sessão salva no PostgreSQL (${Math.round(data.length / 1024)}KB)`);
  } catch (e) {
    console.warn("[Session] ⚠️ Falha ao salvar sessão:", e.message);
  }
}

/** Restaura a sessão do PostgreSQL antes de iniciar o cliente */
async function restoreSession() {
  const db = getPool();
  if (!db) return false;

  try {
    await ensureTable();
    const result = await db.query(`SELECT data FROM ${TABLE} WHERE id = 'default'`);

    if (!result.rows.length) {
      console.log("[Session] Nenhuma sessão salva no banco — aguardando QR");
      return false;
    }

    const data = result.rows[0].data;
    const tarPath = "/tmp/wwebjs_session.tar.gz";

    // Limpa pasta antiga se existir
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }

    fs.writeFileSync(tarPath, data);
    execSync(`tar -xzf ${tarPath} -C /tmp`, { stdio: "ignore" });
    fs.unlinkSync(tarPath);

    if (fs.existsSync(SESSION_DIR)) {
      console.log(`[Session] ✅ Sessão restaurada do PostgreSQL (${Math.round(data.length / 1024)}KB)`);
      return true;
    }
    return false;
  } catch (e) {
    console.warn("[Session] ⚠️ Falha ao restaurar sessão:", e.message);
    return false;
  }
}

/** Remove a sessão do banco (usado no /qr/reset) */
async function clearSession() {
  const db = getPool();
  if (!db) return;
  try {
    await db.query(`DELETE FROM ${TABLE} WHERE id = 'default'`);
    console.log("[Session] Sessão removida do banco");
  } catch (e) {
    console.warn("[Session] Erro ao limpar sessão do banco:", e.message);
  }
}

module.exports = { backupSession, restoreSession, clearSession };
