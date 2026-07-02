"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Download, ChevronRight, Table2, Upload, Layers } from "lucide-react";
import clsx from "clsx";
import { PageHeader, StatusBadge, EmptyState, Spinner } from "@/components/ui";
import { PoDrawer } from "@/components/PoDrawer";
import { PoLineDTO, PO_STATUSES, groupByPo, PoGroup } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";

export default function PosPage() {
  const [rows, setRows] = useState<PoLineDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [io, setIo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawerPo, setDrawerPo] = useState<PoLineDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (io) params.set("io", io);
    fetch(`/api/pos?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .finally(() => setLoading(false));
  }, [q, status, io]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const groups = useMemo(() => groupByPo(rows), [rows]);

  const ioOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.io).filter(Boolean))).sort() as string[],
    [rows]
  );

  const currency = rows[0]?.currency || "CLP";
  const invoicedSum = rows.reduce((s, r) => s + (r.invoicedAmount || 0), 0);
  const openSum = rows.reduce((s, r) => s + (r.openAmount || 0), 0);

  function toggle(poNumber: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber);
      else next.add(poNumber);
      return next;
    });
  }

  function openEdit(line: PoLineDTO) {
    setDrawerPo(line);
    setDrawerOpen(true);
  }
  function openNew() {
    setDrawerPo(null);
    setDrawerOpen(true);
  }

  function exportUrl(format: "xlsx" | "csv") {
    const params = new URLSearchParams({ format });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (io) params.set("io", io);
    return `/api/export?${params.toString()}`;
  }

  return (
    <div className="p-8 max-w-[1300px] mx-auto">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${groups.length} PO · ${rows.length} líneas · Facturado ${formatMoney(invoicedSum, currency)} · Abierto ${formatMoney(openSum, currency)}`}
        actions={
          <>
            <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden">
              <a href={exportUrl("xlsx")} className="btn-ghost rounded-none border-r border-zinc-200">
                <Download className="h-4 w-4" /> Excel
              </a>
              <a href={exportUrl("csv")} className="btn-ghost rounded-none">CSV</a>
            </div>
            <button onClick={openNew} className="btn-primary">
              <Plus className="h-4 w-4" /> Nueva línea
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por PO, proveedor, descripción, IO…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {PO_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input w-auto" value={io} onChange={(e) => setIo(e.target.value)}>
          <option value="">Todos los IO</option>
          {ioOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card p-8"><Spinner label="Cargando PO…" /></div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-10 w-10" />}
          title="No hay PO que mostrar"
          hint="Ajusta los filtros o carga tu sábana para ver tus Purchase Orders acá."
          action={
            <Link href="/import" className="btn-primary">
              <Upload className="h-4 w-4" /> Cargar sábana
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted border-b border-zinc-200/70">
                  <Th className="w-8"></Th>
                  <Th>N° PO</Th>
                  <Th>Proveedor</Th>
                  <Th>Descripción</Th>
                  <Th className="text-center">Líneas / IOs</Th>
                  <Th className="text-right">Valor PO</Th>
                  <Th className="text-right">Facturado</Th>
                  <Th className="text-right">Abierto</Th>
                  <Th>Estado</Th>
                  <Th className="w-32">Ejecución</Th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows
                    key={g.poNumber}
                    group={g}
                    expanded={expanded.has(g.poNumber)}
                    onToggle={() => toggle(g.poNumber)}
                    onEditLine={openEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PoDrawer
        po={drawerPo}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
      />
    </div>
  );
}

function GroupRows({
  group: g,
  expanded,
  onToggle,
  onEditLine,
}: {
  group: PoGroup;
  expanded: boolean;
  onToggle: () => void;
  onEditLine: (l: PoLineDTO) => void;
}) {
  const currency = g.lines[0]?.currency || "CLP";
  const pct = g.lineSum > 0 ? Math.min(100, (g.invoicedSum / g.lineSum) * 100) : 0;
  const multiIO = g.ios.length > 1;
  // La PO está Cerrada solo cuando todas sus líneas lo están.
  const groupStatus = g.lines.every((l) => l.status === "Cerrada") ? "Cerrada" : "Abierta";

  // Desglose por IO (cuando una PO se paga con más de un IO).
  const ioBreakdown = useMemoIoBreakdown(g);

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70 cursor-pointer transition-colors"
      >
        <td className="pl-4 py-3">
          <ChevronRight
            className={clsx("h-4 w-4 text-zinc-400 transition-transform", expanded && "rotate-90")}
          />
        </td>
        <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{g.poNumber}</td>
        <td className="px-4 py-3 text-ink-soft max-w-[170px] truncate" title={g.vendor || ""}>
          {g.vendor || "—"}
        </td>
        <td className="px-4 py-3 text-ink-muted max-w-[230px] truncate" title={g.description || ""}>
          {g.description || "—"}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className="badge bg-zinc-100 text-zinc-600 ring-zinc-500/20">
            {g.lines.length} {g.lines.length === 1 ? "línea" : "líneas"}
          </span>
          {multiIO && (
            <span className="badge bg-accent-soft text-accent ring-accent/20 ml-1">
              {g.ios.length} IOs
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">
          {formatMoney(g.totalPoValue, currency)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-emerald-700 whitespace-nowrap">
          {formatMoney(g.invoicedSum, currency)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-amber-700 whitespace-nowrap">
          {formatMoney(g.openSum, currency)}
        </td>
        <td className="px-4 py-3"><StatusBadge status={groupStatus} /></td>
        <td className="px-4 py-3 pr-5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-ink-muted w-9 text-right">{pct.toFixed(0)}%</span>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-zinc-50/50">
          <td colSpan={10} className="px-6 pb-4 pt-1">
            {multiIO && (
              <div className="flex flex-wrap gap-2 my-3">
                {ioBreakdown.map((b) => (
                  <div key={b.io} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-medium text-accent">{b.io}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      <span className="text-ink font-medium tabular-nums">{formatMoney(b.lineSum, currency)}</span>
                      {" · fact. "}
                      <span className="text-emerald-700 tabular-nums">{formatMoney(b.invoiced, currency)}</span>
                      {" · abierto "}
                      <span className="text-amber-700 tabular-nums">{formatMoney(b.open, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-ink-muted border-b border-zinc-100">
                    <th className="px-3 py-2 font-medium">Línea</th>
                    <th className="px-3 py-2 font-medium">IO</th>
                    <th className="px-3 py-2 font-medium">G/L</th>
                    <th className="px-3 py-2 font-medium text-right">Valor línea</th>
                    <th className="px-3 py-2 font-medium text-right">Facturado</th>
                    <th className="px-3 py-2 font-medium text-right">Abierto</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((l) => (
                    <tr
                      key={l.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditLine(l);
                      }}
                      className="border-b border-zinc-50 last:border-0 hover:bg-accent-soft/30 cursor-pointer"
                    >
                      <td className="px-3 py-2 text-ink font-medium">{l.poLine || "—"}</td>
                      <td className="px-3 py-2 text-accent font-medium whitespace-nowrap">{l.io || "—"}</td>
                      <td className="px-3 py-2 text-ink-muted max-w-[150px] truncate" title={l.glDescription || ""}>
                        {l.glDescription || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink whitespace-nowrap">
                        {formatMoney(l.lineValue, l.currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 whitespace-nowrap">
                        {formatMoney(l.invoicedAmount, l.currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700 whitespace-nowrap">
                        {formatMoney(l.openAmount, l.currency)}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                      <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                        {formatDate(l.deliveryDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function useMemoIoBreakdown(g: PoGroup) {
  const map = new Map<string, { io: string; lineSum: number; invoiced: number; open: number }>();
  for (const l of g.lines) {
    const io = l.io || "Sin IO";
    const cur = map.get(io) || { io, lineSum: 0, invoiced: 0, open: 0 };
    cur.lineSum += l.lineValue || 0;
    cur.invoiced += l.invoicedAmount || 0;
    cur.open += l.openAmount || 0;
    map.set(io, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.lineSum - a.lineSum);
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
