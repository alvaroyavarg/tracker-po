"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Table2,
  Upload,
  History,
  Boxes,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos?fy=F26", label: "Purchase Orders F26", icon: Table2 },
  { href: "/pos?fy=F27", label: "Purchase Orders F27", icon: Table2 },
  { href: "/import", label: "Cargar sábana", icon: Upload },
  { href: "/snapshots", label: "Respaldos", icon: History },
];

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/login") return null;

  function isActive(href: string): boolean {
    const [path, query] = href.split("?");
    if (path === "/") return pathname === "/";
    if (!pathname.startsWith(path)) return false;
    if (!query) return true;
    // Distinguir F26 de F27 por el parámetro fy.
    const fy = new URLSearchParams(query).get("fy");
    return searchParams.get("fy") === fy;
  }

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200/70 bg-white/60 backdrop-blur-sm px-4 py-6 flex flex-col gap-8 sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-2">
        <div className="grid place-items-center h-9 w-9 rounded-xl bg-accent text-white shadow-soft">
          <Boxes className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink leading-tight">PO Tracker</div>
          <div className="text-[11px] text-ink-muted">Purchase Orders</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-soft hover:bg-zinc-100"
              )}
            >
              <Icon className={clsx("h-[18px] w-[18px]", active ? "text-accent" : "text-ink-muted")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3">
        <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3">
          <p className="text-[11px] leading-relaxed text-ink-muted">
            F26: creadas 01/07/2025 – 30/06/2026.<br />
            F27: creadas 01/07/2026 – 30/06/2027.
          </p>
        </div>
      </div>
    </aside>
  );
}
