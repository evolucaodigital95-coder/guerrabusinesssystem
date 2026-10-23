import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAutomation } from "@/hooks/use-automation";
import { calcOnHand, type MovementKind } from "@/lib/stock";

/**
 * Fluxo simplificado por tipo de operação. Uma única seleção define o formulário mínimo.
 * Suporta MÚLTIPLOS itens em uma única movimentação (ex.: uma saída com 5 livros e 10 folders).
 * O sistema calcula automaticamente o custo em saídas (custo médio / lote).
 */
type SimpleType =
  | "entrada"
  | "saida_palestra"
  | "ajuste"
  | "perda"
  | "devolucao"
  | "devolucao_fornecedor";

type Line = {
  key: string;
  itemId: string | null;
  qty: string;
  unitCost: string; // usado apenas para entrada
};

const TYPE_OPTIONS: {
  key: SimpleType;
  label: string;
  help: string;
  kind: MovementKind;
  direction: "in" | "out";
  status: string;
}[] = [
  {
    key: "entrada",
    label: "Entrada",
    help: "Compra ou reposição — registra custo e atualiza custo médio.",
    kind: "entrada",
    direction: "in",
    status: "utilizado",
  },
  {
    key: "saida_palestra",
    label: "Saída para Palestra",
    help: "Consumo vinculado a uma palestra — custo automático pelo estoque.",
    kind: "saida",
    direction: "out",
    status: "utilizado",
  },
  {
    key: "ajuste",
    label: "Ajuste",
    help: "Correção de inventário (positiva ou negativa).",
    kind: "ajuste",
    direction: "in",
    status: "utilizado",
  },
  {
    key: "perda",
    label: "Perda / Avaria",
    help: "Baixa por perda, dano ou vencimento.",
    kind: "baixa",
    direction: "out",
    status: "utilizado",
  },
  {
    key: "devolucao",
    label: "Devolução ao estoque",
    help: "Material que voltou para o estoque (sobra de palestra).",
    kind: "devolucao",
    direction: "in",
    status: "utilizado",
  },
  {
    key: "devolucao_fornecedor",
    label: "Devolução ao fornecedor",
    help: "Material devolvido ao fornecedor — sai do seu estoque.",
    kind: "devolucao_fornecedor",
    direction: "out",
    status: "utilizado",
  },
];

function emptyLine(itemId: string | null = null): Line {
  return { key: crypto.randomUUID(), itemId, qty: "", unitCost: "" };
}

