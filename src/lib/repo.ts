import { getDb, newId, nowIso } from "./db";
import type { PoLineDTO } from "./types";

export interface PoInput {
  poNumber: string;
  poLine?: string | null;
  io?: string | null;
  vendor?: string | null;
  description?: string | null;
  glAccount?: string | null;
  glDescription?: string | null;
  requisitioner?: string | null;
  owner?: string | null;
  reportingFY?: string | null;
  totalPoValue?: number;
  lineValue?: number;
  invoicedAmount?: number;
  openAmount?: number;
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

const COLS =
  "id, poNumber, poLine, io, vendor, description, glAccount, glDescription, requisitioner, owner, reportingFY, totalPoValue, lineValue, invoicedAmount, openAmount, currency, status, poDate, deliveryDate, executionDate, notes, raw, createdAt, updatedAt";
const PLACEHOLDERS = COLS.split(",").map(() => "?").join(", ");

function insertArgs(id: string, input: PoInput, now: string): any[] {
  return [
    id,
    input.poNumber,
    N(input.poLine),
    N(input.io),
    N(input.vendor),
    N(input.description),
    N(input.glAccount),
    N(input.glDescription),
    N(input.requisitioner),
    N(input.owner),
    N(input.reportingFY),
    input.totalPoValue ?? 0,
    input.lineValue ?? 0,
    input.invoicedAmount ?? 0,
    input.openAmount ?? 0,
    N(input.currency) ?? "CLP",
    N(input.status) ?? "Pendiente",
    ISO(input.poDate),
    ISO(input.deliveryDate),
    ISO(input.executionDate),
    N(input.notes),
    N(input.raw),
    now,
    now,
  ];
}

export interface PoFilters {
  q?: string;
  status?: string;
  io?: string;
  vendor?: string;
  poNumber?: string;
}

export function listPos(f: PoFilters = {}): PoLineDTO[] {
  const db = getDb();
  const clauses: string[] = [];
  const args: any[] = [];
  if (f.status) { clauses.push("status = ?"); args.push(f.status); }
  if (f.io) { clauses.push("io = ?"); args.push(f.io); }
  if (f.vendor) { clauses.push("vendor = ?"); args.push(f.vendor); }
  if (f.poNumber) { clauses.push("poNumber = ?"); args.push(f.poNumber); }
  if (f.q) {
    clauses.push("(poNumber LIKE ? OR vendor LIKE ? OR description LIKE ? OR io LIKE ? OR glDescription LIKE ?)");
    const like = `%${f.q}%`;
    args.push(like, like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM po_lines ${where} ORDER BY poNumber, poLine, io`)
    .all(...args) as any[];
  return rows.map(toDTO);
}

export function getPo(id: string): PoLineDTO | null {
  const row = getDb().prepare("SELECT * FROM po_lines WHERE id = ?").get(id) as any;
  return row ? toDTO(row) : null;
}

export function getHistory(poId: string) {
  return getDb()
    .prepare("SELECT * FROM status_changes WHERE poId = ? ORDER BY createdAt DESC")
    .all(poId) as any[];
}

export function createPo(input: PoInput): PoLineDTO {
  const db = getDb();
  const id = newId();
  db.prepare(`INSERT INTO po_lines (${COLS}) VALUES (${PLACEHOLDERS})`).run(
    ...insertArgs(id, input, nowIso())
  );
  return getPo(id)!;
}

export function updatePo(id: string, patch: Partial<PoInput>): PoLineDTO | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM po_lines WHERE id = ?").get(id) as any;
  if (!existing) return null;

  const fields: string[] = [];
  const args: any[] = [];
  const setField = (col: string, val: any) => { fields.push(`${col} = ?`); args.push(val); };

  if (patch.poNumber !== undefined) setField("poNumber", patch.poNumber);
  if (patch.poLine !== undefined) setField("poLine", N(patch.poLine));
  if (patch.io !== undefined) setField("io", N(patch.io));
  if (patch.vendor !== undefined) setField("vendor", N(patch.vendor));
  if (patch.description !== undefined) setField("description", N(patch.description));
  if (patch.glAccount !== undefined) setField("glAccount", N(patch.glAccount));
  if (patch.glDescription !== undefined) setField("glDescription", N(patch.glDescription));
  if (patch.requisitioner !== undefined) setField("requisitioner", N(patch.requisitioner));
  if (patch.owner !== undefined) setField("owner", N(patch.owner));
  if (patch.reportingFY !== undefined) setField("reportingFY", N(patch.reportingFY));
  if (patch.totalPoValue !== undefined) setField("totalPoValue", patch.totalPoValue ?? 0);
  if (patch.lineValue !== undefined) setField("lineValue", patch.lineValue ?? 0);
  if (patch.invoicedAmount !== undefined) setField("invoicedAmount", patch.invoicedAmount ?? 0);
  if (patch.openAmount !== undefined) setField("openAmount", patch.openAmount ?? 0);
  if (patch.currency !== undefined) setField("currency", N(patch.currency) ?? "CLP");
  if (patch.status !== undefined) setField("status", N(patch.status) ?? existing.status);
  if (patch.poDate !== undefined) setField("poDate", ISO(patch.poDate));
  if (patch.deliveryDate !== undefined) setField("deliveryDate", ISO(patch.deliveryDate));
  if (patch.executionDate !== undefined) setField("executionDate", ISO(patch.executionDate));
  if (patch.notes !== undefined) setField("notes", N(patch.notes));

  setField("updatedAt", nowIso());
  args.push(id);
  db.prepare(`UPDATE po_lines SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  return getPo(id);
}

export function addStatusChange(poId: string, fromStatus: string | null, toStatus: string, note?: string | null) {
  getDb()
    .prepare("INSERT INTO status_changes (id, poId, fromStatus, toStatus, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newId(), poId, N(fromStatus), toStatus, N(note), nowIso());
}

export function deletePo(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM status_changes WHERE poId = ?").run(id);
  db.prepare("DELETE FROM po_lines WHERE id = ?").run(id);
}

export function clearAllPos() {
  const db = getDb();
  db.prepare("DELETE FROM status_changes").run();
  db.prepare("DELETE FROM po_lines").run();
}

export function bulkCreate(inputs: PoInput[]): number {
  const db = getDb();
  const now = nowIso();
  const stmt = db.prepare(`INSERT INTO po_lines (${COLS}) VALUES (${PLACEHOLDERS})`);
  db.exec("BEGIN");
  let count = 0;
  try {
    for (const input of inputs) {
      stmt.run(...insertArgs(newId(), input, now));
      count++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return count;
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
  return getDb()
    .prepare("SELECT id, label, note, count, totalAmount, createdAt FROM snapshots ORDER BY createdAt DESC")
    .all() as any[];
}

export function createSnapshot(label: string, note: string | null): SnapshotMeta {
  const db = getDb();
  const pos = listPos();
  const totalAmount = pos.reduce((s, p) => s + (p.lineValue || 0), 0);
  const id = newId();
  const createdAt = nowIso();
  db.prepare(
    "INSERT INTO snapshots (id, label, note, data, count, totalAmount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, label, N(note), JSON.stringify(pos), pos.length, totalAmount, createdAt);
  return { id, label, note, count: pos.length, totalAmount, createdAt };
}

export function getSnapshot(id: string): any | null {
  const row = getDb().prepare("SELECT * FROM snapshots WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data) };
}

export function deleteSnapshot(id: string) {
  getDb().prepare("DELETE FROM snapshots WHERE id = ?").run(id);
}

export function restoreSnapshot(id: string): number {
  const snap = getSnapshot(id);
  if (!snap) return -1;
  const rows = snap.data as PoLineDTO[];
  clearAllPos();
  const inputs: PoInput[] = rows.map((r) => ({ ...r }));
  return bulkCreate(inputs);
}

// --- Serialización ---

export function toDTO(row: any): PoLineDTO {
  return {
    id: row.id,
    poNumber: row.poNumber,
    poLine: row.poLine ?? null,
    io: row.io ?? null,
    vendor: row.vendor ?? null,
    description: row.description ?? null,
    glAccount: row.glAccount ?? null,
    glDescription: row.glDescription ?? null,
    requisitioner: row.requisitioner ?? null,
    owner: row.owner ?? null,
    reportingFY: row.reportingFY ?? null,
    totalPoValue: row.totalPoValue ?? 0,
    lineValue: row.lineValue ?? 0,
    invoicedAmount: row.invoicedAmount ?? 0,
    openAmount: row.openAmount ?? 0,
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
