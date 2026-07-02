import { PoolClient } from "pg";
import { q, withTransaction, newId, nowIso } from "./db";
import { fyBounds } from "./format";
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

// Ejecutor de queries: el pool por defecto, o un cliente dentro de una transacción.
type Runner = (text: string, params?: any[]) => Promise<any[]>;
const poolRunner: Runner = (text, params) => q(text, params || []);
const clientRunner = (c: PoolClient): Runner => async (text, params) =>
  (await c.query(text, params || [])).rows;

const COLS = [
  "id", "poNumber", "poLine", "io", "vendor", "description", "glAccount",
  "glDescription", "requisitioner", "owner", "reportingFY", "totalPoValue",
  "lineValue", "invoicedAmount", "openAmount", "currency", "status", "poDate",
  "deliveryDate", "executionDate", "notes", "raw", "lastSeenAt", "createdAt", "updatedAt",
];
const COL_LIST = COLS.map((c) => `"${c}"`).join(", ");
const PLACEHOLDERS = COLS.map((_, i) => `$${i + 1}`).join(", ");

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
    N(input.status) ?? "Abierta",
    ISO(input.poDate),
    ISO(input.deliveryDate),
    ISO(input.executionDate),
    N(input.notes),
    N(input.raw),
    null, // lastSeenAt
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
  fy?: string; // "F26" = creadas 01/07/2025 → 30/06/2026
}

