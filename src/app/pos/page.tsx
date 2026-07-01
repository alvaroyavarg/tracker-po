"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Download, SlidersHorizontal, Table2, Upload } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, Spinner } from "@/components/ui";
import { PoDrawer } from "@/components/PoDrawer";
import { PurchaseOrderDTO, PO_STATUSES } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/format";

export default function PosPage() {
  const [rows, setRows] = useState<PurchaseOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [io, setIo] = useState("");
  const [drawerPo, setDrawerPo] = useState<PurchaseOrderDTO | null>(null);
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

  const ioOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.io).filter(Boolean))).sort() as string[],
    [rows]
  );

  const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const currency = rows[0]?.currency || "CLP";

  function openNew() {
    setDrawerPo(null);
    setDrawerOpen(true);
  }
  function openEdit(po: PurchaseOrderDTO) {
    setDrawerPo(po);
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
        subtitle={`${rows.length} PO · ${formatMoney(totalAmount, currency)}`}
        actions={
          <>
            <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden">
              <a href={exportUrl("xlsx")} className="btn-ghost rounded-none border-r border-zinc-200">
                <Download className="h-4 w-4" /> Excel
              </a>
              <a href={exportUrl("csv")} className="btn-ghost rounded-none">
                CSV
              </a>
            </div>
            <button onClick={openNew} className="btn-primary">
              <Plus className="h-4 w-4" /> Nueva PO
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
        <div className="flex items-center gap-2 text-ink-muted">
          <SlidersHorizontal className="h-4 w-4" />
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
        <div className="card p-8">
          <Spinner label="Cargando PO…" />
        </div>
      ) : rows.length === 0 ? (
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
                  <Th>N° PO</Th>
                  <Th>IO</Th>
                  <Th>Proveedor</Th>
                  <Th>Descripción</Th>
                  <Th className="text-right">Monto</Th>
                  <Th>Estado</Th>
                  <Th>Ejecución</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => openEdit(po)}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{po.poNumber}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{po.io || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft max-w-[180px] truncate" title={po.vendor || ""}>
                      {po.vendor || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted max-w-[240px] truncate" title={po.description || ""}>
                      {po.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">
                      {formatMoney(po.amount, po.currency)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {formatDate(po.executionDate || po.poDate)}
                    </td>
                  </tr>
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
