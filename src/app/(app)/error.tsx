"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="glass mx-auto mt-10 max-w-lg p-8 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-300" aria-hidden />
      <h1 className="mt-3 text-lg font-bold">Gagal memuat data</h1>
      <p className="mt-2 text-sm text-fg-muted">{error.message || "Terjadi kesalahan saat mengambil data dari database."}</p>
      <button onClick={reset} className="mt-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15">
        Coba lagi
      </button>
    </div>
  );
}
