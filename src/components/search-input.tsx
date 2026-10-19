"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

export function SearchInput({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Cari</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Provinsi, pintu masuk, metrik, periode…"
          className="input-glass !py-2 !pl-9 !pr-9 text-sm"
          aria-label="Cari data"
        />
        {pending ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-subtle" aria-hidden />
        ) : value ? (
          <button type="button" onClick={() => setValue("")} aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-subtle hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </label>
  );
}
