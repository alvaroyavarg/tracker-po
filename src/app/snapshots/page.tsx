"use client";

import { useEffect, useState, useCallback } from "react";
import { History, Plus, RotateCcw, Trash2, Camera } from "lucide-react";
import { PageHeader, EmptyState, Spinner } from "@/components/ui";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";

interface Snap {
  id: string;
  label: string;
  note: string | null;
  count: number;
  totalAmount: number;
  createdAt: string;
}

export default function SnapshotsPage() {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((d) => setSnaps(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      if (res.ok) {
        setLabel("");
        setCreating(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore(s: Snap) {
    if (!confirm(`¿Restaurar el respaldo "${s.label}"? Esto reemplazará TODAS las PO actuales por las del respaldo.`)) return;
    const res = await fetch(`/api/snapshots/${s.id}`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      alert(`Restauradas ${d.restored} PO desde el respaldo.`);
    }
  }

  async function remove(s: Snap) {
    if (!confirm(`¿Eliminar el respaldo "${s.label}"?`)) return;
    await fetch(`/api/snapshots/${s.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <PageHeader
        title="Respaldos de ejecución"
        subtitle="Guarda una foto del estado completo de tus PO para comparar o restaurar más adelante."
        actions={
          <button onClick={() => setCreating((c) => !c)} className="btn-primary">
            <Plus className="h-4 w-4" /> Nuevo respaldo
          </button>
        }
      />

      {creating && (
        <div className="card p-5 mb-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="label">Nombre del respaldo</label>
            <input
              className="input"
              placeholder="Ej: Cierre Julio 2026"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>
          <button onClick={create} disabled={busy} className="btn-primary">
            <Camera className="h-4 w-4" /> {busy ? "Guardando…" : "Guardar respaldo"}
          </button>
          <button onClick={() => setCreating(false)} className="btn-ghost">Cancelar</button>
        </div>
      )}

      {loading ? (
        <div className="card p-8"><Spinner label="Cargando respaldos…" /></div>
      ) : snaps.length === 0 ? (
        <EmptyState
          icon={<History className="h-10 w-10" />}
          title="Aún no hay respaldos"
          hint="Crea un respaldo para conservar el estado actual de tus PO. Útil para cierres mensuales o antes de un cambio grande."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {snaps.map((s) => (
            <div key={s.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{s.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{formatDate(s.createdAt)}</p>
                </div>
                <span className="grid place-items-center h-9 w-9 rounded-xl bg-accent-soft text-accent shrink-0">
                  <History className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <div className="text-xs text-ink-muted">PO</div>
                  <div className="font-semibold text-ink">{formatNumber(s.count)}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted">Monto total</div>
                  <div className="font-semibold text-ink">{formatMoney(s.totalAmount)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => restore(s)} className="btn-outline flex-1">
                  <RotateCcw className="h-4 w-4" /> Restaurar
                </button>
                <button onClick={() => remove(s)} className="btn-ghost text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
