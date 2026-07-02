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

// --- Bitácora de actividad por línea ---

export type LineEventType =
  | "manual_invoice"
  | "invoice_progress"
  | "closed_absent"
  | "created"
  | "amounts_updated";

export function addEvent(
  poId: string,
  type: LineEventType,
  opts: { amount?: number | null; prevValue?: number | null; newValue?: number | null; note?: string | null; source?: "manual" | "import" } = {}
) {
  getDb()
    .prepare(
      "INSERT INTO line_events (id, poId, type, amount, prevValue, newValue, note, source, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      newId(),
      poId,
      type,
      opts.amount ?? null,
      opts.prevValue ?? null,
      opts.newValue ?? null,
      N(opts.note),
      opts.source ?? "manual",
      nowIso()
    );
}

export function getEvents(poId: string) {
  return getDb()
    .prepare("SELECT * FROM line_events WHERE poId = ? ORDER BY createdAt DESC")
    .all(poId) as any[];
}

// Estados que la app puede pisar automáticamente; los demás son decisión manual.
const AUTO_STATUSES = new Set(["Pendiente", "En proceso", "Facturada"]);

function deriveStatus(lineValue: number, invoiced: number, open: number): string {
  if (lineValue > 0 && open <= 1) return "Facturada";
  if (invoiced > 0) return "En proceso";
  return "Pendiente";
}

// Registra una facturación manual (incremental): actualiza montos, estado y bitácora.
export function registerInvoice(
  id: string,
  amount: number,
  note?: string | null
): PoLineDTO | null {
  const po = getPo(id);
  if (!po) return null;
  const prevInvoiced = po.invoicedAmount || 0;
  const newInvoiced = Math.max(0, prevInvoiced + amount);
  const newOpen = Math.max(0, (po.lineValue || 0) - newInvoiced);

  const patch: Partial<PoInput> = { invoicedAmount: newInvoiced, openAmount: newOpen };
  if (AUTO_STATUSES.has(po.status)) {
    const st = deriveStatus(po.lineValue || 0, newInvoiced, newOpen);
    if (st !== po.status) {
      patch.status = st;
      addStatusChange(id, po.status, st, "Ajuste por facturación manual");
    }
  }
  const updated = updatePo(id, patch);
  addEvent(id, "manual_invoice", {
    amount,
    prevValue: prevInvoiced,
    newValue: newInvoiced,
    note,
    source: "manual",
  });
  return updated;
}

// --- Reconciliación semanal ---

const lineKey = (poNumber: string, poLine: string | null, io: string | null) =>
  `${poNumber}||${poLine ?? ""}||${io ?? ""}`;

export interface ReconcileSummary {
  created: number;
  progressed: number; // facturación avanzó
  updated: number; // otros montos/datos cambiaron
  closed: number; // no vinieron en la sábana -> facturadas completas y cerradas
  unchanged: number;
  invoicedDelta: number; // total facturado detectado en esta carga
}