export async function listPos(f: PoFilters = {}, run: Runner = poolRunner): Promise<PoLineDTO[]> {
  const clauses: string[] = [];
  const args: any[] = [];
  const p = () => `$${args.length}`;
  if (f.status) { args.push(f.status); clauses.push(`status = ${p()}`); }
  if (f.io) { args.push(f.io); clauses.push(`io = ${p()}`); }
  if (f.vendor) { args.push(f.vendor); clauses.push(`vendor = ${p()}`); }
  if (f.poNumber) { args.push(f.poNumber); clauses.push(`"poNumber" = ${p()}`); }
  if (f.fy) {
    const b = fyBounds(f.fy);
    if (b) {
      // Por fecha de creación; sin fecha, cae al Reporting FY de la sábana.
      args.push(b.start);
      const pStart = p();
      args.push(b.end);
      const pEnd = p();
      args.push(String(b.endYear));
      const pFY = p();
      clauses.push(
        `(("poDate" >= ${pStart} AND "poDate" < ${pEnd}) OR ("poDate" IS NULL AND "reportingFY" = ${pFY}))`
      );
    }
  }
  if (f.q) {
    args.push(`%${f.q}%`);
    const like = p();
    clauses.push(
      `("poNumber" ILIKE ${like} OR vendor ILIKE ${like} OR description ILIKE ${like} OR io ILIKE ${like} OR "glDescription" ILIKE ${like})`
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await run(
    `SELECT * FROM po_lines ${where} ORDER BY "poNumber", "poLine", io`,
    args
  );
  return rows.map(toDTO);
}

export async function getPo(id: string, run: Runner = poolRunner): Promise<PoLineDTO | null> {
  const rows = await run("SELECT * FROM po_lines WHERE id = $1", [id]);
  return rows[0] ? toDTO(rows[0]) : null;
}

export async function getHistory(poId: string) {
  return q('SELECT * FROM status_changes WHERE "poId" = $1 ORDER BY "createdAt" DESC', [poId]);
}

export async function createPo(input: PoInput, run: Runner = poolRunner): Promise<PoLineDTO> {
  const id = newId();
  await run(
    `INSERT INTO po_lines (${COL_LIST}) VALUES (${PLACEHOLDERS})`,
    insertArgs(id, input, nowIso())
  );
  return (await getPo(id, run))!;
}

const PATCHABLE: Record<string, "text" | "num" | "date"> = {
  poNumber: "text", poLine: "text", io: "text", vendor: "text", description: "text",
  glAccount: "text", glDescription: "text", requisitioner: "text", owner: "text",
  reportingFY: "text", notes: "text", raw: "text", currency: "text", status: "text",
  totalPoValue: "num", lineValue: "num", invoicedAmount: "num", openAmount: "num",
  poDate: "date", deliveryDate: "date", executionDate: "date",
};

export async function updatePo(
  id: string,
  patch: Partial<PoInput>,
  run: Runner = poolRunner
): Promise<PoLineDTO | null> {
  const existing = await getPo(id, run);
  if (!existing) return null;

  const fields: string[] = [];
  const args: any[] = [];
  for (const [key, kind] of Object.entries(PATCHABLE)) {
    const val = (patch as any)[key];
    if (val === undefined) continue;
    args.push(kind === "num" ? val ?? 0 : kind === "date" ? ISO(val) : N(val));
    fields.push(`"${key}" = $${args.length}`);
  }
  args.push(nowIso());
  fields.push(`"updatedAt" = $${args.length}`);
  args.push(id);
  await run(`UPDATE po_lines SET ${fields.join(", ")} WHERE id = $${args.length}`, args);
  return getPo(id, run);
}

export async function addStatusChange(
  poId: string,
  fromStatus: string | null,
  toStatus: string,
  note?: string | null,
  run: Runner = poolRunner
) {
  await run(
    'INSERT INTO status_changes (id, "poId", "fromStatus", "toStatus", note, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
    [newId(), poId, N(fromStatus), toStatus, N(note), nowIso()]
  );
}

// --- Bitácora de actividad por línea ---

export type LineEventType =
  | "manual_invoice"
  | "invoice_progress"
  | "closed_absent"
  | "created"
  | "amounts_updated";

export async function addEvent(
  poId: string,
  type: LineEventType,
  opts: { amount?: number | null; prevValue?: number | null; newValue?: number | null; note?: string | null; source?: "manual" | "import" } = {},
  run: Runner = poolRunner
) {
  await run(
    'INSERT INTO line_events (id, "poId", type, amount, "prevValue", "newValue", note, source, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      newId(),
      poId,
      type,
      opts.amount ?? null,
      opts.prevValue ?? null,
      opts.newValue ?? null,
      N(opts.note),
      opts.source ?? "manual",
      nowIso(),
    ]
  );
}

export async function getEvents(poId: string) {
  return q('SELECT * FROM line_events WHERE "poId" = $1 ORDER BY "createdAt" DESC', [poId]);
}

// Solo las líneas Abiertas cambian de estado automáticamente (a Cerrada al
// facturar el 100%). Una línea cerrada a mano no se reabre sola.
const AUTO_STATUSES = new Set(["Abierta"]);

function deriveStatus(lineValue: number, invoiced: number, open: number): string {
  return lineValue > 0 && open <= 1 ? "Cerrada" : "Abierta";
}

// Registra una facturación manual (incremental): actualiza montos, estado y bitácora.
export async function registerInvoice(
  id: string,
  amount: number,
  note?: string | null
): Promise<PoLineDTO | null> {
  const po = await getPo(id);
  if (!po) return null;
  const prevInvoiced = po.invoicedAmount || 0;
  const newInvoiced = Math.max(0, prevInvoiced + amount);
  const newOpen = Math.max(0, (po.lineValue || 0) - newInvoiced);

  const patch: Partial<PoInput> = { invoicedAmount: newInvoiced, openAmount: newOpen };
  if (AUTO_STATUSES.has(po.status)) {
    const st = deriveStatus(po.lineValue || 0, newInvoiced, newOpen);
    if (st !== po.status) {
      patch.status = st;
      await addStatusChange(id, po.status, st, "Ajuste por facturación manual");
    }
  }
  const updated = await updatePo(id, patch);
  await addEvent(id, "manual_invoice", {
    amount,
    prevValue: prevInvoiced,
    newValue: newInvoiced,
    note,
    source: "manual",
  });
  return updated;
}

export async function deletePo(id: string) {
  await q('DELETE FROM status_changes WHERE "poId" = $1', [id]);
  await q('DELETE FROM line_events WHERE "poId" = $1', [id]);
  await q("DELETE FROM po_lines WHERE id = $1", [id]);
}

export async function clearAllPos() {
  await q("DELETE FROM status_changes");
  await q("DELETE FROM line_events");
  await q("DELETE FROM po_lines");
}

export async function bulkCreate(inputs: PoInput[]): Promise<number> {
  return withTransaction(async (c) => {
    const now = nowIso();
    for (const input of inputs) {
      await c.query(`INSERT INTO po_lines (${COL_LIST}) VALUES (${PLACEHOLDERS})`, insertArgs(newId(), input, now));
    }
    return inputs.length;
  });
}

// --- Reconciliación semanal ---

const lineKey = (poNumber: string, poLine: string | null, io: string | null) =>
  `${poNumber}||${poLine ?? ""}||${io ?? ""}`;

export interface ReconcileSummary {
  created: number;
  progressed: number;
  updated: number;
  closed: number;
  unchanged: number;
  invoicedDelta: number;
}

// Aplica la sábana semanal contra lo existente:
// - línea existente: actualiza montos/datos de sábana, conserva notas/mes de
//   ejecución/estados manuales, y registra el avance de facturación.
// - línea nueva: se crea.
// - línea existente que no viene: se asume facturada completa -> Cerrada.
export async function reconcileImport(records: PoInput[], closeAbsent: boolean): Promise<ReconcileSummary> {
  return withTransaction(async (c) => {
    const run = clientRunner(c);
    const now = nowIso();
    const summary: ReconcileSummary = {
      created: 0, progressed: 0, updated: 0, closed: 0, unchanged: 0, invoicedDelta: 0,
    };

    // La misma llave PO+línea+IO puede venir repetida legítimamente en la sábana,
    // así que se empareja ocurrencia contra ocurrencia (eligiendo la candidata con
    // el valor de línea más parecido).
    const existing = await listPos({}, run);
    const byKey = new Map<string, PoLineDTO[]>();
    for (const l of existing) {
      const k = lineKey(l.poNumber, l.poLine, l.io);
      const arr = byKey.get(k) || [];
      arr.push(l);
      byKey.set(k, arr);
    }
    const matchedIds = new Set<string>();

    for (const r of records) {
      const key = lineKey(r.poNumber, (r.poLine as string) ?? null, (r.io as string) ?? null);
      const candidates = (byKey.get(key) || []).filter((x) => !matchedIds.has(x.id));

      if (candidates.length === 0) {
        const created = await createPo({ ...r }, run);
        await run('UPDATE po_lines SET "lastSeenAt" = $1 WHERE id = $2', [now, created.id]);
        await addEvent(created.id, "created", {
          newValue: r.invoicedAmount ?? 0,
          note: "Línea nueva en la sábana",
          source: "import",
        }, run);
        summary.created++;
        continue;
      }

      const targetValue = r.lineValue ?? 0;
      const prev = candidates.reduce((best, x) =>
        Math.abs((x.lineValue || 0) - targetValue) < Math.abs((best.lineValue || 0) - targetValue) ? x : best
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
          await addStatusChange(prev.id, prev.status, st, "Actualización semanal", run);
        }
      }
      await updatePo(prev.id, patch, run);
      await run('UPDATE po_lines SET "lastSeenAt" = $1 WHERE id = $2', [now, prev.id]);

      if (delta > 0.005) {
        await addEvent(prev.id, "invoice_progress", {
          amount: delta,
          prevValue: prevInvoiced,
          newValue: newInvoiced,
          note: "Avance de facturación detectado en la sábana",
          source: "import",
        }, run);
        summary.progressed++;
        summary.invoicedDelta += delta;
      } else if (amountsChanged) {
        await addEvent(prev.id, "amounts_updated", {
          prevValue: prev.lineValue,
          newValue: (patch.lineValue as number) ?? prev.lineValue,
          note: "Montos actualizados desde la sábana",
          source: "import",
        }, run);
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
        await updatePo(prev.id, {
          invoicedAmount: finalInvoiced,
          openAmount: 0,
          status: "Cerrada",
        }, run);
        await addStatusChange(prev.id, prev.status, "Cerrada", "No vino en la sábana semanal", run);
        await addEvent(prev.id, "closed_absent", {
          amount: Math.max(0, finalInvoiced - prevInvoiced),
          prevValue: prevInvoiced,
          newValue: finalInvoiced,
          note: "Facturada completa: la línea ya no aparece en la sábana",
          source: "import",
        }, run);
        summary.closed++;
        summary.invoicedDelta += Math.max(0, finalInvoiced - prevInvoiced);
      }
    }

    return summary;
  });
}

