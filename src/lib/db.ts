import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Base de datos SQLite integrada en Node (sin dependencias externas ni binarios).
// Requiere ejecutar Node con --experimental-sqlite (ver scripts en package.json).

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "tracker.db");
const SCHEMA_VERSION = 2;

const globalForDb = globalThis as unknown as { _db?: DatabaseSync };

function init(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");

  // Si el esquema cambió de versión, se recrea (los datos se recargan desde la sábana).
  const row = db.prepare("PRAGMA user_version").get() as any;
  const version = Number(row?.user_version ?? 0);
  if (version !== SCHEMA_VERSION) {
    db.exec(`
      DROP TABLE IF EXISTS purchase_orders;
      DROP TABLE IF EXISTS po_lines;
      DROP TABLE IF EXISTS status_changes;
      DROP TABLE IF EXISTS snapshots;
    `);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS po_lines (
      id             TEXT PRIMARY KEY,
      poNumber       TEXT NOT NULL,
      poLine         TEXT,
      io             TEXT,
      vendor         TEXT,
      description    TEXT,
      glAccount      TEXT,
      glDescription  TEXT,
      requisitioner  TEXT,
      owner          TEXT,
      reportingFY    TEXT,
      totalPoValue   REAL NOT NULL DEFAULT 0,
      lineValue      REAL NOT NULL DEFAULT 0,
      invoicedAmount REAL NOT NULL DEFAULT 0,
      openAmount     REAL NOT NULL DEFAULT 0,
      currency       TEXT NOT NULL DEFAULT 'CLP',
      status         TEXT NOT NULL DEFAULT 'Pendiente',
      poDate         TEXT,
      deliveryDate   TEXT,
      executionDate  TEXT,
      notes          TEXT,
      raw            TEXT,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_line_po ON po_lines(poNumber);
    CREATE INDEX IF NOT EXISTS idx_line_io ON po_lines(io);
    CREATE INDEX IF NOT EXISTS idx_line_status ON po_lines(status);
    CREATE INDEX IF NOT EXISTS idx_line_vendor ON po_lines(vendor);

    CREATE TABLE IF NOT EXISTS status_changes (
      id         TEXT PRIMARY KEY,
      poId       TEXT NOT NULL,
      fromStatus TEXT,
      toStatus   TEXT NOT NULL,
      note       TEXT,
      createdAt  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sc_po ON status_changes(poId);

    CREATE TABLE IF NOT EXISTS snapshots (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      note        TEXT,
      data        TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      totalAmount REAL NOT NULL DEFAULT 0,
      createdAt   TEXT NOT NULL
    );
  `);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb._db) globalForDb._db = init();
  return globalForDb._db;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
