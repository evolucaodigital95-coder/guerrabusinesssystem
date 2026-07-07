import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { calcOnHand, movementDirection, type MovementKind } from "@/lib/stock";

/**
 * Fluxo simplificado por tipo de operação. Uma única seleção define o formulário mínimo.
 * O sistema calcula automaticamente o custo em saídas (custo médio / lote), não pede duas vezes.
 */
type SimpleType = "entrada" | "saida_palestra" | "ajuste" | "perda" | "devolucao";

const TYPE_OPTIONS: { key: SimpleType; label: string; help: string; kind: MovementKind; direction: "in" | "out"; status: string }[] = [
  { key: "entrada",         label: "Entrada",           help: "Compra ou reposição — registra custo e atualiza custo médio.", kind: "entrada",     direction: "in",  status: "utilizado" },
  { key: "saida_palestra",  label: "Saída para Palestra", help: "Consumo vinculado a uma palestra — custo automático pelo estoque.", kind: "saida",     direction: "out", status: "utilizado" },
  { key: "ajuste",          label: "Ajuste",            help: "Correção de inventário (positiva ou negativa).", kind: "ajuste",      direction: "in",  status: "utilizado" },
  { key: "perda",           label: "Perda / Avaria",    help: "Baixa por perda, dano ou vencimento.", kind: "baixa",       direction: "out", status: "utilizado" },
  { key: "devolucao",       label: "Devolução",         help: "Retorno de material ao estoque.", kind: "devolucao",   direction: "in",  status: "utilizado" },
];

