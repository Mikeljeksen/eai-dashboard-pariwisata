import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  icon: Icon,
  accent,
  footnote,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: number | null;
  deltaLabel: string;
  icon: LucideIcon;
  accent: "violet" | "blue" | "green" | "cyan";
  footnote?: string;
}) {
  const ring = {
    violet: "from-violet-500/40 to-violet-500/0 text-violet-200",
    blue: "from-blue-500/40 to-blue-500/0 text-blue-200",
    green: "from-emerald-500/40 to-emerald-500/0 text-emerald-200",
    cyan: "from-cyan-500/40 to-cyan-500/0 text-cyan-200",
  }[accent];
  const up = delta != null && delta > 0.05;
  const down = delta != null && delta < -0.05;
  const DeltaIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;

  return (
    <article className="glass glass-edge flex flex-col justify-between gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-snug text-fg-muted">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10 ${ring}`}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-[2rem] font-extrabold leading-none tracking-tight text-fg sm:text-[2.25rem]">
          {value}
          {unit && <span className="ml-1 text-base font-semibold text-fg-muted">{unit}</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ring-1 ${
              up ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                : down ? "bg-rose-500/15 text-rose-200 ring-rose-400/30"
                : "bg-white/8 text-fg-muted ring-white/15"
            }`}
          >
            <DeltaIcon className="size-3.5" aria-hidden />
            {delta == null ? "n/a" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("id-ID", { maximumFractionDigits: 1 })}`}
          </span>
          <span className="text-fg-subtle">{deltaLabel}</span>
        </div>
        {footnote && <p className="mt-2 text-[11px] leading-snug text-fg-subtle">{footnote}</p>}
      </div>
    </article>
  );
}