// --- Registro de IOs (gestión y áreas) ---

export interface IoInfo {
  io: string;
  managed: boolean;
  area: string | null;
  lineCount: number;
  committed: number;
  open: number;
}

// Heurística inicial: los IO con "TS" tras el prefijo (MCH26TSOTAA2) son de
// Trade/otra área y parten como no gestionados. El resto parte como propio.
function defaultClassification(io: string): { managed: boolean; area: string | null } {
  if (/^.{5}TS/i.test(io)) return { managed: false, area: "TS" };
  return { managed: true, area: null };
}

// Asegura que todo IO presente en po_lines exista en el registro.
export async function syncIoRegistry(): Promise<void> {
  const rows = await q(
    `SELECT DISTINCT io FROM po_lines WHERE io IS NOT NULL
     AND io NOT IN (SELECT io FROM io_registry)`
  );
  for (const r of rows) {
    const def = defaultClassification(r.io);
    await q(
      'INSERT INTO io_registry (io, managed, area, "updatedAt") VALUES ($1, $2, $3, $4) ON CONFLICT (io) DO NOTHING',
      [r.io, def.managed, def.area, nowIso()]
    );
  }
}

export async function listIos(): Promise<IoInfo[]> {
  await syncIoRegistry();
  const rows = await q(`
    SELECT r.io, r.managed, r.area,
           COUNT(l.id)::int AS "lineCount",
           COALESCE(SUM(l."lineValue"), 0)::float AS committed,
           COALESCE(SUM(l."openAmount"), 0)::float AS open
    FROM io_registry r
    LEFT JOIN po_lines l ON l.io = r.io
    GROUP BY r.io, r.managed, r.area
    ORDER BY r.managed DESC, committed DESC
  `);
  return rows as IoInfo[];
}

