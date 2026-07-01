"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import { PO_STATUSES, PurchaseOrderDTO } from "@/lib/types";
import { formatDate } from "@/lib/format";

interface Props {
  po: PurchaseOrderDTO | null; // null => nueva PO
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  poNumber: "",
  io: "",
  brand: "",
  vendor: "",
  description: "",
  category: "",
  amount: "",
  currency: "CLP",
  status: "Pendiente",
  poDate: "",
  deliveryDate: "",
  executionDate: "",
  notes: "",
};

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function PoDrawer({ po, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const isNew = !po;

  useEffect(() => {
    if (po) {
      setForm({
        poNumber: po.poNumber || "",
        io: po.io || "",
        brand: po.brand || "",
        vendor: po.vendor || "",
        description: po.description || "",
        category: po.category || "",
        amount: String(po.amount ?? ""),
        currency: po.currency || "CLP",
        status: po.status || "Pendiente",
        poDate: toInputDate(po.poDate),
        deliveryDate: toInputDate(po.deliveryDate),
        executionDate: toInputDate(po.executionDate),
        notes: po.notes || "",
      });
      fetch(`/api/pos/${po.id}`)
        .then((r) => r.json())
        .then((d) => setHistory(d.data?.history || []))
        .catch(() => setHistory([]));
    } else {
      setForm(emptyForm);
      setHistory([]);
    }
  }, [po, open]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.poNumber.trim()) {
      alert("El N° de PO es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const url = isNew ? "/api/pos" : `/api/pos/${po!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Error al guardar");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!po) return;
    if (!confirm(`¿Eliminar la PO ${po.poNumber}?`)) return;
    await fetch(`/api/pos/${po.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-lift flex flex-col animate-[slideIn_.2s_ease-out]">
        <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/70">
          <h2 className="font-semibold text-ink">{isNew ? "Nueva PO" : `PO ${po!.poNumber}`}</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="N° PO *">
              <input className="input" value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
            </Field>
            <Field label="IO">
              <input className="input" value={form.io} onChange={(e) => set("io", e.target.value)} />
            </Field>
            <Field label="Marca">
              <input className="input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </Field>
            <Field label="Proveedor">
              <input className="input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
            </Field>
          </div>

          <Field label="Descripción">
            <input className="input" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} />
            </Field>
            <Field label="Estado">
              <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {PO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Monto">
              <input className="input" type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </Field>
            <Field label="Moneda">
              <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {["CLP", "USD", "EUR", "UF"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Emisión">
              <input className="input" type="date" value={form.poDate} onChange={(e) => set("poDate", e.target.value)} />
            </Field>
            <Field label="Entrega">
              <input className="input" type="date" value={form.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
            </Field>
            <Field label="Ejecución">
              <input className="input" type="date" value={form.executionDate} onChange={(e) => set("executionDate", e.target.value)} />
            </Field>
          </div>

          <Field label="Notas">
            <textarea className="input min-h-[70px] resize-y" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          {!isNew && history.length > 0 && (
            <div>
              <p className="label">Historial de estados</p>
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <div key={h.id} className="text-xs text-ink-muted flex items-center gap-2">
                    <span className="text-ink-soft">{h.fromStatus || "—"} → <span className="font-medium text-ink">{h.toStatus}</span></span>
                    <span className="text-zinc-400">· {formatDate(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200/70">
          {!isNew ? (
            <button onClick={remove} className="btn-ghost text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
