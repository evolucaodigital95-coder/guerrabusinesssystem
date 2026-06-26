import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton padr\u00e3o para listagens (cards/linhas) durante o carregamento inicial.
 * Substitui textos "Carregando\u2026" por blocos animados consistentes com o resto do app.
 */
export function ListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className ?? "overflow-hidden rounded-2xl border border-border bg-card"}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-3 w-20 sm:block" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}