export async function upsertIo(io: string, patch: { managed?: boolean; area?: string | null }) {
  const def = defaultClassification(io);
  await q(
    `INSERT INTO io_registry (io, managed, area, "updatedAt") VALUES ($1, $2, $3, $4)
     ON CONFLICT (io) DO UPDATE SET
       managed = COALESCE($5, io_registry.managed),
       area = CASE WHEN $6 THEN $7 ELSE io_registry.area END,
       "updatedAt" = $4`,
    [
      io,
      patch.managed ?? def.managed,
      patch.area !== undefined ? patch.area : def.area,
      nowIso(),
      patch.managed ?? null,
      patch.area !== undefined,
      patch.area ?? null,
    ]
  );
}

// Set de IOs de mi gestión (para filtrar dashboard/forecast).
export async function managedIoSet(): Promise<Set<string>> {
  await syncIoRegistry();
  const rows = await q("SELECT io FROM io_registry WHERE managed = TRUE");
  return new Set(rows.map((r) => r.io));
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

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  return q(
    'SELECT id, label, note, count, "totalAmount", "createdAt" FROM snapshots ORDER BY "createdAt" DESC'
  ) as Promise<SnapshotMeta[]>;
}

export async function createSnapshot(label: string, note: string | null): Promise<SnapshotMeta> {
  const pos = await listPos();
  const totalAmount = pos.reduce((s, p) => s + (p.lineValue || 0), 0);
  const id = newId();
  const createdAt = nowIso();
  await q(
    'INSERT INTO snapshots (id, label, note, data, count, "totalAmount", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, label, N(note), JSON.stringify(pos), pos.length, totalAmount, createdAt]
  );
  return { id, label, note, count: pos.length, totalAmount, createdAt };
}

export async function getSnapshot(id: string): Promise<any | null> {
  const rows = await q("SELECT * FROM snapshots WHERE id = $1", [id]);
  if (!rows[0]) return null;
  return { ...rows[0], data: JSON.parse(rows[0].data) };
}

export async function deleteSnapshot(id: string) {
  await q("DELETE FROM snapshots WHERE id = $1", [id]);
}

export async function restoreSnapshot(id: string): Promise<number> {
  const snap = await getSnapshot(id);
  if (!snap) return -1;
  const rows = snap.data as PoLineDTO[];
  await clearAllPos();
  const inputs: PoInput[] = rows.map((r) => ({ ...r, raw: undefined }));
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
    status: row.status ?? "Abierta",
    poDate: row.poDate ?? null,
    deliveryDate: row.deliveryDate ?? null,
    executionDate: row.executionDate ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
