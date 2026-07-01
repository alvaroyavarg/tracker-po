import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Base de datos SQLite integrada en Node (sin dependencias externas ni binarios).
// Requiere ejecutar Node con --experimental-sqlite (ver scripts en package.json).

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "tracker.db");

const globalForDb = globalThis as unknown as { _db?: DatabaseSync };

function init(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id            TEXT PRIMARY KEY,
      poNumber      TEXT NOT NULL,
      io            TEXT,
      brand         TEXT,
      vendor        TEXT,
      description   TEXT,
      category      TEXT,
      amount        REAL NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'CLP',
      status        TEXT NOT NULL DEFAULT 'Pendiente',
      poDate        TEXT,
      deliveryDate  TEXT,
      executionDate TEXT,
      notes         TEXT,
      raw           TEXT,
      createdAt     TEXT NOT NULL,
      updatedAt     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_po_io ON purchase_orders(io);
    CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor);

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
