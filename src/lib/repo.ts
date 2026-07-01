import { getDb, newId, nowIso } from "./db";
import type { PurchaseOrderDTO } from "./types";

export interface PoInput {
  poNumber: string;
  io?: string | null;
  brand?: string | null;
  vendor?: string | null;
  description?: string | null;
  category?: string | null;
  amount?: number;
  currency?: string | null;
  status?: string | null;
  poDate?: Date | string | null;
  deliveryDate?: Date | string | null;
  executionDate?: Date | string | null;
  notes?: string | null;
  raw?: string | null;
}

const N = (v: unknown) => (v === undefined || v === "" ? null : (v as any));
const ISO = (d: Date | string | null | undefined): string | null => {
  if (d == null || d === "") return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString();
  return String(d);
};

export interface PoFilters {
  q?: string;
  status?: string;
  io?: string;
  vendor?: string;
  brand?: string;
}

export function listPos(f: PoFilters = {}): PurchaseOrderDTO[] {
  const db = getDb();
  const clauses: string[] = [];
  const args: any[] = [];
  if (f.status) { clauses.push("status = ?"); args.push(f.status); }
  if (f.io) { clauses.push("io = ?"); args.push(f.io); }
  if (f.vendor) { clauses.push("vendor = ?"); args.push(f.vendor); }
  if (f.brand) { clauses.push("brand = ?"); args.push(f.brand); }
  if (f.q) {
    clauses.push("(poNumber LIKE ? OR vendor LIKE ? OR description LIKE ? OR io LIKE ? OR brand LIKE ?)");
    const like = `%${f.q}%`;
    args.push(like, like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM purchase_orders ${where} ORDER BY createdAt DESC`)
    .all(...args) as any[];
  return rows.map(toDTO);
}

export function getPo(id: string): PurchaseOrderDTO | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as any;
  return row ? toDTO(row) : null;
}

export function getHistory(poId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM status_changes WHERE poId = ? ORDER BY createdAt DESC")
    .all(poId) as any[];
}

export function createPo(input: PoInput): PurchaseOrderDTO {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO purchase_orders
     (id, poNumber, io, brand, vendor, description, category, amount, currency, status,
      poDate, deliveryDate, executionDate, notes, raw, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.poNumber,
    N(input.io),
    N(input.brand),
    N(input.vendor),
    N(input.description),
    N(input.category),
    input.amount ?? 0,
    N(input.currency) ?? "CLP",
    N(input.status) ?? "Pendiente",
    ISO(input.poDate),
    ISO(input.deliveryDate),
    ISO(input.executionDate),
    N(input.notes),
    N(input.raw),
    now,
    now
  );
  return getPo(id)!;
}

export function updatePo(id: string, patch: Partial<PoInput>): PurchaseOrderDTO | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as any;
  if (!existing) return null;

  const fields: string[] = [];
  const args: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); args.push(val); };

  if (patch.poNumber !== undefined) setField("poNumber", patch.poNumber);
  if (patch.io !== undefined) setField("io", N(patch.io));
  if (patch.brand !== undefined) setField("brand", N(patch.brand));
  if (patch.vendor !== undefined) setField("vendor", N(patch.vendor));
  if (patch.description !== undefined) setField("description", N(patch.description));
  if (patch.category !== undefined) setField("category", N(patch.category));
  if (patch.amount !== undefined) setField("amount", patch.amount ?? 0);
  if (patch.currency !== undefined) setField("currency", N(patch.currency) ?? "CLP");
  if (patch.status !== undefined) setField("status", N(patch.status) ?? existing.status);
  if (patch.poDate !== undefined) setField("poDate", ISO(patch.poDate));
  if (patch.deliveryDate !== undefined) setField("deliveryDate", ISO(patch.deliveryDate));
  if (patch.executionDate !== undefined) setField("executionDate", ISO(patch.executionDate));
  if (patch.notes !== undefined) setField("notes", N(patch.notes));

  setField("updatedAt", nowIso());
  args.push(id);
  db.prepare(`UPDATE purchase_orders SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  return getPo(id);
}

export function addStatusChange(poId: string, fromStatus: string | null, toStatus: string, note?: string | null) {
  const db = getDb();
  db.prepare(
    "INSERT INTO status_changes (id, poId, fromStatus, toStatus, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(newId(), poId, N(fromStatus), toStatus, N(note), nowIso());
}

export function deletePo(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM status_changes WHERE poId = ?").run(id);
  db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
}

export function clearAllPos() {
  const db = getDb();
  db.prepare("DELETE FROM status_changes").run();
  db.prepare("DELETE FROM purchase_orders").run();
}

export function bulkCreate(inputs: PoInput[]): number {
  const db = getDb();
  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO purchase_orders
     (id, poNumber, io, brand, vendor, description, category, amount, currency, status,
      poDate, deliveryDate, executionDate, notes, raw, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.exec("BEGIN");
  let count = 0;
  try {
    for (const input of inputs) {
      stmt.run(
        newId(),
        input.poNumber,
        N(input.io),
        N(input.brand),
        N(input.vendor),
        N(input.description),
        N(input.category),
        input.amount ?? 0,
        N(input.currency) ?? "CLP",
        N(input.status) ?? "Pendiente",
        ISO(input.poDate),
        ISO(input.deliveryDate),
        ISO(input.executionDate),
        N(input.notes),
        N(input.raw),
        now,
        now
      );
      count++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return count;
}

export function allPosRaw(): PurchaseOrderDTO[] {
  return listPos();
}

// --- Snapshots ---

export interface SnapshotMeta {
  id: string;
  label: string;
  note: string | null;
  count: number;
  totalAmount: number;
  createdAt: string;
}

export function listSnapshots(): SnapshotMeta[] {
  const db = getDb();
  return db
    .prepare("SELECT id, label, note, count, totalAmount, createdAt FROM snapshots ORDER BY createdAt DESC")
    .all() as any[];
}

export function createSnapshot(label: string, note: string | null): SnapshotMeta {
  const db = getDb();
  const pos = listPos();
  const totalAmount = pos.reduce((s, p) => s + (p.amount || 0), 0);
  const id = newId();
  const createdAt = nowIso();
  db.prepare(
    "INSERT INTO snapshots (id, label, note, data, count, totalAmount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, label, N(note), JSON.stringify(pos), pos.length, totalAmount, createdAt);
  return { id, label, note, count: pos.length, totalAmount, createdAt };
}

export function getSnapshot(id: string): any | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM snapshots WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) };
}

export function deleteSnapshot(id: string) {
  getDb().prepare("DELETE FROM snapshots WHERE id = ?").run(id);
}

export function restoreSnapshot(id: string): number {
  const snap = getSnapshot(id);
  if (!snap) return -1;
  const rows = snap.data as PurchaseOrderDTO[];
  clearAllPos();
  const inputs: PoInput[] = rows.map((r) => ({
    poNumber: r.poNumber,
    io: r.io,
    brand: r.brand,
    vendor: r.vendor,
    description: r.description,
    category: r.category,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    poDate: r.poDate,
    deliveryDate: r.deliveryDate,
    executionDate: r.executionDate,
    notes: r.notes,
  }));
  return bulkCreate(inputs);
}

// --- Serialización ---

export function toDTO(row: any): PurchaseOrderDTO {
  return {
    id: row.id,
    poNumber: row.poNumber,
    io: row.io ?? null,
    brand: row.brand ?? null,
    vendor: row.vendor ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    amount: row.amount ?? 0,
    currency: row.currency ?? "CLP",
    status: row.status ?? "Pendiente",
    poDate: row.poDate ?? null,
    deliveryDate: row.deliveryDate ?? null,
    executionDate: row.executionDate ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
