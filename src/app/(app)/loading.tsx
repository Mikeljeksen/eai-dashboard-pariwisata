import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-80 max-w-full" />
      <Skeleton className="mt-3 h-4 w-[32rem] max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-6 h-9 w-28" /><Skeleton className="mt-3 h-4 w-24" /></div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="glass p-6 xl:col-span-2"><Skeleton className="h-5 w-56" /><Skeleton className="mt-5 h-72 w-full" /></div>
        <div className="glass p-6"><Skeleton className="h-5 w-40" /><Skeleton className="mt-5 h-72 w-full" /></div>
      </div>
    </div>
  );
}
