import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function GlassCard({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`glass glass-edge p-5 sm:p-6 ${className}`}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12">
            <Icon className="size-4 text-violet-300" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-fg">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/90">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-white/6 ring-1 ring-white/12">
        <Inbox className="size-5 text-fg-subtle" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-fg-muted">{message}</p>
    </div>
  );
}

export function Badge({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "blue" | "green" | "amber" | "slate" }) {
  const tones = {
    violet: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    blue: "bg-blue-500/15 text-blue-200 ring-blue-400/30",
    green: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    amber: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    slate: "bg-white/8 text-fg-muted ring-white/15",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}