export function MovementFormDialog({
  open, onOpenChange, organizationId, userId, stockItemId, lockedItem, defaultLectureId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  stockItemId?: string;
  lockedItem?: boolean;
  defaultLectureId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<SimpleType>("saida_palestra");
  const [itemId, setItemId] = useState<string | null>(stockItemId ?? null);
  const [qty, setQty] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [lectureId, setLectureId] = useState<string | null>(defaultLectureId ?? null);
  const [occursOn, setOccursOn] = useState<string>(today);
  const [notes, setNotes] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forceSubmit, setForceSubmit] = useState(false);

  useEffect(() => {
    if (open) {
      setType("saida_palestra");
      setItemId(stockItemId ?? null);
      setQty(""); setUnitCost(""); setSupplier("");
      setLectureId(defaultLectureId ?? null);
      setOccursOn(today); setNotes("");
      setForceSubmit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["stock-items-select", organizationId],
    enabled: !lockedItem && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items").select("id, name, unit")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentItem = useQuery({
    queryKey: ["stock-item-cost", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit, average_cost, purchase_price")
        .eq("id", itemId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Estoque disponível (para validação de saída)
  const itemMovements = useQuery({
    queryKey: ["stock-item-movements-form", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("kind, direction, quantity, status")
        .eq("stock_item_id", itemId!).is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lectures = useQuery({
    queryKey: ["stock-lectures-select", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures").select("id, title, scheduled_at, company_id, agent_id, season_id, campaign_id, project_id")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const onHand = useMemo(() => calcOnHand(itemMovements.data ?? []).available, [itemMovements.data]);
  const autoUnitCost = Number(currentItem.data?.average_cost ?? currentItem.data?.purchase_price ?? 0);
  const numQty = Number(qty || 0);
  const isSaidaPalestra = type === "saida_palestra";
  const isEntrada = type === "entrada";
  const effectiveUnitCost = isEntrada ? Number(unitCost || 0) : autoUnitCost;
  const totalCost = effectiveUnitCost * numQty;
  const selectedLecture = (lectures.data ?? []).find((l) => l.id === lectureId);

  // Detecta possível duplicata (mesmo item/qty/palestra/data já registrado nos últimos minutos).
  const dupCheck = useQuery({
    queryKey: ["stock-dup-check", itemId, numQty, lectureId, occursOn, type],
    enabled: open && !!itemId && numQty > 0 && (isSaidaPalestra ? !!lectureId : true),
    queryFn: async () => {
      const opt = TYPE_OPTIONS.find((t) => t.key === type)!;
      const q = supabase
        .from("stock_movements")
        .select("id, occurs_on, created_at, quantity")
        .eq("stock_item_id", itemId!)
        .eq("kind", opt.kind)
        .eq("quantity", numQty)
        .eq("occurs_on", occursOn)
        .is("archived_at", null)
        .limit(1);
      const query = lectureId ? q.eq("lecture_id", lectureId) : q.is("lecture_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasDuplicate = (dupCheck.data ?? []).length > 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error("Selecione o item.");
      if (!numQty || numQty <= 0) throw new Error("Informe a quantidade.");
      const opt = TYPE_OPTIONS.find((t) => t.key === type)!;

      if (opt.direction === "out" && numQty > onHand) {
        throw new Error(`Não foi possível concluir: existem ${onHand} ${currentItem.data?.unit ?? "un"} disponíveis e você tentou retirar ${numQty}.`);
      }
      if (isSaidaPalestra && !lectureId) {
        throw new Error("Selecione a palestra vinculada à saída.");
      }
      if (isEntrada && Number(unitCost || 0) <= 0) {
        throw new Error("Informe o custo unitário da entrada.");
      }
      if (hasDuplicate && !forceSubmit) {
        throw new Error("__DUPLICATE__");
      }

      const insertUnitCost = isEntrada ? Number(unitCost) : null; // Trigger stock_mov_autocost preenche saída via lote/média.
      const { error } = await supabase.from("stock_movements").insert({
        organization_id: organizationId,
        stock_item_id: itemId,
        kind: opt.kind,
        direction: opt.direction,
        status: opt.status,
        quantity: numQty,
        unit_cost: insertUnitCost,
        total_cost: insertUnitCost != null ? insertUnitCost * numQty : null,
        occurs_on: occursOn,
        occurs_at: new Date().toISOString(),
        lecture_id: isSaidaPalestra ? lectureId : null,
        reason: isEntrada ? (supplier.trim() || null) : null,
        notes: notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      qc.invalidateQueries({ queryKey: ["stock-item-movements-form"] });
      if (itemId) qc.invalidateQueries({ queryKey: ["stock-item", itemId] });
      if (lectureId) {
        qc.invalidateQueries({ queryKey: ["fechamento-stock", lectureId] });
        qc.invalidateQueries({ queryKey: ["lecture-stock", lectureId] });
      }
      onOpenChange(false);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg === "__DUPLICATE__") {
        setConfirmOpen(true);
        return;
      }
      toast.error(msg);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova movimentação</DialogTitle>
          <DialogDescription>{TYPE_OPTIONS.find((t) => t.key === type)!.help}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={(v) => setType(v as SimpleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!lockedItem && (
            <div className="space-y-1.5">
              <Label>Item *</Label>
              <Select value={itemId ?? ""} onValueChange={(v) => setItemId(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                <SelectContent>
                  {(items.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}{i.unit ? ` · ${i.unit}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input
                type="number" step="0.001" min="0" value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
              {itemId && (
                <p className="text-[11px] text-muted-foreground">
                  Disponível em estoque: <span className="tabular-nums text-foreground">{onHand}</span> {currentItem.data?.unit ?? "un"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={occursOn} onChange={(e) => setOccursOn(e.target.value)} required />
            </div>
          </div>

          {isEntrada && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Custo unitário *</Label>
                <Input type="number" step="0.01" min="0" value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)} required />
                {numQty > 0 && Number(unitCost) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Custo total: <span className="tabular-nums text-foreground">{money(Number(unitCost) * numQty)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          )}

          {isSaidaPalestra && (
            <div className="space-y-1.5">
              <Label>Palestra *</Label>
              <Select value={lectureId ?? ""} onValueChange={(v) => setLectureId(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar palestra" /></SelectTrigger>
                <SelectContent>
                  {(lectures.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLecture && numQty > 0 && (
                <div className="mt-2 rounded-xl border border-border/70 bg-background/40 p-3 text-[13px]">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resumo</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Item</span>
                    <span className="tabular-nums text-foreground">{currentItem.data?.name ?? "—"}</span>
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="tabular-nums text-foreground">{numQty} {currentItem.data?.unit ?? "un"}</span>
                    <span className="text-muted-foreground">Custo médio unitário</span>
                    <span className="tabular-nums text-foreground">{money(autoUnitCost)}</span>
                    <span className="text-muted-foreground">Custo total</span>
                    <span className="tabular-nums text-foreground">{money(totalCost)}</span>
                    <span className="text-muted-foreground">Palestra</span>
                    <span className="text-foreground">{selectedLecture.title}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          {hasDuplicate && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Já existe uma movimentação idêntica (mesmo item, quantidade, data e vínculo). Se for intencional, confirme mesmo assim.</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isSaidaPalestra ? "Confirmar saída" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Registrar mesmo assim?</DialogTitle>
          <DialogDescription>
            Já existe uma movimentação idêntica para este item, quantidade, data e vínculo. Isso pode ser duplicata.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button
            variant="navy"
            onClick={() => {
              setForceSubmit(true);
              setConfirmOpen(false);
              setTimeout(() => save.mutate(), 0);
            }}
            disabled={save.isPending}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar duplicata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
