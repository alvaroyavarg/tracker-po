"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Trash2, Save, Receipt, CircleDot, PackageX, PlusCircle, RefreshCw } from "lucide-react";
import { PO_STATUSES, PoLineDTO } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";

interface Props {
  po: PoLineDTO | null; // null => nueva línea
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  poNumber: "",
  poLine: "",
  io: "",
  vendor: "",
  description: "",
  glAccount: "",
  glDescription: "",
  totalPoValue: "",
  lineValue: "",
  invoicedAmount: "",
  openAmount: "",
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
  const [events, setEvents] = useState<any[]>([]);
  const [invAmount, setInvAmount] = useState("");
  const [invNote, setInvNote] = useState("");
  const [invBusy, setInvBusy] = useState(false);
  const isNew = !po;

  const loadDetail = useCallback(() => {
    if (!po) return;
    fetch(`/api/pos/${po.id}`)
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.data?.history || []);
        setEvents(d.data?.events || []);
        if (d.data) {
          setForm((f) => ({
            ...f,
            invoicedAmount: String(d.data.invoicedAmount ?? ""),
            openAmount: String(d.data.openAmount ?? ""),
            status: d.data.status || f.status,
          }));
        }
      })
      .catch(() => {});
  }, [po]);

  useEffect(() => {
    if (po) {
      setForm({
        poNumber: po.poNumber || "",
        poLine: po.poLine || "",
        io: po.io || "",
        vendor: po.vendor || "",
        description: po.description || "",
        glAccount: po.glAccount || "",
        glDescription: po.glDescription || "",
        totalPoValue: String(po.totalPoValue ?? ""),
        lineValue: String(po.lineValue ?? ""),
        invoicedAmount: String(po.invoicedAmount ?? ""),
        openAmount: String(po.openAmount ?? ""),
        currency: po.currency || "CLP",
        status: po.status || "Pendiente",
        poDate: toInputDate(po.poDate),
        deliveryDate: toInputDate(po.deliveryDate),
        executionDate: toInputDate(po.executionDate),
        notes: po.notes || "",
      });
      loadDetail();
    } else {
      setForm(emptyForm);
      setHistory([]);
      setEvents([]);
    }
    setInvAmount("");
    setInvNote("");
  }, [po, open, loadDetail]);

  async function registerInvoice() {
    if (!po) return;
    const amount = parseFloat(invAmount);
    if (!amount) {
      alert("Indica el monto facturado (puede ser negativo para corregir)");
      return;
    }
    setInvBusy(true);
    try {
      const res = await fetch(`/api/pos/${po.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: invNote.trim() || undefined }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Error al registrar");
        return;
      }
      setInvAmount("");
      setInvNote("");
      loadDetail();
      onSaved();
    } finally {
      setInvBusy(false);
    }
  }

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
    if (!confirm(`¿Eliminar la línea ${po.poLine || ""} de la PO ${po.poNumber}?`)) return;
    await fetch(`/api/pos/${po.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  if (!open) return null;

  const lineVal = parseFloat(form.lineValue) || 0;
  const invoiced = parseFloat(form.invoicedAmount) || 0;
  const pct = lineVal > 0 ? Math.min(100, (invoiced / lineVal) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-lift flex flex-col animate-[slideIn_.2s_ease-out]">
        <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/70">
          <div>
            <h2 className="font-semibold text-ink">
              {isNew ? "Nueva línea de PO" : `PO ${po!.poNumber}${po!.poLine ? ` · línea ${po!.poLine}` : ""}`}
            </h2>
            {!isNew && po!.io && <p className="text-xs text-accent font-medium mt-0.5">{po!.io}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {!isNew && (
            <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3">
              <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
                <span>Ejecución de la línea</span>
                <span className="tabular-nums">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-ink-muted mt-1.5">
                <span>Fact. {formatMoney(invoiced, form.currency)}</span>
                <span>Abierto {formatMoney(parseFloat(form.openAmount) || 0, form.currency)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="N° PO *">
              <input className="input" value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
            </Field>
            <Field label="N° línea">
              <input className="input" value={form.poLine} onChange={(e) => set("poLine", e.target.value)} />
            </Field>
            <Field label="IO">
              <input className="input" value={form.io} onChange={(e) => set("io", e.target.value)} />
            </Field>
            <Field label="Proveedor">
              <input className="input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
            </Field>
          </div>

          <Field label="Descripción">
            <input className="input" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuenta G/L">
              <input className="input" value={form.glAccount} onChange={(e) => set("glAccount", e.target.value)} />
            </Field>
            <Field label="Descripción G/L">
              <input className="input" value={form.glDescription} onChange={(e) => set("glDescription", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total PO">
              <input className="input" type="number" value={form.totalPoValue} onChange={(e) => set("totalPoValue", e.target.value)} />
            </Field>
            <Field label="Valor línea">
              <input className="input" type="number" value={form.lineValue} onChange={(e) => set("lineValue", e.target.value)} />
            </Field>
            <Field label="Facturado">
              <input className="input" type="number" value={form.invoicedAmount} onChange={(e) => set("invoicedAmount", e.target.value)} />
            </Field>
            <Field label="Saldo abierto">
              <input className="input" type="number" value={form.openAmount} onChange={(e) => set("openAmount", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado">
              <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {PO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
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
            <Field label="Creación">
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

          {!isNew && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-ink">Registrar facturación</p>
              </div>
              <p className="text-[11px] text-ink-muted mb-3">
                Suma al facturado y descuenta del saldo abierto. Queda registrado en la
                actividad de la línea. Usa monto negativo para corregir.
              </p>
              <div className="flex gap-2">
                <input
                  className="input w-36"
                  type="number"
                  placeholder="Monto"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                />
                <input
                  className="input flex-1"
                  placeholder="Nota (opcional): factura, HES…"
                  value={invNote}
                  onChange={(e) => setInvNote(e.target.value)}
                />
                <button onClick={registerInvoice} disabled={invBusy} className="btn-primary shrink-0 !bg-emerald-600 hover:!bg-emerald-700">
                  {invBusy ? "…" : "Registrar"}
                </button>
              </div>
            </div>
          )}

          {!isNew && (events.length > 0 || history.length > 0) && (
            <div>
              <p className="label">Actividad</p>
              <div className="flex flex-col gap-2.5">
                <ActivityTimeline events={events} history={history} currency={form.currency} />
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

// Fusiona eventos de facturación y cambios de estado en una sola línea de tiempo.
function ActivityTimeline({
  events,
  history,
  currency,
}: {
  events: any[];
  history: any[];
  currency: string;
}) {
  const items = [
    ...events.map((e) => ({ ...e, kind: "event" })),
    ...history.map((h) => ({ ...h, kind: "status" })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (items.length === 0) return null;

  return (
    <>
      {items.map((it) => {
        if (it.kind === "status") {
          return (
            <div key={`s-${it.id}`} className="flex items-start gap-2.5 text-xs">
              <CircleDot className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-ink-soft">
                  Estado: {it.fromStatus || "—"} → <span className="font-medium text-ink">{it.toStatus}</span>
                </span>
                {it.note && <span className="text-ink-muted"> · {it.note}</span>}
                <div className="text-[10px] text-zinc-400">{formatDate(it.createdAt)}</div>
              </div>
            </div>
          );
        }
        const cfg: Record<string, { icon: any; cls: string; label: (e: any) => string }> = {
          manual_invoice: {
            icon: Receipt,
            cls: "text-emerald-600",
            label: (e) => `Facturación manual: ${formatMoney(e.amount || 0, currency)}`,
          },
          invoice_progress: {
            icon: RefreshCw,
            cls: "text-emerald-600",
            label: (e) => `Sábana: se facturó ${formatMoney(e.amount || 0, currency)}`,
          },
          closed_absent: {
            icon: PackageX,
            cls: "text-zinc-500",
            label: () => "Cerrada: no vino en la sábana semanal (facturada completa)",
          },
          created: {
            icon: PlusCircle,
            cls: "text-accent",
            label: () => "Línea creada desde la sábana",
          },
          amounts_updated: {
            icon: RefreshCw,
            cls: "text-zinc-500",
            label: () => "Montos actualizados desde la sábana",
          },
        };
        const c = cfg[it.type] || cfg.amounts_updated;
        const Icon = c.icon;
        return (
          <div key={`e-${it.id}`} className="flex items-start gap-2.5 text-xs">
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c.cls}`} />
            <div>
              <span className="text-ink-soft">{c.label(it)}</span>
              {it.note && it.type === "manual_invoice" && (
                <span className="text-ink-muted"> · {it.note}</span>
              )}
              {it.prevValue != null && it.newValue != null && it.type !== "created" && (
                <span className="text-ink-muted">
                  {" "}
                  ({formatMoney(it.prevValue, currency)} → {formatMoney(it.newValue, currency)})
                </span>
              )}
              <div className="text-[10px] text-zinc-400">{formatDate(it.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
