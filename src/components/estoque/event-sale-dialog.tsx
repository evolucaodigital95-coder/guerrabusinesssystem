import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { balancesByItem } from "@/lib/stock";
import { BRL, NUM } from "@/lib/format";
import { EVENT_SALE_CATEGORY, EVENT_SALE_REASON_PREFIX } from "@/lib/org-preferences";
import { cn } from "@/lib/utils";

const PAYMENTS = [
  { key: "pix", label: "PIX" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito", label: "Crédito" },
  { key: "debito", label: "Débito" },
] as const;
const NONE = "__none__";
const PRICE_KEY = (org: string) => `gbs-precos-venda-${org}`;

type Line = { key: string; itemId: string | null; qty: number; price: string };
const newLine = (): Line => ({ key: crypto.randomUUID(), itemId: null, qty: 1, price: "" });
const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (v: string) => {
  const s = v.trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Venda no evento: baixa o estoque e lança a receita juntos, em uma só tela.
 * Feita para o celular, no fundo da sala, logo depois da palestra.
 */
export function EventSaleDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  defaultLectureId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  defaultLectureId?: string | null;
}) {
  const qc = useQueryClient();
  const [lectureId, setLectureId] = useState<string>(NONE);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]["key"]>("pix");
  const [accountId, setAccountId] = useState<string>(NONE);

  const data = useQuery({
    queryKey: ["event-sale-data", organizationId, defaultLectureId ?? null],
    enabled: open,
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 10);
      const to = new Date();
      to.setDate(to.getDate() + 3);
      const [items, movs, lectures, accounts] = await Promise.all([
        supabase
          .from("stock_items")
          .select("id, name, unit, category, status")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("name"),
        fetchAll(() =>
          supabase
            .from("stock_movements")
            .select("stock_item_id, kind, direction, quantity, status")
            .eq("organization_id", organizationId)
            .is("archived_at", null),
        ),
        supabase
          .from("lectures")
          .select("id, title, scheduled_at, companies:company_id ( legal_name )")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .neq("status", "cancelada")
          .gte("scheduled_at", from.toISOString())
          .lte("scheduled_at", to.toISOString())
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("accounts")
          .select("id, name")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("name"),
      ]);
      for (const r of [items, movs, lectures, accounts]) if (r.error) throw r.error;
      const balances = balancesByItem(movs.data ?? []);
      const lectureList = [...(lectures.data ?? [])];
      // A palestra de origem pode estar fora da janela de datas: garante que apareça.
      if (defaultLectureId && !lectureList.some((l) => l.id === defaultLectureId)) {
        const { data: one } = await supabase
          .from("lectures")
          .select("id, title, scheduled_at, companies:company_id ( legal_name )")
          .eq("id", defaultLectureId)
          .maybeSingle();
        if (one) lectureList.unshift(one);
      }
      return {
        items: (items.data ?? []).filter(
          (i) => i.status !== "inativo" && i.status !== "descontinuado",
        ),
        available: new Map([...balances].map(([id, b]) => [id, b.available])),
        lectures: lectureList,
        accounts: accounts.data ?? [],
      };
    },
  });

  // Ao abrir: palestra mais próxima de agora e últimos preços usados.
  useEffect(() => {
    if (!open) return;
    setLines([newLine()]);
    setPayment("pix");
  }, [open]);
  useEffect(() => {
    if (!open || !data.data) return;
    if (defaultLectureId) setLectureId(defaultLectureId);
    else {
      const now = Date.now();
      const nearest = [...data.data.lectures].sort(
        (a, b) =>
          Math.abs(new Date(a.scheduled_at ?? 0).getTime() - now) -
          Math.abs(new Date(b.scheduled_at ?? 0).getTime() - now),
      )[0];
      setLectureId(nearest?.id ?? NONE);
    }
    if (data.data.accounts.length === 1) setAccountId(data.data.accounts[0].id);
  }, [open, data.data, defaultLectureId]);

  const lastPrices = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(PRICE_KEY(organizationId)) ?? "{}");
    } catch {
      return {};
    }
    // Relê os preços salvos a cada abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, open]);

  const itemsById = new Map((data.data?.items ?? []).map((i) => [i.id, i]));
  const valid = lines.filter((l) => l.itemId && l.qty > 0);
  const total = valid.reduce((s, l) => s + l.qty * (money(l.price) || 0), 0);
  const problems = valid
    .map((l) => {
      const it = itemsById.get(l.itemId!);
      const avail = data.data?.available.get(l.itemId!) ?? 0;
      if (!(money(l.price) > 0)) return `Informe o preço de "${it?.name ?? "item"}".`;
      if (l.qty > avail)
        return `"${it?.name}": disponível ${NUM.format(avail)}, tentou vender ${l.qty}.`;
      return null;
    })
    .filter(Boolean) as string[];
  const dup = new Set(valid.map((l) => l.itemId)).size !== valid.length;

  function update(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (valid.length === 0) throw new Error("Adicione ao menos um item.");
      if (dup) throw new Error("Um item aparece duas vezes. Some as quantidades em uma linha.");
      if (problems.length) throw new Error(problems[0]);
      if (accountId === NONE) throw new Error("Escolha a conta em que o dinheiro entrou.");
      const lecture = data.data?.lectures.find((l) => l.id === lectureId);
      const lec = lectureId === NONE ? null : lectureId;
      const day = ymd();
      const label = lecture
        ? `${EVENT_SALE_REASON_PREFIX} · ${lecture.title}`
        : EVENT_SALE_REASON_PREFIX;

      const stockRows = valid.map((l) => ({
        organization_id: organizationId,
        stock_item_id: l.itemId!,
        kind: "saida",
        direction: "out",
        status: "utilizado",
        quantity: l.qty,
        occurs_on: day,
        occurs_at: new Date().toISOString(),
        lecture_id: lec,
        reason: `${label} · ${l.qty} × ${BRL.format(money(l.price))}`,
        created_by: userId,
        updated_by: userId,
      }));
      const { data: inserted, error: stErr } = await supabase
        .from("stock_movements")
        .insert(stockRows)
        .select("id");
      if (stErr) throw stErr;

      const summary = valid
        .map((l) => `${l.qty}× ${itemsById.get(l.itemId!)?.name ?? "item"}`)
        .join(", ");
      const { error: finErr } = await supabase.from("financial_movements").insert({
        organization_id: organizationId,
        direction: "in",
        status: "recebido",
        category: EVENT_SALE_CATEGORY,
        description: `${label}: ${summary}`,
        amount: Math.round(total * 100) / 100,
        occurs_on: day,
        settled_at: day,
        account_id: accountId,
        payment_method: payment,
        lecture_id: lec,
        created_by: userId,
        updated_by: userId,
      });
      if (finErr) {
        // Sem a receita, a baixa não pode ficar: desfaz arquivando as saídas.
        const ids = (inserted ?? []).map((r) => r.id);
        if (ids.length)
          await supabase
            .from("stock_movements")
            .update({ archived_at: new Date().toISOString(), updated_by: userId })
            .in("id", ids);
        throw finErr;
      }
      try {
        const prices = { ...lastPrices };
        for (const l of valid) prices[l.itemId!] = l.price;
        localStorage.setItem(PRICE_KEY(organizationId), JSON.stringify(prices));
      } catch {
        /* preços não memorizados */
      }
    },
    onSuccess: () => {
      toast.success(`Venda registrada: ${BRL.format(total)} · estoque e caixa atualizados.`);
      for (const k of [
        "stock-movements",
        "stock-items",
        "stock-health",
        "movements",
        "finance-overview",
        "lectures",
      ])
        qc.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a venda."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <ShoppingBag className="h-5 w-5 text-clay" /> Venda no evento
          </DialogTitle>
          <DialogDescription>Baixa o estoque e lança a receita juntos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Palestra</Label>
          <Select value={lectureId} onValueChange={setLectureId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a palestra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Venda avulsa (sem palestra)</SelectItem>
              {(data.data?.lectures ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                  {l.scheduled_at
                    ? ` · ${new Date(l.scheduled_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {lines.map((l) => {
            const avail = l.itemId ? (data.data?.available.get(l.itemId) ?? 0) : null;
            return (
              <div key={l.key} className="rounded-xl border border-border p-3">
                <div className="flex gap-2">
                  <Select
                    value={l.itemId ?? undefined}
                    onValueChange={(v) =>
                      update(l.key, { itemId: v, price: l.price || lastPrices[v] || "" })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Livro, kit ou material" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data.data?.items ?? []).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      className="grid h-10 w-10 place-items-center text-muted-foreground hover:text-foreground"
                      onClick={() => update(l.key, { qty: Math.max(1, l.qty - 1) })}
                      aria-label="Diminuir"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center font-display text-lg tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      className="grid h-10 w-10 place-items-center text-muted-foreground hover:text-foreground"
                      onClick={() => update(l.key, { qty: l.qty + 1 })}
                      aria-label="Aumentar"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => update(l.key, { price: e.target.value })}
                      placeholder="Preço unitário"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
                {avail !== null && (
                  <div
                    className={cn(
                      "mt-1.5 text-[11px]",
                      l.qty > avail ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    Disponível: {NUM.format(avail)} {itemsById.get(l.itemId!)?.unit ?? "un"}
                  </div>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
            <Plus /> Outro item
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label>Pagamento</Label>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENTS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPayment(p.key)}
                className={cn(
                  "h-10 rounded-lg border text-sm transition-colors",
                  payment === p.key
                    ? "border-clay bg-clay text-clay-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Entrou na conta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Escolha a conta</SelectItem>
              {(data.data?.accounts ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-ink-foreground">
          <span className="text-sm text-ink-foreground/70">Total da venda</span>
          <span className="font-display text-3xl">{BRL.format(total)}</span>
        </div>
        {(problems.length > 0 || dup) && (
          <p className="text-xs text-destructive">
            {dup ? "Item repetido: some numa linha só." : problems[0]}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            className="h-11 flex-1 sm:flex-none"
            disabled={save.isPending || valid.length === 0 || problems.length > 0 || dup}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Registrando…" : `Registrar ${BRL.format(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
