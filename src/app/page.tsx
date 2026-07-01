"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { TrendingUp, Wallet, ListChecks, Building2, Upload } from "lucide-react";
import { PageHeader, EmptyState, Spinner } from "@/components/ui";
import { formatMoney, formatNumber, monthLabel } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/types";

interface DashboardData {
  totals: { count: number; totalAmount: number; currency: string };
  byStatus: { status: string; count: number; amount: number }[];
  byVendor: { vendor: string; count: number; amount: number }[];
  byIO: { io: string; count: number; amount: number }[];
  forecast: {
    months: string[];
    ios: string[];
    matrix: Record<string, Record<string, number>>;
    totalsByMonth: Record<string, number>;
  };
}

const PIE_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b", "#ef4444"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <Spinner label="Cargando dashboard…" />
      </div>
    );
  }

  const empty = !data || data.totals.count === 0;
  const currency = data?.totals.currency || "CLP";

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle="Vista general de tus Purchase Orders y proyección de ejecución."
      />

      {empty ? (
        <EmptyState
          icon={<Upload className="h-10 w-10" />}
          title="Aún no hay Purchase Orders"
          hint="Carga tu sábana en Excel o CSV para empezar a ver totales, estados y el forecast por IO."
          action={
            <Link href="/import" className="btn-primary">
              <Upload className="h-4 w-4" /> Cargar sábana
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<ListChecks className="h-5 w-5" />}
              label="Total PO"
              value={formatNumber(data!.totals.count)}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Monto total"
              value={formatMoney(data!.totals.totalAmount, currency)}
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="IOs activos"
              value={formatNumber(data!.byIO.filter((i) => i.io !== "Sin IO").length)}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Meses en forecast"
              value={formatNumber(data!.forecast.months.length)}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-ink mb-4">Monto por IO</h3>
              {data!.byIO.length === 0 ? (
                <p className="text-sm text-ink-muted">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data!.byIO.slice(0, 10)} margin={{ left: 10, right: 10 }}>
                    <XAxis dataKey="io" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#a1a1aa"
                      tickFormatter={(v) => compact(v, currency)}
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: number) => formatMoney(v, currency)}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink mb-4">PO por estado</h3>
              {data!.byStatus.length === 0 ? (
                <p className="text-sm text-ink-muted">Sin datos.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data!.byStatus}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {data!.byStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-3">
                    {data!.byStatus.map((s, i) => (
                      <div key={s.status} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-ink-soft">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          {s.status}
                        </span>
                        <span className="text-ink-muted">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Forecast mensual por IO */}
          <ForecastTable forecast={data!.forecast} currency={currency} />

          {/* Top proveedores */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Top proveedores por monto</h3>
            <div className="flex flex-col gap-2">
              {data!.byVendor.map((v) => {
                const max = data!.byVendor[0]?.amount || 1;
                const pct = Math.max(4, (v.amount / max) * 100);
                return (
                  <div key={v.vendor} className="flex items-center gap-3">
                    <span className="w-40 truncate text-sm text-ink-soft" title={v.vendor}>
                      {v.vendor}
                    </span>
                    <div className="flex-1 h-6 rounded-lg bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-lg bg-accent/80 flex items-center justify-end pr-2"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-32 text-right text-sm tabular-nums text-ink">
                      {formatMoney(v.amount, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-muted mb-3">
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-accent-soft text-accent">
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-ink">{value}</div>
    </div>
  );
}

function ForecastTable({
  forecast,
  currency,
}: {
  forecast: DashboardData["forecast"];
  currency: string;
}) {
  if (forecast.months.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink mb-2">Forecast de ejecución mensual por IO</h3>
        <p className="text-sm text-ink-muted">
          Asigna un <span className="font-medium">Mes de ejecución</span> (o fecha de emisión) a tus
          PO para ver la proyección mensual acá.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 overflow-hidden">
      <h3 className="text-sm font-semibold text-ink mb-1">Forecast de ejecución mensual por IO</h3>
      <p className="text-xs text-ink-muted mb-4">
        Proyección de ejecución agrupada por Internal Order y mes.
      </p>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white text-left font-medium text-ink-muted pb-2 pr-4 min-w-[120px]">
                IO
              </th>
              {forecast.months.map((m) => (
                <th key={m} className="text-right font-medium text-ink-muted pb-2 px-3 whitespace-nowrap">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="text-right font-medium text-ink pb-2 pl-3 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {forecast.ios.map((io) => {
              const row = forecast.matrix[io] || {};
              const total = forecast.months.reduce((s, m) => s + (row[m] || 0), 0);
              return (
                <tr key={io} className="group">
                  <td className="sticky left-0 bg-white group-hover:bg-zinc-50 border-t border-zinc-100 py-2 pr-4 font-medium text-ink">
                    {io}
                  </td>
                  {forecast.months.map((m) => (
                    <td
                      key={m}
                      className="border-t border-zinc-100 py-2 px-3 text-right tabular-nums text-ink-soft group-hover:bg-zinc-50"
                    >
                      {row[m] ? compact(row[m], currency) : <span className="text-zinc-300">—</span>}
                    </td>
                  ))}
                  <td className="border-t border-zinc-100 py-2 pl-3 text-right tabular-nums font-semibold text-ink group-hover:bg-zinc-50">
                    {compact(total, currency)}
                  </td>
                </tr>
              );
            })}
            {/* Fila de totales */}
            <tr>
              <td className="sticky left-0 bg-zinc-50 border-t-2 border-zinc-200 py-2 pr-4 font-semibold text-ink">
                Total mes
              </td>
              {forecast.months.map((m) => (
                <td
                  key={m}
                  className="bg-zinc-50 border-t-2 border-zinc-200 py-2 px-3 text-right tabular-nums font-semibold text-ink"
                >
                  {compact(forecast.totalsByMonth[m] || 0, currency)}
                </td>
              ))}
              <td className="bg-zinc-50 border-t-2 border-zinc-200 py-2 pl-3 text-right tabular-nums font-bold text-accent">
                {compact(
                  Object.values(forecast.totalsByMonth).reduce((s, v) => s + v, 0),
                  currency
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

// Formato compacto para celdas densas (ej: $1,2 M).
function compact(v: number, currency: string): string {
  const abs = Math.abs(v);
  const sym = currency === "USD" ? "US$" : currency === "CLP" ? "$" : "";
  if (abs >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}K`;
  return `${sym}${v.toFixed(0)}`;
}
