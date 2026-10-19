"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

/** Select yang menyimpan nilainya di query string (?key=value), sehingga
 *  filter bisa dibagikan via URL dan data di-query ulang di server. */
export function ParamSelect({
  name,
  label,
  value,
  options,
  resetPage = false,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  resetPage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
        {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      </span>
      <select
        className="input-glass !py-2 text-sm"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(name, e.target.value);
          else next.delete(name);
          if (resetPage) next.delete("page");
          start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
