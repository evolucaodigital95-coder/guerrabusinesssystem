import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { calcOnHand } from "@/lib/stock";
import { calculateLecture, selectRule, DEFAULT_RULE, type RuleSnapshot } from "@/lib/finance-engine";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Step = 1 | 2 | 3 | 4;

type MaterialLine = {
  key: string;
  itemId: string | null;
  qty: string;
};

type WizardState = {
  // Etapa 1
  title: string;
  theme: string;
  company_id: string | null;
  contact_id: string | null;
  agent_id: string | null;
  project_id: string | null;
  campaign_id: string | null;
  season_id: string | null;
  speaker_id: string | null;
  scheduled_at: string;
  scheduled_time: string;
  expected_audience: string;
  city: string;
  state: string;
  address: string;
  // Etapa 2
  gross_revenue: string;
  payment_method: "pix" | "dinheiro" | "credito" | "debito" | "cheque" | "transferencia";
  card_brand_id: string | null;
  card_installments: string;
  card_fee_percent: string; // opcional — auto pela bandeira
  finance_status: "previsto" | "recebido";
  account_id: string | null;
  // Etapa 3
  materials: MaterialLine[];
  notes: string;
};

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function isCard(pm: string) { return pm === "credito" || pm === "debito"; }

export function LectureWizardDialog({
  open, onOpenChange, organizationId, userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [f, setF] = useState<WizardState>(() => initialState(today));

  useEffect(() => {
    if (open) { setStep(1); setF(initialState(today)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---- data ----
  const companies = useQuery({
    queryKey: ["wiz-companies", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("companies").select("id, legal_name, trade_name").eq("organization_id", organizationId).is("archived_at", null).order("legal_name")).data ?? [],
  });
  const contacts = useQuery({
    queryKey: ["wiz-contacts", organizationId, f.company_id], enabled: open,
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, full_name, company_id").eq("organization_id", organizationId).is("archived_at", null).order("full_name");
      if (f.company_id) q = q.eq("company_id", f.company_id);
      return (await q).data ?? [];
    },
  });
  const agents = useQuery({
    queryKey: ["wiz-agents", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("agents").select("id, full_name").eq("organization_id", organizationId).is("archived_at", null).order("full_name")).data ?? [],
  });
  const seasons = useQuery({
    queryKey: ["wiz-seasons", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("seasons").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("starts_on", { ascending: false })).data ?? [],
  });
  const campaigns = useQuery({
    queryKey: ["wiz-campaigns", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("campaigns").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });
  const projects = useQuery({
    queryKey: ["wiz-projects", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("projects").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });
  const accounts = useQuery({
    queryKey: ["wiz-accounts", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("accounts").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });
  const cardBrands = useQuery({
    queryKey: ["wiz-cards", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("card_brands").select("id, name, kind").eq("organization_id", organizationId).eq("active", true).is("archived_at", null).order("name")).data ?? [],
  });
  const stockItems = useQuery({
    queryKey: ["wiz-stock", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("stock_items").select("id, name, unit, average_cost, purchase_price").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });
  const stockMovs = useQuery({
    queryKey: ["wiz-stock-movs", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("stock_movements").select("stock_item_id, kind, direction, quantity, status").eq("organization_id", organizationId).is("archived_at", null)).data ?? [],
  });
  const rules = useQuery({
    queryKey: ["wiz-rules", organizationId], enabled: open,
    queryFn: async () => (await supabase.from("financial_rules").select("*").eq("organization_id", organizationId).is("archived_at", null)).data ?? [],
  });

  const itemsById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; unit: string | null; average_cost: number | null; purchase_price: number | null }>();
    for (const it of stockItems.data ?? []) m.set(it.id, it);
    return m;
  }, [stockItems.data]);
  const availableById = useMemo(() => {
    const map = new Map<string, number>();
    const list = stockMovs.data ?? [];
    for (const it of stockItems.data ?? []) {
      map.set(it.id, calcOnHand(list.filter((m) => m.stock_item_id === it.id)).available);
    }
    return map;
  }, [stockItems.data, stockMovs.data]);

  // ---- derived (etapa 4) ----
  const gross = Number(f.gross_revenue || 0);
  const materialsTotal = useMemo(() => {
    let sum = 0;
    for (const l of f.materials) {
      const it = l.itemId ? itemsById.get(l.itemId) : null;
      if (!it || !l.qty) continue;
      const unit = Number(it.average_cost ?? it.purchase_price ?? 0);
      sum += unit * Number(l.qty);
    }
    return sum;
  }, [f.materials, itemsById]);

  const rule: RuleSnapshot = useMemo(() => {
    if (!rules.data) return DEFAULT_RULE;
    return selectRule({
      rules: rules.data as any,
      agentId: f.agent_id,
      seasonId: f.season_id,
      date: f.scheduled_at,
    });
  }, [rules.data, f.agent_id, f.season_id, f.scheduled_at]);

  const cardFeePreview = useMemo(() => {
    if (!isCard(f.payment_method) || gross <= 0) return 0;
    const pct = Number(f.card_fee_percent || 0);
    return (gross * pct) / 100;
  }, [f.payment_method, f.card_fee_percent, gross]);

  const calc = useMemo(() => calculateLecture({
    grossRevenue: gross,
    cardFees: cardFeePreview > 0 ? [{ amount: cardFeePreview, brand: "Cartão", installments: Number(f.card_installments || 1), percent: Number(f.card_fee_percent || 0) }] : [],
    expenses: materialsTotal > 0 ? [{ description: "Materiais utilizados", amount: materialsTotal, bucket: "stock" }] : [],
    advances: [],
    rule,
  }), [gross, cardFeePreview, materialsTotal, rule, f.card_installments, f.card_fee_percent]);

  // ---- actions ----
  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) { setF((p) => ({ ...p, [k]: v })); }
  function addMat() { setF((p) => ({ ...p, materials: [...p.materials, { key: crypto.randomUUID(), itemId: null, qty: "" }] })); }
  function updMat(key: string, patch: Partial<MaterialLine>) {
    setF((p) => ({ ...p, materials: p.materials.map((m) => m.key === key ? { ...m, ...patch } : m) }));
  }
  function rmMat(key: string) {
    setF((p) => ({ ...p, materials: p.materials.length <= 1 ? p.materials : p.materials.filter((m) => m.key !== key) }));
  }

  function canAdvance(from: Step): string | null {
    if (from === 1) {
      if (!f.title.trim()) return "Informe o nome da palestra.";
      if (!f.scheduled_at) return "Informe a data.";
    }
    if (from === 2) {
      if (!f.gross_revenue || Number(f.gross_revenue) <= 0) return "Informe o valor vendido.";
      if (isCard(f.payment_method) && hasBrands && !f.card_brand_id) return "Selecione a bandeira do cartão.";
      if (isCard(f.payment_method) && !hasBrands && !f.card_fee_percent) return "Informe a taxa do cartão (%).";
    }
    if (from === 3) {
      const seen = new Set<string>();
      for (const l of f.materials) {
        if (!l.itemId) continue;
        if (!l.qty || Number(l.qty) <= 0) return "Quantidade inválida em um material.";
        if (seen.has(l.itemId)) return "Material repetido — some as quantidades numa linha só.";
        seen.add(l.itemId);
        const avail = availableById.get(l.itemId) ?? 0;
        if (Number(l.qty) > avail) {
          const it = itemsById.get(l.itemId);
          return `${it?.name ?? "Item"}: disponível ${avail}, tentou usar ${l.qty}.`;
        }
      }
    }
    return null;
  }

  function nextStep() {
    const err = canAdvance(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(4, (s + 1)) as Step);
  }
  function prevStep() { setStep((s) => Math.max(1, (s - 1)) as Step); }

  const save = useMutation({
    mutationFn: async () => {
      for (const s of [1, 2, 3] as Step[]) { const e = canAdvance(s); if (e) throw new Error(e); }

      const scheduledAt = f.scheduled_at
        ? new Date(`${f.scheduled_at}T${(f.scheduled_time || "00:00").slice(0, 5)}:00`).toISOString()
        : null;

      // 1) Cria palestra
      const { data: lecture, error: lecErr } = await supabase.from("lectures").insert({
        organization_id: organizationId,
        title: f.title.trim(),
        theme: f.theme.trim() || null,
        company_id: f.company_id, contact_id: f.contact_id, agent_id: f.agent_id,
        season_id: f.season_id, campaign_id: f.campaign_id, project_id: f.project_id,
        speaker_id: f.speaker_id,
        scheduled_at: scheduledAt,
        scheduled_time: f.scheduled_time || null,
        expected_audience: f.expected_audience ? Number(f.expected_audience) : null,
        city: f.city.trim() || null, state: f.state.trim() || null, address: f.address.trim() || null,
        status: "agendada",
        gross_revenue: gross,
        notes: f.notes.trim() || null,
        created_by: userId, updated_by: userId,
      }).select("id").single();
      if (lecErr) throw lecErr;
      const lectureId = lecture!.id as string;

      // 2) Cria lançamento financeiro (Entrada)
      const cardPayment = isCard(f.payment_method);
      const isRecebido = f.finance_status === "recebido";
      const finMov = {
        organization_id: organizationId,
        direction: "in" as const,
        status: f.finance_status,
        category: "palestra",
        description: `Palestra · ${f.title.trim()}`,
        amount: isRecebido ? gross : null,
        expected_amount: !isRecebido ? gross : null,
        expected_date: !isRecebido ? f.scheduled_at : null,
        settled_at: isRecebido ? f.scheduled_at : null,
        occurs_on: f.scheduled_at,
        account_id: f.account_id,
        company_id: f.company_id,
        lecture_id: lectureId,
        agent_id: f.agent_id,
        season_id: f.season_id,
        project_id: f.project_id,
        payment_method: f.payment_method,
        card_brand_id: cardPayment ? f.card_brand_id : null,
        card_installments: cardPayment ? Number(f.card_installments || 1) : null,
        card_fee_percent: cardPayment && f.card_fee_percent !== "" ? Number(f.card_fee_percent) : null,
        created_by: userId, updated_by: userId,
      };
      const { error: finErr } = await supabase.from("financial_movements").insert(finMov);
      if (finErr) throw finErr;

      // 3) Baixa de estoque (uma linha por material)
      const matRows = f.materials
        .filter((l) => l.itemId && Number(l.qty) > 0)
        .map((l) => ({
          organization_id: organizationId,
          stock_item_id: l.itemId!,
          kind: "saida" as const,
          direction: "out" as const,
          status: "utilizado",
          quantity: Number(l.qty),
          occurs_on: f.scheduled_at,
          occurs_at: new Date().toISOString(),
          lecture_id: lectureId,
          created_by: userId, updated_by: userId,
        }));
      if (matRows.length > 0) {
        const { error: stErr } = await supabase.from("stock_movements").insert(matRows);
        if (stErr) throw stErr;
      }

      return lectureId;
    },
    onSuccess: (lectureId) => {
      toast.success("Palestra criada com estoque e financeiro sincronizados");
      qc.invalidateQueries({ queryKey: ["lectures"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      // Navega para a palestra recém-criada
      setTimeout(() => { window.location.href = `/app/palestras/${lectureId}`; }, 250);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova palestra — Assistente
          </DialogTitle>
          <DialogDescription>
            Um único fluxo: cadastro, financeiro, estoque e resumo. Ao finalizar, tudo é sincronizado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        <div className="mt-4 space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldWrap label="Nome da palestra *" className="md:col-span-2">
                <Input value={f.title} onChange={(e) => set("title", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Tema">
                <Input value={f.theme} onChange={(e) => set("theme", e.target.value)} />
              </FieldWrap>

              <PickField label="Empresa" value={f.company_id} onChange={(v) => set("company_id", v)}
                options={(companies.data ?? []).map((c: any) => ({ value: c.id, label: c.trade_name ?? c.legal_name }))} />
              <PickField label="Contato" value={f.contact_id} onChange={(v) => set("contact_id", v)}
                options={(contacts.data ?? []).map((c: any) => ({ value: c.id, label: c.full_name }))} />
              <PickField label="Agendista" value={f.agent_id} onChange={(v) => set("agent_id", v)}
                options={(agents.data ?? []).map((a: any) => ({ value: a.id, label: a.full_name }))} />

              <PickField label="Projeto" value={f.project_id} onChange={(v) => set("project_id", v)}
                options={(projects.data ?? []).map((p: any) => ({ value: p.id, label: p.name }))} />
              <PickField label="Campanha" value={f.campaign_id} onChange={(v) => set("campaign_id", v)}
                options={(campaigns.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))} />
              <PickField label="Temporada" value={f.season_id} onChange={(v) => set("season_id", v)}
                options={(seasons.data ?? []).map((s: any) => ({ value: s.id, label: s.name }))} />

              <FieldWrap label="Data *">
                <Input type="date" value={f.scheduled_at} onChange={(e) => set("scheduled_at", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Hora">
                <Input type="time" value={f.scheduled_time} onChange={(e) => set("scheduled_time", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Público previsto">
                <Input type="number" value={f.expected_audience} onChange={(e) => set("expected_audience", e.target.value)} />
              </FieldWrap>

              <FieldWrap label="Cidade">
                <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Estado">
                <Input value={f.state} onChange={(e) => set("state", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Endereço">
                <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
              </FieldWrap>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldWrap label="Valor vendido (R$) *">
                <Input type="number" step="0.01" value={f.gross_revenue} onChange={(e) => set("gross_revenue", e.target.value)} />
              </FieldWrap>
              <FieldWrap label="Forma de pagamento *">
                <Select value={f.payment_method} onValueChange={(v) => set("payment_method", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Cartão de crédito</SelectItem>
                    <SelectItem value="debito">Cartão de débito</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </FieldWrap>
              <FieldWrap label="Status">
                <Select value={f.finance_status} onValueChange={(v) => set("finance_status", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                  </SelectContent>
                </Select>
              </FieldWrap>

              <PickField label="Conta financeira" value={f.account_id} onChange={(v) => set("account_id", v)}
                options={(accounts.data ?? []).map((a: any) => ({ value: a.id, label: a.name }))} />

              {isCard(f.payment_method) && (
                <>
                  <PickField label={hasBrands ? "Bandeira *" : "Bandeira"} value={f.card_brand_id} onChange={(v) => set("card_brand_id", v)}
                    options={(cardBrands.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))} />
                  <FieldWrap label="Parcelas">
                    <Input type="number" min="1" step="1" value={f.card_installments} onChange={(e) => set("card_installments", e.target.value)} />
                  </FieldWrap>
                  <FieldWrap label="Taxa cartão (%)">
                    <Input type="number" step="0.01" value={f.card_fee_percent} onChange={(e) => set("card_fee_percent", e.target.value)} placeholder="Auto pela bandeira" />
                  </FieldWrap>
                  {!hasBrands && (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Nenhuma bandeira cadastrada nesta organização — informe apenas a taxa (%) acima. Você pode cadastrar bandeiras em Configurações.
                    </p>
                  )}
                </>
              )}

            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Adicione os livros/materiais utilizados. O preço é carregado automaticamente do estoque.</p>
                <Button type="button" variant="ghost" size="sm" onClick={addMat}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {f.materials.map((l) => {
                  const it = l.itemId ? itemsById.get(l.itemId) : null;
                  const unit = it ? Number(it.average_cost ?? it.purchase_price ?? 0) : 0;
                  const qty = Number(l.qty || 0);
                  const avail = l.itemId ? (availableById.get(l.itemId) ?? 0) : 0;
                  const insufficient = qty > 0 && qty > avail;
                  return (
                    <div key={l.key} className="rounded-xl border border-border/70 bg-background/40 p-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <Select value={l.itemId ?? ""} onValueChange={(v) => updMat(l.key, { itemId: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecionar material" /></SelectTrigger>
                            <SelectContent>
                              {(stockItems.data ?? []).map((i: any) => (
                                <SelectItem key={i.id} value={i.id}>{i.name}{i.unit ? ` · ${i.unit}` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {it && (
                            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              Disponível: <span className="tabular-nums text-foreground">{avail}</span> {it.unit ?? "un"} · Custo {money(unit)}
                            </p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <Input type="number" step="1" min="0" placeholder="Qtd" value={l.qty} onChange={(e) => updMat(l.key, { qty: e.target.value })} />
                        </div>
                        <div className="md:col-span-3 flex items-center text-right text-sm tabular-nums text-muted-foreground">
                          {qty > 0 && unit > 0 ? money(unit * qty) : ""}
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          {f.materials.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => rmMat(l.key)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {insufficient && (
                        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
                          Estoque insuficiente. Disponível: {avail} {it?.unit ?? "un"}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total dos materiais</span>
                <span className="font-serif tabular-nums">{money(materialsTotal)}</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h4 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Resumo Automático · Motor Financeiro</h4>
                <div className="mt-3 space-y-1.5">
                  {calc.lines.map((l, i) => (
                    <div key={i} className={cn(
                      "flex items-center justify-between text-sm",
                      l.kind === "subtotal" && "border-t border-border pt-1.5 font-medium",
                      l.kind === "split" && "text-primary",
                    )}>
                      <span className={cn(l.kind === "out" && "text-muted-foreground")}>{l.label}</span>
                      <span className="tabular-nums">{money(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <KPI label="Receita" value={money(calc.totals.grossRevenue)} />
                <KPI label="Materiais" value={money(calc.totals.totalStock)} />
                <KPI label="Taxa cartão" value={money(calc.totals.totalCardFees)} />
                <KPI label="Lucro líquido" value={money(calc.totals.netProfit)} accent />
              </div>
              <p className="text-xs text-muted-foreground">
                Ao finalizar: a palestra é criada, o lançamento financeiro entra no Livro Razão, o estoque é baixado e a Central Financeira/Dashboard são atualizados automaticamente.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">Etapa {step} de 4</div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button type="button" variant="ghost" onClick={prevStep}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            {step < 4 ? (
              <Button type="button" variant="navy" onClick={nextStep}>
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="navy" disabled={save.isPending} onClick={() => save.mutate()}>
                <Check className="mr-1 h-4 w-4" />
                {save.isPending ? "Sincronizando…" : "Finalizar e sincronizar tudo"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initialState(today: string): WizardState {
  return {
    title: "", theme: "",
    company_id: null, contact_id: null, agent_id: null,
    project_id: null, campaign_id: null, season_id: null, speaker_id: null,
    scheduled_at: today, scheduled_time: "", expected_audience: "",
    city: "", state: "", address: "",
    gross_revenue: "", payment_method: "pix",
    card_brand_id: null, card_installments: "1", card_fee_percent: "",
    finance_status: "previsto", account_id: null,
    materials: [{ key: crypto.randomUUID(), itemId: null, qty: "" }],
    notes: "",
  };
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Cadastro" },
    { n: 2, label: "Financeiro" },
    { n: 3, label: "Materiais" },
    { n: 4, label: "Resumo" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, idx) => (
        <div key={it.n} className="flex items-center gap-2 flex-1">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
            step === it.n ? "border-primary bg-primary text-primary-foreground"
              : step > it.n ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground",
          )}>
            {step > it.n ? <Check className="h-3.5 w-3.5" /> : it.n}
          </div>
          <span className={cn("text-xs", step === it.n ? "text-foreground font-medium" : "text-muted-foreground")}>{it.label}</span>
          {idx < items.length - 1 && <div className={cn("h-px flex-1", step > it.n ? "bg-primary/40" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}

function FieldWrap({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PickField({ label, value, onChange, options }: {
  label: string; value: string | null; onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FieldWrap label={label}>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Nenhum(a)</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldWrap>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-primary/40 bg-primary/5" : "border-border bg-card")}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-serif text-lg tabular-nums", accent && "text-primary")}>{value}</div>
    </div>
  );
}
