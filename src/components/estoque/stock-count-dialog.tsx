import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BRL, NUM } from "@/lib/format";
import { cn } from "@/lib/utils";

type CountItem = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  average_cost?: number | null;
  purchase_price?: number | null;
};

const DRAFT_KEY = (org: string) => `gbs-inventario-${org}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Inventário (conferência física): a pessoa informa quanto existe de fato,
 * o sistema compara com o saldo e grava um "Ajuste" para cada diferença —
 * com motivo, data e autor, preservando o histórico.
 */
export function StockCountDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  items,
  onHandById,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  items: CountItem[];
  onHandById: Map<string, number>;
}) {
  const qc = useQueryClient();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [notes, setNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Rascunho salvo no navegador: uma contagem longa não se perde se a janela fechar.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY(organizationId));
      if (raw) setCounts(JSON.parse(raw));
    } catch {
      /* rascunho indisponível */
    }
    setReviewing(false);
  }, [open, organizationId]);
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(DRAFT_KEY(organizationId), JSON.stringify(counts));
    } catch {
      /* armazenamento indisponível */
    }
  }, [counts, open, organizationId]);

  const rows = useMemo(() => {
    return items.map((it) => {
      const system = onHandById.get(it.id) ?? 0;
      const raw = counts[it.id];
      const counted = raw === undefined || raw === "" ? null : Number(raw.replace(",", "."));
      const diff = counted === null || Number.isNaN(counted) ? null : counted - system;
      const cost = Number(it.average_cost ?? it.purchase_price ?? 0);
      return { it, system, counted, diff, value: diff ? diff * cost : 0 };
    });
  }, [items, onHandById, counts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || `${r.it.name} ${r.it.category ?? ""}`.toLowerCase().includes(q)) &&
        (!onlyDiff || (r.diff !== null && r.diff !== 0)),
    );
  }, [rows, search, onlyDiff]);

  const counted = rows.filter((r) => r.counted !== null);
  const adjustments = rows.filter((r) => r.diff !== null && r.diff !== 0);
  const invalid = rows.some(
    (r) => r.counted !== null && (Number.isNaN(r.counted) || r.counted < 0),
  );
  const lossValue = adjustments.filter((r) => r.value < 0).reduce((s, r) => s + r.value, 0);
  const gainValue = adjustments.filter((r) => r.value > 0).reduce((s, r) => s + r.value, 0);

  const save = useMutation({
    mutationFn: async () => {
      if (adjustments.length === 0) throw new Error("Nenhuma diferença para ajustar.");
      const day = today();
      const label = new Date().toLocaleDateString("pt-BR");
      const payload = adjustments.map((r) => ({
        organization_id: organizationId,
        stock_item_id: r.it.id,
        kind: "ajuste",
        direction: "in",
        status: "utilizado",
        quantity: r.diff!,
        occurs_on: day,
        occurs_at: new Date().toISOString(),
        reason: `Inventário físico ${label}: sistema ${NUM.format(r.system)}, contado ${NUM.format(r.counted!)}`,
        notes: notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      }));
      const { error } = await supabase.from("stock_movements").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(
        `Inventário registrado: ${n} ajuste${n > 1 ? "s" : ""} gravado${n > 1 ? "s" : ""}.`,
      );
      try {
        localStorage.removeItem(DRAFT_KEY(organizationId));
      } catch {
        /* nada a limpar */
      }
      setCounts({});
      setNotes("");
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      qc.invalidateQueries({ queryKey: ["stock-health"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar inventário"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <ClipboardCheck className="h-5 w-5 text-clay" /> Inventário
          </DialogTitle>
          <DialogDescription>
            Conte o que existe de fato e digite a quantidade. Só os itens com diferença geram
            ajuste. A contagem fica salva neste navegador até você registrar.
          </DialogDescription>
        </DialogHeader>

        {!reviewing ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar material…"
                  className="pl-9"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyDiff}
                  onChange={(e) => setOnlyDiff(e.target.checked)}
                  className="accent-[var(--clay)]"
                />
                Só diferenças
              </label>
            </div>

            <div className="max-h-[48vh] overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">No sistema</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">Contado</th>
                    <th className="px-3 py-2 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.it.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.it.name}</div>
                        {r.it.category && (
                          <div className="text-[11px] text-muted-foreground">{r.it.category}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {NUM.format(r.system)} {r.it.unit ?? "un"}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          inputMode="decimal"
                          value={counts[r.it.id] ?? ""}
                          onChange={(e) => setCounts((c) => ({ ...c, [r.it.id]: e.target.value }))}
                          placeholder="—"
                          className="h-8 text-right"
                        />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          r.diff === null || r.diff === 0
                            ? "text-muted-foreground"
                            : r.diff < 0
                              ? "text-destructive"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {r.diff === null
                          ? ""
                          : r.diff === 0
                            ? "ok"
                            : `${r.diff > 0 ? "+" : ""}${NUM.format(r.diff)}`}
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum material encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {counted.length} de {items.length} contados · {adjustments.length} com diferença
              </span>
              {invalid && <span className="text-destructive">Há quantidades inválidas.</span>}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Continuar depois
              </Button>
              <Button
                variant="brand"
                disabled={adjustments.length === 0 || invalid}
                onClick={() => setReviewing(true)}
              >
                Revisar {adjustments.length} ajuste{adjustments.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Summary label="Ajustes" value={String(adjustments.length)} />
              <Summary
                label="Faltas (custo)"
                value={BRL.format(Math.abs(lossValue))}
                tone="danger"
              />
              <Summary label="Sobras (custo)" value={BRL.format(gainValue)} />
            </div>
            <ul className="max-h-[36vh] divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
              {adjustments.map((r) => (
                <li key={r.it.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate">{r.it.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {NUM.format(r.system)} → {NUM.format(r.counted!)}{" "}
                    <span
                      className={cn(
                        "font-medium",
                        r.diff! < 0 ? "text-destructive" : "text-emerald-600",
                      )}
                    >
                      ({r.diff! > 0 ? "+" : ""}
                      {NUM.format(r.diff!)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observação (opcional): quem contou, onde, motivo das diferenças…"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReviewing(false)}>
                Voltar à contagem
              </Button>
              <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Registrando…" : "Registrar inventário"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-xl", tone === "danger" && "text-destructive")}>
        {value}
      </div>
    </div>
  );
}
