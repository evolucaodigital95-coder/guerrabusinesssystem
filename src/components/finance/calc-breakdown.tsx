import { useState, type ReactNode } from "react";
import { Calculator } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/crm";
import { cn } from "@/lib/utils";
import type { CalcLine } from "@/lib/finance-engine";

/**
 * "Ver cálculo" — exibe o passo-a-passo de qualquer valor financeiro.
 * Use junto a qualquer número derivado do motor financeiro.
 */
export function CalcBreakdown({
  title,
  subtitle,
  lines,
  trigger,
  footer,
}: {
  title: string;
  subtitle?: string;
  lines: CalcLine[];
  trigger?: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            <Calculator className="mr-1.5 h-3 w-3" /> Ver cálculo
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] rounded-2xl border border-border bg-card/95 p-0 shadow-xl backdrop-blur"
      >
        <div className="border-b border-border/70 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Memória de cálculo
          </p>
          <h4 className="mt-1 font-serif text-lg text-foreground">{title}</h4>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <ol className="divide-y divide-border/60 px-5 py-3 text-sm">
          {lines.map((l, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start justify-between gap-3 py-2",
                l.kind === "subtotal" &&
                  "mt-1 border-t border-border/80 pt-3 font-medium text-foreground",
                l.kind === "split" && "text-foreground",
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate",
                    l.kind === "in" && "text-foreground",
                    l.kind === "out" && "text-muted-foreground",
                  )}
                >
                  {l.label}
                </p>
                {l.hint && (
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
                    {l.hint}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  l.kind === "in" && "text-emerald-600",
                  l.kind === "out" && "text-rose-600",
                  l.kind === "subtotal" && "text-foreground",
                  l.kind === "split" && "text-gold-ink",
                )}
              >
                {l.amount >= 0 ? "" : "−"}
                {formatCurrency(Math.abs(l.amount))}
              </span>
            </li>
          ))}
        </ol>
        {footer && (
          <div className="border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground">
            {footer}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
