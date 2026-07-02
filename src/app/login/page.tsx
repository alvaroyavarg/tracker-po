"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Clave incorrecta");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-canvas px-4">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="grid place-items-center h-12 w-12 rounded-2xl bg-accent text-white shadow-soft mb-3">
            <Boxes className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-ink">PO Tracker</h1>
          <p className="text-sm text-ink-muted mt-1">Ingresa la clave de acceso para continuar.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="password"
              className="input pl-9"
              placeholder="Clave de acceso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={busy || !password} className="btn-primary justify-center">
            {busy ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