export function MovementFormDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  stockItemId,
  lockedItem,
  defaultLectureId,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  stockItemId?: string;
  lockedItem?: boolean;
  defaultLectureId?: string;
  defaultType?: SimpleType;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialType: SimpleType = defaultType ?? "saida_palestra";

  const [type, setType] = useState<SimpleType>(initialType);
  const [lines, setLines] = useState<Line[]>([emptyLine(stockItemId ?? null)]);
  const [supplier, setSupplier] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [lectureId, setLectureId] = useState<string | null>(defaultLectureId ?? null);
  const [occursOn, setOccursOn] = useState<string>(today);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setType(initialType);
      setLines([emptyLine(stockItemId ?? null)]);
      setSupplier("");
      setReason("");
      setLectureId(defaultLectureId ?? null);
      setOccursOn(today);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);

  const qc = useQueryClient();
  const { emit } = useAutomation();

  const items = useQuery({
    queryKey: ["stock-items-select", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit, average_cost, purchase_price")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Todas as movimentações do org para cálculo de saldo por item.
  const allMovements = useQuery({
    queryKey: ["stock-movements-all-form", organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("stock_item_id, kind, direction, quantity, status")
        .eq("organization_id", organizationId)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lectures = useQuery({
    queryKey: ["stock-lectures-select", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const itemsById = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string;
        name: string;
        unit: string | null;
        average_cost: number | null;
        purchase_price: number | null;
      }
    >();
    for (const it of items.data ?? []) m.set(it.id, it);
    return m;
  }, [items.data]);

  const availableById = useMemo(() => {
    const map = new Map<string, number>();
    const list = allMovements.data ?? [];
    for (const it of items.data ?? []) {
      map.set(it.id, calcOnHand(list.filter((m) => m.stock_item_id === it.id)).available);
    }
    return map;
  }, [items.data, allMovements.data]);

  const opt = TYPE_OPTIONS.find((t) => t.key === type)!;
  const isSaidaPalestra = type === "saida_palestra";
  const isEntrada = type === "entrada";
  const isDevFornecedor = type === "devolucao_fornecedor";
  const isOut = opt.direction === "out";

  const validLines = lines.filter((l) => l.itemId && Number(l.qty) > 0);

  const totalCost = useMemo(() => {
    let sum = 0;
    for (const l of validLines) {
      const it = l.itemId ? itemsById.get(l.itemId) : null;
      if (!it) continue;
      const unit = isEntrada
        ? Number(l.unitCost || 0)
        : Number(it.average_cost ?? it.purchase_price ?? 0);
      sum += unit * Number(l.qty);
    }
    return sum;
  }, [validLines, itemsById, isEntrada]);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (validLines.length === 0) throw new Error("Adicione ao menos um item com quantidade.");
      if (isSaidaPalestra && !lectureId) throw new Error("Selecione a palestra vinculada à saída.");
      if (isDevFornecedor && !supplier.trim())
        throw new Error("Informe para qual fornecedor está devolvendo.");
      if (!isEntrada && !isSaidaPalestra && !isDevFornecedor && !reason.trim())
        throw new Error("Informe o motivo da movimentação.");

      // Validações por linha
      for (const l of validLines) {
        const it = itemsById.get(l.itemId!);
        const q = Number(l.qty);
        if (isEntrada && Number(l.unitCost || 0) <= 0) {
          throw new Error(`Informe o custo unitário de "${it?.name ?? "item"}".`);
        }
        if (isOut) {
          const avail = availableById.get(l.itemId!) ?? 0;
          if (q > avail) {
            throw new Error(
              `"${it?.name ?? "Item"}": disponível ${avail} ${it?.unit ?? "un"}, tentou retirar ${q}.`,
            );
          }
        }
      }

      // Impede duplicidade dentro do próprio formulário (mesmo item repetido)
      const seen = new Set<string>();
      for (const l of validLines) {
        if (seen.has(l.itemId!)) {
          const it = itemsById.get(l.itemId!);
          throw new Error(
            `Item "${it?.name ?? ""}" aparece duas vezes. Some as quantidades em uma única linha.`,
          );
        }
        seen.add(l.itemId!);
      }

      const rows = validLines.map((l) => {
        const insertUnitCost = isEntrada ? Number(l.unitCost) : null;
        const q = Number(l.qty);
        return {
          organization_id: organizationId,
          stock_item_id: l.itemId!,
          kind: opt.kind,
          direction: opt.direction,
          status: opt.status,
          quantity: q,
          unit_cost: insertUnitCost,
          total_cost: insertUnitCost != null ? insertUnitCost * q : null,
          occurs_on: occursOn,
          occurs_at: new Date().toISOString(),
          lecture_id: isSaidaPalestra ? lectureId : null,
          reason:
            (isEntrada
              ? supplier.trim()
              : isDevFornecedor
                ? `Devolução ao fornecedor: ${supplier.trim()}${reason.trim() ? ` — ${reason.trim()}` : ""}`
                : reason.trim()) || null,
          notes: notes.trim() || null,
          created_by: userId,
          updated_by: userId,
        };
      });

      const { error } = await supabase.from("stock_movements").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Movimentação registrada" : `${n} movimentações registradas`);
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      qc.invalidateQueries({ queryKey: ["stock-movements-all-form"] });
      qc.invalidateQueries({ queryKey: ["stock-item-movements-form"] });
      if (lectureId) {
        qc.invalidateQueries({ queryKey: ["fechamento-stock", lectureId] });
        qc.invalidateQueries({ queryKey: ["lecture-stock", lectureId] });
      }
      void emit("stock.movement.created", {
        entityType: "stock_item",
        entityId: null,
        lectureId: lectureId ?? null,
        summary:
          n === 1
            ? "Movimentação de estoque registrada"
            : `${n} movimentações de estoque registradas`,
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const selectedLecture = (lectures.data ?? []).find((l) => l.id === lectureId);
  const multi = !lockedItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova movimentação</DialogTitle>
          <DialogDescription>
            {opt.help}
            {multi ? " Você pode incluir vários itens de uma só vez." : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as SimpleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={occursOn}
                onChange={(e) => setOccursOn(e.target.value)}
                required
              />
            </div>
          </div>

          {isSaidaPalestra && (
            <div className="space-y-1.5">
              <Label>Palestra *</Label>
              <Select value={lectureId ?? ""} onValueChange={(v) => setLectureId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar palestra" />
                </SelectTrigger>
                <SelectContent>
                  {(lectures.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLecture && (
                <p className="text-[11px] text-muted-foreground">
                  Todos os itens abaixo serão vinculados a esta palestra.
                </p>
              )}
            </div>
          )}

          {isEntrada ? (
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Opcional — aplicado a todos os itens"
              />
            </div>
          ) : isDevFornecedor ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fornecedor *</Label>
                <Input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Para quem você está devolvendo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Opcional — ex.: item com defeito, sobra de compra"
                />
              </div>
              <p className="md:col-span-2 text-[11px] text-muted-foreground">
                Os itens abaixo serão retirados do seu estoque e registrados como devolvidos ao
                fornecedor.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Motivo{isSaidaPalestra ? "" : " *"}</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isSaidaPalestra
                    ? "Opcional — ex.: kit de materiais do evento"
                    : "Ex.: perda no transporte, correção de inventário"
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens *</Label>
              {multi && (
                <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {lines.map((l) => {
                const it = l.itemId ? itemsById.get(l.itemId) : null;
                const avail = l.itemId ? (availableById.get(l.itemId) ?? 0) : 0;
                const q = Number(l.qty || 0);
                const insufficient = isOut && q > 0 && q > avail;
                const unit = it ? Number(it.average_cost ?? it.purchase_price ?? 0) : 0;
                return (
                  <div
                    key={l.key}
                    className="rounded-xl border border-border/70 bg-background/40 p-3"
                  >
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                      <div className="md:col-span-6">
                        {lockedItem ? (
                          <Input value={it?.name ?? ""} readOnly />
                        ) : (
                          <Select
                            value={l.itemId ?? ""}
                            onValueChange={(v) => {
                              const picked = itemsById.get(v);
                              updateLine(l.key, {
                                itemId: v,
                                unitCost:
                                  isEntrada && !l.unitCost && picked?.purchase_price != null
                                    ? String(picked.purchase_price)
                                    : l.unitCost,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar item" />
                            </SelectTrigger>
                            <SelectContent>
                              {(items.data ?? []).map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name}
                                  {i.unit ? ` · ${i.unit}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {it && (
                          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            Disponível:{" "}
                            <span className="tabular-nums text-foreground">{avail}</span>{" "}
                            {it.unit ?? "un"}
                            {!isEntrada && unit > 0 && <> · Custo méd. {money(unit)}</>}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Qtd"
                          value={l.qty}
                          onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                        />
                      </div>

                      {isEntrada ? (
                        <div className="md:col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Custo unit."
                            value={l.unitCost}
                            onChange={(e) => updateLine(l.key, { unitCost: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className="md:col-span-3 flex items-center text-right text-sm tabular-nums text-muted-foreground">
                          {q > 0 && unit > 0 ? money(unit * q) : ""}
                        </div>
                      )}

                      {multi && lines.length > 1 && (
                        <div className="md:col-span-12 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => removeLine(l.key)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                          </Button>
                        </div>
                      )}
                    </div>

                    {insufficient && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          Estoque insuficiente. Disponível: {avail} {it?.unit ?? "un"}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {validLines.length > 0 && totalCost > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Custo total estimado</span>
                <span className="font-serif tabular-nums text-foreground">{money(totalCost)}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional — aplicada a todos os itens"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending
                ? "Salvando…"
                : validLines.length > 1
                  ? `Registrar ${validLines.length} itens`
                  : isSaidaPalestra
                    ? "Confirmar saída"
                    : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
