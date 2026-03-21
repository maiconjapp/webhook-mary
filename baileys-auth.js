/**
 * Auth state do Baileys persistido no PostgreSQL.
 * Assim o QR code só precisa ser escaneado uma vez, mesmo após redeploys.
 */

const { Pool } = require("pg");

let _pool = null;

function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  }
  return _pool;
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS baileys_auth (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

async function usePostgresAuthState() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL não definida");

  await ensureTable(pool);

  // Importa Baileys dinamicamente (ESM)
  const { proto, initAuthCreds, BufferJSON } = await import("@whiskeysockets/baileys");

  const readData = async (key) => {
    try {
      const { rows } = await pool.query(
        "SELECT value FROM baileys_auth WHERE key = $1",
        [key]
      );
      if (!rows.length) return null;
      return JSON.parse(rows[0].value, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (key, value) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO baileys_auth (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, serialized]
    );
  };

  const removeData = async (key) => {
    await pool.query("DELETE FROM baileys_auth WHERE key = $1", [key]);
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const [category, categoryData] of Object.entries(data)) {
            for (const [id, value] of Object.entries(categoryData || {})) {
              const key = `${category}-${id}`;
              value ? await writeData(key, value) : await removeData(key);
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}

module.exports = { usePostgresAuthState };
