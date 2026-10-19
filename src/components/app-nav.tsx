"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, LayoutDashboard, LogOut, Map, Menu, Table2, Workflow, X } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/provinsi", label: "Analisis Provinsi", icon: Map },
  { href: "/pipeline", label: "Data Pipeline ETL", icon: Workflow },
  { href: "/data", label: "Tabel Data", icon: Table2 },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-emerald-400 shadow-lg shadow-violet-900/40">
        <Compass className="size-[18px] text-white" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-tight">Nusantara Tourism Hub</span>
        <span className="block text-[11px] text-fg-muted">Data-level EAI</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-r from-violet-500/25 via-blue-500/15 to-transparent text-fg ring-1 ring-white/15"
                : "text-fg-muted hover:bg-white/6 hover:text-fg"
            }`}
          >
            <Icon className={`size-[18px] ${active ? "text-violet-300" : "text-fg-subtle group-hover:text-fg-muted"}`} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox({ name, email }: { name: string; email: string }) {
  const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "U";
  return (
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-[11px] text-fg-muted">{email}</p>
        </div>
      </div>
      <form action={logout} className="mt-3">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-fg-muted transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <LogOut className="size-3.5" aria-hidden /> Keluar
        </button>
      </form>
    </div>
  );
}

export function AppNav({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="glass-strong fixed inset-y-3 left-3 z-30 hidden w-64 flex-col justify-between rounded-3xl p-4 lg:flex">
        <div className="space-y-6">
          <div className="px-1 pt-1"><Brand /></div>
          <NavLinks />
        </div>
        <UserBox name={name} email={email} />
      </aside>

      {/* Topbar mobile */}
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between border-b border-white/10 px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-xl ring-1 ring-white/15 hover:bg-white/8"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col justify-between p-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Brand />
                <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu"
                        className="grid size-9 place-items-center rounded-xl ring-1 ring-white/15">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserBox name={name} email={email} />
          </div>
        </div>
      )}
    </>
  );
}
