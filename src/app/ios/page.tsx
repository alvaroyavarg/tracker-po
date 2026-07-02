"use client";

import { useEffect, useState, useCallback } from "react";
import { Tags, UserCheck, Building2 } from "lucide-react";
import { PageHeader, EmptyState, Spinner } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/format";

interface IoInfo {
  io: string;
  managed: boolean;
  area: string | null;
  lineCount: number;
  committed: number;
  open: number;
}

export default function IosPage() {
  const [ios, setIos] = useState<IoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIo, setSavingIo] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/ios")
      .then((r) => r.json())
      .then((d) => setIos(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function patch(io: string, body: { managed?: boolean; area?: string | null }) {
    setSavingIo(io);
    try {
      await fetch("/api/ios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ io, ...body }),
      });
      setIos((prev) =>
        prev.map((x) =>
          x.io === io
            ? { ...x, managed: body.managed ?? x.managed, area: body.area !== undefined ? body.area : x.area }
            : x
        )
      );
    } finally {
      setSavingIo(null);
    }
  }

  const mine = ios.filter((x) => x.managed);
  const others = ios.filter((x) => !x.managed);

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <PageHeader
        title="IOs y áreas"
        subtitle="Define qué Internal Orders son de tu gestión. Solo esos entran al forecast y a los KPIs del dashboard (en modo Mi gestión); el resto sigue visible en el tracker."
      />

      {loading ? (
        <div className="card p-8"><Spinner label="Cargando IOs…" /></div>
      ) : ios.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-10 w-10" />}
          title="Aún no hay IOs"
          hint="Los IOs aparecen acá automáticamente cuando cargas tu sábana."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Section
            icon={<UserCheck className="h-4 w-4" />}
            title={`Mi gestión (${mine.length})`}
            hint="Estos IOs alimentan el forecast y los totales del dashboard."
            ios={mine}
            savingIo={savingIo}
            onPatch={patch}
          />
          <Section
            icon={<Building2 className="h-4 w-4" />}
            title={`Otras áreas (${others.length})`}
            hint="Visibles en el tracker, pero fuera del forecast. Asigna el área para identificarlos (MKT, TS…)."
            ios={others}
            savingIo={savingIo}
            onPatch={patch}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  ios,
  savingIo,
  onPatch,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  ios: IoInfo[];
  savingIo: string | null;
  onPatch: (io: string, body: { managed?: boolean; area?: string | null }) => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1 text-ink">
        <span className="text-accent">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-ink-muted mb-4">{hint}</p>
      {ios.length === 0 ? (
        <p className="text-sm text-ink-muted">Ningún IO en esta categoría.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-zinc-200/70">
                <th className="py-2 pr-4 font-medium">IO</th>
                <th className="py-2 px-4 font-medium">Área</th>
                <th className="py-2 px-4 font-medium text-right">Líneas</th>
                <th className="py-2 px-4 font-medium text-right">Comprometido</th>
                <th className="py-2 px-4 font-medium text-right">Abierto</th>
                <th className="py-2 pl-4 font-medium text-center">Mi gestión</th>
              </tr>
            </thead>
            <tbody>
              {ios.map((x) => (
                <tr key={x.io} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-ink whitespace-nowrap">{x.io}</td>
                  <td className="py-2.5 px-4">
                    <input
                      className="input !py-1 !px-2 w-24 text-xs"
                      placeholder="MKT, TS…"
                      defaultValue={x.area || ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (x.area || "")) onPatch(x.io, { area: v || null });
                      }}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-ink-muted">
                    {formatNumber(x.lineCount)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-ink whitespace-nowrap">
                    {formatMoney(x.committed)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-amber-700 whitespace-nowrap">
                    {formatMoney(x.open)}
                  </td>
                  <td className="py-2.5 pl-4 text-center">
                    <button
                      onClick={() => onPatch(x.io, { managed: !x.managed })}
                      disabled={savingIo === x.io}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        x.managed ? "bg-accent" : "bg-zinc-200"
                      }`}
                      title={x.managed ? "Quitar de mi gestión" : "Marcar como mi gestión"}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          x.managed ? "translate-x-4.5 ml-0.5 translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