// Aplica la sábana semanal contra lo existente:
// - línea existente: actualiza montos/datos de sábana, conserva notas/mes de
//   ejecución/estados manuales, y registra el avance de facturación.
// - línea nueva: se crea.
// - línea existente que no viene: se asume facturada completa -> Cerrada.
export function reconcileImport(records: PoInput[], closeAbsent: boolean): ReconcileSummary {
  const db = getDb();
  const now = nowIso();
  const summary: ReconcileSummary = {
    created: 0,
    progressed: 0,
    updated: 0,
    closed: 0,
    unchanged: 0,
    invoicedDelta: 0,
  };

  // La misma llave PO+línea+IO puede venir repetida legítimamente en la sábana,
  // así que se empareja ocurrencia contra ocurrencia (eligiendo la candidata con
  // el valor de línea más parecido).
  const existing = listPos();
  const byKey = new Map<string, PoLineDTO[]>();
  for (const l of existing) {
    const k = lineKey(l.poNumber, l.poLine, l.io);
    const arr = byKey.get(k) || [];
    arr.push(l);
    byKey.set(k, arr);
  }
  const matchedIds = new Set<string>();

  db.exec("BEGIN");
  try {
    for (const r of records) {
      const key = lineKey(r.poNumber, (r.poLine as string) ?? null, (r.io as string) ?? null);
      const candidates = (byKey.get(key) || []).filter((c) => !matchedIds.has(c.id));

      if (candidates.length === 0) {
        // Línea nueva
        const created = createPo({ ...r });
        db.prepare("UPDATE po_lines SET lastSeenAt = ? WHERE id = ?").run(now, created.id);
        addEvent(created.id, "created", {
          newValue: r.invoicedAmount ?? 0,
          note: "Línea nueva en la sábana",
          source: "import",
        });
        summary.created++;
        continue;
      }

      const targetValue = r.lineValue ?? 0;
      const prev = candidates.reduce((best, c) =>
        Math.abs((c.lineValue || 0) - targetValue) < Math.abs((best.lineValue || 0) - targetValue) ? c : best
      );
      matchedIds.add(prev.id);

      const prevInvoiced = prev.invoicedAmount || 0;
      const newInvoiced = r.invoicedAmount ?? 0;
      const delta = newInvoiced - prevInvoiced;
      const diff = (a: number, b: number) => Math.abs(a - b) > 0.005;
      const amountsChanged =
        diff(r.lineValue ?? 0, prev.lineValue) ||
        diff(r.openAmount ?? 0, prev.openAmount) ||
        diff(newInvoiced, prevInvoiced) ||
        diff(r.totalPoValue ?? 0, prev.totalPoValue);

      // Datos que se refrescan desde la sábana. Notas, mes de ejecución y
      // estados manuales del usuario NO se tocan.
      const patch: Partial<PoInput> = {
        vendor: r.vendor ?? prev.vendor,
        description: r.description ?? prev.description,
        glAccount: r.glAccount ?? prev.glAccount,
        glDescription: r.glDescription ?? prev.glDescription,
        requisitioner: r.requisitioner ?? prev.requisitioner,
        owner: r.owner ?? prev.owner,
        reportingFY: r.reportingFY ?? prev.reportingFY,
        totalPoValue: r.totalPoValue ?? prev.totalPoValue,
        lineValue: r.lineValue ?? prev.lineValue,
        invoicedAmount: newInvoiced,
        openAmount: r.openAmount ?? prev.openAmount,
        currency: r.currency ?? prev.currency,
        poDate: r.poDate ?? prev.poDate,
        deliveryDate: r.deliveryDate ?? prev.deliveryDate,
        raw: r.raw ?? undefined,
      };
      if (AUTO_STATUSES.has(prev.status)) {
        const st = deriveStatus(
          patch.lineValue as number,
          newInvoiced,
          (patch.openAmount as number) ?? 0
        );
        if (st !== prev.status) {
          patch.status = st;
          addStatusChange(prev.id, prev.status, st, "Actualización semanal");
        }
      }
      updatePo(prev.id, patch);
      db.prepare("UPDATE po_lines SET lastSeenAt = ? WHERE id = ?").run(now, prev.id);

      if (delta > 0.005) {
        addEvent(prev.id, "invoice_progress", {
          amount: delta,
          prevValue: prevInvoiced,
          newValue: newInvoiced,
          note: "Avance de facturación detectado en la sábana",
          source: "import",
        });
        summary.progressed++;
        summary.invoicedDelta += delta;
      } else if (amountsChanged) {
        addEvent(prev.id, "amounts_updated", {
          prevValue: prev.lineValue,
          newValue: (patch.lineValue as number) ?? prev.lineValue,
          note: "Montos actualizados desde la sábana",
          source: "import",
        });
        summary.updated++;
      } else {
        summary.unchanged++;
      }
    }

    // Líneas que no vinieron: facturadas completas y cerradas.
    if (closeAbsent) {
      for (const prev of existing) {
        if (matchedIds.has(prev.id)) continue;
        if (prev.status === "Cerrada" || prev.status === "Anulada") continue;
        const prevInvoiced = prev.invoicedAmount || 0;
        const finalInvoiced = prev.lineValue || prevInvoiced;
        updatePo(prev.id, {
          invoicedAmount: finalInvoiced,
          openAmount: 0,
          status: "Cerrada",
        });
        addStatusChange(prev.id, prev.status, "Cerrada", "No vino en la sábana semanal");
        addEvent(prev.id, "closed_absent", {
          amount: Math.max(0, finalInvoiced - prevInvoiced),
          prevValue: prevInvoiced,
          newValue: finalInvoiced,
          note: "Facturada completa: la línea ya no aparece en la sábana",
          source: "import",
        });
        summary.closed++;
        summary.invoicedDelta += Math.max(0, finalInvoiced - prevInvoiced);
      }
    }

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return summary;
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
