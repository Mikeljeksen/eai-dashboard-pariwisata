import { Compass } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-emerald-400 shadow-lg shadow-violet-900/40">
            <Compass className="size-5 text-white" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">Nusantara Tourism Hub</p>
            <p className="text-[11px] text-fg-muted">Data-level EAI · Pariwisata Indonesia</p>
          </div>
        </div>
        <div className="glass glass-edge p-6 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-5 text-center text-sm text-fg-muted">{footer}</p>
      </div>
    </main>
  );
}

export function Field({ label, name, type = "text", autoComplete, error, defaultValue, placeholder }: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const errId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-semibold text-fg-muted">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        className={`input-glass ${error ? "!border-rose-400/70" : ""}`}
      />
      {error && <p id={errId} className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
      {message}
    </div>
  );
}
