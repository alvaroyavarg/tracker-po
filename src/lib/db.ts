import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";

// Capa de datos sobre Postgres (Neon, Supabase o cualquier Postgres estándar).
// Configuración vía DATABASE_URL, ej:
//   postgres://usuario:clave@host:5432/tracker
// En Neon/Supabase usa la URL "pooled" para entornos serverless (Vercel).

const globalForDb = globalThis as unknown as {
  _pool?: Pool;
  _schemaReady?: Promise<void>;
};

function getPool(): Pool {
  if (!globalForDb._pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "Falta DATABASE_URL. Configúrala apuntando a tu Postgres (Neon/Supabase)."
      );
    }
    globalForDb._pool = new Pool({
      connectionString: url,
      max: 3, // serverless-friendly
      // Neon y Supabase exigen SSL; localhost no lo soporta.
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForDb._pool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS po_lines (
    id             TEXT PRIMARY KEY,
    "poNumber"     TEXT NOT NULL,
    "poLine"       TEXT,
    io             TEXT,
    vendor         TEXT,
    description    TEXT,
    "glAccount"    TEXT,
    "glDescription" TEXT,
    requisitioner  TEXT,
    owner          TEXT,
    "reportingFY"  TEXT,
    "totalPoValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineValue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency       TEXT NOT NULL DEFAULT 'CLP',
    status         TEXT NOT NULL DEFAULT 'Pendiente',
    "poDate"       TEXT,
    "deliveryDate" TEXT,
    "executionDate" TEXT,
    notes          TEXT,
    raw            TEXT,
    "lastSeenAt"   TEXT,
    "createdAt"    TEXT NOT NULL,
    "updatedAt"    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_line_po ON po_lines("poNumber");
  CREATE INDEX IF NOT EXISTS idx_line_io ON po_lines(io);
  CREATE INDEX IF NOT EXISTS idx_line_status ON po_lines(status);

  CREATE TABLE IF NOT EXISTS status_changes (
    id           TEXT PRIMARY KEY,
    "poId"       TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus"   TEXT NOT NULL,
    note         TEXT,
    "createdAt"  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sc_po ON status_changes("poId");

  CREATE TABLE IF NOT EXISTS line_events (
    id          TEXT PRIMARY KEY,
    "poId"      TEXT NOT NULL,
    type        TEXT NOT NULL,
    amount      DOUBLE PRECISION,
    "prevValue" DOUBLE PRECISION,
    "newValue"  DOUBLE PRECISION,
    note        TEXT,
    source      TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ev_po ON line_events("poId");

  CREATE TABLE IF NOT EXISTS snapshots (
    id            TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    note          TEXT,
    data          TEXT NOT NULL,
    count         INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"   TEXT NOT NULL
  );
`;

async function ensureSchema(): Promise<void> {
  if (!globalForDb._schemaReady) {
    globalForDb._schemaReady = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        globalForDb._schemaReady = undefined;
        throw e;
      });
  }
  return globalForDb._schemaReady;
}

// Query simple contra el pool (asegura el esquema primero).
export async function q(text: string, params: any[] = []): Promise<any[]> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows;
}

// Transacción con un cliente dedicado.
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
