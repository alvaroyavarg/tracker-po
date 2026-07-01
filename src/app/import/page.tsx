"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { UploadCloud, FileSpreadsheet, ArrowRight, Check, X, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PO_FIELDS, PoFieldKey } from "@/lib/types";
import { autoMap, matchesOwner } from "@/lib/coerce";

type Step = "upload" | "map";

interface SheetData {
  headers: string[];
  rows: Record<string, any>[];
}

// Lee una hoja limpiando encabezados (espacios extra como " Open PO line value ").
function readSheet(ws: XLSX.WorkSheet): SheetData {
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  if (json.length === 0) return { headers: [], rows: [] };
  const keyMap: Record<string, string> = {};
  for (const k of Object.keys(json[0])) {
    const clean = k.replace(/\s+/g, " ").trim();
    if (clean && !clean.startsWith("__EMPTY")) keyMap[k] = clean;
  }
  const rows = json.map((r) => {
    const out: Record<string, any> = {};
    for (const [orig, clean] of Object.entries(keyMap)) out[clean] = r[orig];
    return out;
  });
  return { headers: Object.values(keyMap), rows };
}

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, PoFieldKey | "">>({});
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [ownerEnabled, setOwnerEnabled] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState("Alvaro Yavar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function pickSheet(wb: XLSX.WorkBook, name: string) {
    const data = readSheet(wb.Sheets[name]);
    if (data.rows.length === 0) {
      setError(`La hoja "${name}" está vacía o no tiene datos tabulares.`);
      return;
    }
    setError("");
    setSheetName(name);
    setHeaders(data.headers);
    setRawRows(data.rows);
    setMapping(autoMap(data.headers));
  }

  async function handleFile(file: File) {
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      // Elige por defecto la hoja con más filas de datos (la sábana real, no las dinámicas).
      let best = wb.SheetNames[0];
      let bestCount = -1;
      for (const name of wb.SheetNames) {
        const count = readSheet(wb.Sheets[name]).rows.length;
        if (count > bestCount) {
          best = name;
          bestCount = count;
        }
      }
      if (bestCount <= 0) {
        setError("El archivo no tiene filas de datos.");
        return;
      }
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setFileName(file.name);
      pickSheet(wb, best);
      setStep("map");
    } catch {
      setError("No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasPoNumber = mappedFields.has("poNumber");
  const ownerHeader = Object.entries(mapping).find(([, f]) => f === "owner")?.[0];
  const reqHeader = Object.entries(mapping).find(([, f]) => f === "requisitioner")?.[0];

  // Vista previa del filtro de dueño: cuántas filas pasan.
  const filterStats = useMemo(() => {
    const withPo = rawRows.filter((r) => {
      const poHeader = Object.entries(mapping).find(([, f]) => f === "poNumber")?.[0];
      return poHeader && String(r[poHeader] ?? "").trim() !== "";
    });
    if (!ownerEnabled || !ownerFilter.trim()) {
      return { total: rawRows.length, pass: withPo.length, applied: false };
    }
    const pass = withPo.filter((r) => {
      const target = [ownerHeader ? r[ownerHeader] : "", reqHeader ? r[reqHeader] : ""]
        .map((v) => String(v ?? ""))
        .join(" ");
      return matchesOwner(target, ownerFilter);
    }).length;
    return { total: rawRows.length, pass, applied: true };
  }, [rawRows, mapping, ownerEnabled, ownerFilter, ownerHeader, reqHeader]);

  const noOwnerColumn = !ownerHeader && !reqHeader;

  async function doImport() {
    if (!hasPoNumber) {
      setError("Debes mapear al menos la columna del N° de PO.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const rows = rawRows.map((r) => {
        const out: Record<string, any> = {};
        for (const [header, field] of Object.entries(mapping)) {
          if (field) out[field] = r[header];
        }
        return out;
      });
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          raw: rawRows,
          mode,
          ownerFilter: ownerEnabled ? ownerFilter.trim() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al importar.");
        return;
      }
      router.push("/pos");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <PageHeader
        title="Cargar sábana"
        subtitle="Sube tu Excel o CSV. Se detectan las columnas útiles, se ignora el resto y se filtra lo que no te pertenece."
      />

      <div className="flex items-center gap-3 mb-6 text-sm">
        <StepPill n={1} label="Subir archivo" active={step === "upload"} done={step === "map"} />
        <div className="h-px w-8 bg-zinc-200" />
        <StepPill n={2} label="Mapear y filtrar" active={step === "map"} done={false} />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <X className="h-4 w-4" /> {error}
        </div>
      )}

      {step === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`card p-12 flex flex-col items-center justify-center text-center gap-4 cursor-pointer border-2 border-dashed transition-colors ${
            dragOver ? "border-accent bg-accent-soft/40" : "border-zinc-200"
          }`}
        >
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-accent-soft text-accent">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div>
            <p className="font-medium text-ink">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="text-sm text-ink-muted mt-1">Formatos soportados: .xlsx, .xls, .csv</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-5">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-ink">{fileName}</p>
                <p className="text-xs text-ink-muted">
                  {rawRows.length} filas · {headers.length} columnas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sheetNames.length > 1 && (
                <select
                  className="input w-auto"
                  value={sheetName}
                  onChange={(e) => workbook && pickSheet(workbook, e.target.value)}
                >
                  {sheetNames.map((n) => (
                    <option key={n} value={n}>Hoja: {n}</option>
                  ))}
                </select>
              )}
              <button
                className="btn-outline"
                onClick={() => {
                  setStep("upload");
                  setHeaders([]);
                  setRawRows([]);
                  setWorkbook(null);
                }}
              >
                Cambiar archivo
              </button>
            </div>
          </div>

          {/* Filtro de dueño */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">Filtro de dueño</h3>
            </div>
            <p className="text-xs text-ink-muted mb-3">
              Conserva solo las filas cuyo responsable calce con tu nombre y descarta el resto.
              El matching ignora puntos, mayúsculas y dominios (“Alvaro Yavar” calza con “Alvaro.Yavar@diageo.com”).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerEnabled}
                  onChange={(e) => setOwnerEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-accent focus:ring-accent/30"
                />
                Activar filtro
              </label>
              <input
                className="input w-56"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                disabled={!ownerEnabled}
                placeholder="Nombre a filtrar"
              />
              {filterStats.applied ? (
                <span
                  className={`badge ring-1 ${
                    filterStats.pass > 0
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      : "bg-rose-50 text-rose-700 ring-rose-600/20"
                  }`}
                >
                  {filterStats.pass} de {filterStats.total} filas pasan el filtro
                </span>
              ) : (
                <span className="badge bg-zinc-100 text-zinc-600 ring-zinc-500/20">
                  Sin filtro: se importan {filterStats.pass} filas
                </span>
              )}
            </div>
            {ownerEnabled && noOwnerColumn && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                Ninguna columna está mapeada como “Responsable / Dueño” ni “Requisitioner”; con el
                filtro activo no pasará ninguna fila. Mapea la columna del dueño o desactiva el filtro
                (ej: si tu archivo ya viene recortado solo con lo tuyo).
              </p>
            )}
          </div>

          {/* Mapeo */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink mb-1">Mapeo de columnas</h3>
            <p className="text-xs text-ink-muted mb-4">
              Las columnas en “— Ignorar —” no se importan (así la sábana puede venir con columnas
              de más). El <span className="font-medium">N° PO</span> es obligatorio.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate" title={h}>{h}</div>
                    <div className="text-[11px] text-ink-muted truncate">
                      Ej: {String(rawRows[0]?.[h] ?? "").slice(0, 30) || "—"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-300 shrink-0" />
                  <select
                    className="input w-48"
                    value={mapping[h] || ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [h]: e.target.value as PoFieldKey | "" }))
                    }
                  >
                    <option value="">— Ignorar —</option>
                    {PO_FIELDS.map((f) => (
                      <option
                        key={f.key}
                        value={f.key}
                        disabled={mappedFields.has(f.key) && mapping[h] !== f.key}
                      >
                        {f.label}{f.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card p-5 overflow-hidden">
            <h3 className="text-sm font-semibold text-ink mb-3">Vista previa (primeras 5 filas)</h3>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="text-xs border-separate border-spacing-0">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="text-left font-medium pb-2 px-2 whitespace-nowrap">
                        {mapping[h] ? (
                          <span className="text-accent">{PO_FIELDS.find((f) => f.key === mapping[h])?.label}</span>
                        ) : (
                          <span className="text-zinc-400 line-through">{h}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td
                          key={h}
                          className={`border-t border-zinc-100 py-1.5 px-2 whitespace-nowrap max-w-[160px] truncate ${
                            mapping[h] ? "text-ink-soft" : "text-zinc-300"
                          }`}
                        >
                          {String(r[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modo + acción */}
          <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="label">Modo de importación</p>
              <div className="flex gap-2">
                <ModeBtn active={mode === "append"} onClick={() => setMode("append")} label="Agregar" hint="Suma a lo existente" />
                <ModeBtn active={mode === "replace"} onClick={() => setMode("replace")} label="Reemplazar" hint="Borra todo y carga de nuevo" />
              </div>
            </div>
            <button
              onClick={doImport}
              disabled={busy || !hasPoNumber || filterStats.pass === 0}
              className="btn-primary"
            >
              <Check className="h-4 w-4" />
              {busy ? "Importando…" : `Importar ${filterStats.pass} filas`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid place-items-center h-6 w-6 rounded-full text-xs font-semibold ${
          done ? "bg-emerald-500 text-white" : active ? "bg-accent text-white" : "bg-zinc-200 text-ink-muted"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={active || done ? "text-ink font-medium" : "text-ink-muted"}>{label}</span>
    </div>
  );
}

function ModeBtn({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-2 transition-colors ${
        active ? "border-accent bg-accent-soft" : "border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <div className={`text-sm font-medium ${active ? "text-accent" : "text-ink"}`}>{label}</div>
      <div className="text-[11px] text-ink-muted">{hint}</div>
    </button>
  );
}
