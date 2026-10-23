import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  MOVEMENT_DIRECTIONS,
  MOVEMENT_CATEGORIES,
  PAYMENT_METHODS,
  isCardPayment,
  statusOptions,
  type MovementDirection,
} from "@/lib/finance";

export type MovementRow = {
  id?: string;
  direction?: string | null;
  status?: string | null;
  category?: string | null;
  description?: string | null;
  amount?: number | string | null;
  expected_amount?: number | string | null;
  expected_date?: string | null;
  settled_at?: string | null;
  occurs_on?: string | null;
  occurs_time?: string | null;
  account_id?: string | null;
  company_id?: string | null;
  lecture_id?: string | null;
  agent_id?: string | null;
  season_id?: string | null;
  project_id?: string | null;

  payment_method?: string | null;
  card_brand_id?: string | null;
  card_installments?: number | string | null;
  card_fee_percent?: number | string | null;
  card_fee_amount?: number | string | null;
  net_amount?: number | string | null;
  notes?: string | null;
};

const NONE = "__none__";

export function MovementFormDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  initial?: MovementRow;
}) {
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const defaults: MovementRow = {
    direction: "in",
    status: "previsto",
    category: "Palestra",
    description: "",
    amount: "",
    expected_amount: "",
    expected_date: today,
    settled_at: "",
    occurs_on: today,
    occurs_time: now,
    payment_method: "pix",
    card_installments: 1,
  };
  const [f, setF] = useState<MovementRow>(initial ?? defaults);

  // Recarrega o formulário sempre que o diálogo abrir com um lançamento diferente
  // (o componente é montado uma única vez pelo pai, então useState inicial não basta).
  useEffect(() => {
    if (open) setF(initial ?? defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const queryClient = useQueryClient();
  const { emit } = useAutomation();

  const accounts = useQuery({
    queryKey: ["accounts", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, kind")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const companies = useQuery({
    queryKey: ["finance-companies-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, legal_name, trade_name")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("legal_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const lectures = useQuery({
    queryKey: ["finance-lectures-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, company_id, agent_id, season_id, project_id, campaign_id")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const agents = useQuery({
    queryKey: ["finance-agents-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const seasons = useQuery({
    queryKey: ["finance-seasons-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cardBrands = useQuery({
    queryKey: ["card-brands-select", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_brands")
        .select("id, name, kind")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const direction = (f.direction ?? "in") as MovementDirection;
  const statuses = statusOptions(direction);
  const cardPayment = direction === "in" && isCardPayment(f.payment_method);

  const save = useMutation({
    mutationFn: async () => {
      if (!f.description?.trim()) throw new Error("Descreva o lançamento.");
      const payload = {
        organization_id: organizationId,
        direction,
        status: f.status || statuses[0].key,
        category: f.category || null,
        description: f.description.trim(),
        amount: f.amount ? Number(f.amount) : null,
        expected_amount: f.expected_amount ? Number(f.expected_amount) : null,
        expected_date: f.expected_date || null,
        settled_at: f.settled_at || null,
        occurs_on: f.occurs_on || today,
        occurs_time: f.occurs_time || null,
        account_id: f.account_id || null,
        company_id: f.company_id || null,
        lecture_id: f.lecture_id || null,
        agent_id: f.agent_id || null,
        season_id: f.season_id || null,
        project_id: f.project_id || null,

        payment_method: direction === "in" ? f.payment_method || null : null,
        card_brand_id: cardPayment ? f.card_brand_id || null : null,
        card_installments: cardPayment ? Number(f.card_installments || 1) : null,
        card_fee_percent:
          cardPayment && f.card_fee_percent !== "" && f.card_fee_percent != null
            ? Number(f.card_fee_percent)
            : null,
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase
          .from("financial_movements")
          .update(payload)
          .eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_movements")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["movement", initial!.id] });
      const settled = f.status === "recebido" || f.status === "paga";
      const evt = settled
        ? direction === "in"
          ? "finance.payment.received"
          : "finance.payment.made"
        : isEdit
          ? "finance.movement.updated"
          : "finance.movement.created";
      void emit(evt, {
        entityType: "financial_movement",
        entityId: initial?.id ?? null,
        companyId: f.company_id ?? null,
        lectureId: f.lecture_id ?? null,
        agentId: f.agent_id ?? null,
        seasonId: f.season_id ?? null,
        summary: `${direction === "in" ? "Receita" : "Despesa"}: ${f.description?.trim() ?? ""}`,
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  function set<K extends keyof MovementRow>(k: K, v: MovementRow[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            Todo lançamento é registrado no Livro Razão. Nada é apagado — só arquivado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select
              value={direction}
              onValueChange={(v) => {
                const next = v as MovementDirection;
                setF((p) => ({
                  ...p,
                  direction: next,
                  status: statusOptions(next)[0].key,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_DIRECTIONS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={f.category ?? "Outros"} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? statuses[0].key} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Descrição *</Label>
            <Input
              value={f.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Valor previsto</Label>
            <Input
              type="number"
              step="0.01"
              value={f.expected_amount ?? ""}
              onChange={(e) => set("expected_amount", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{direction === "in" ? "Valor recebido" : "Valor pago"}</Label>
            <Input
              type="number"
              step="0.01"
              value={f.amount ?? ""}
              onChange={(e) => set("amount", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Conta</Label>
            <Select
              value={f.account_id ?? NONE}
              onValueChange={(v) => set("account_id", v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem conta</SelectItem>
                {(accounts.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.kind ? ` · ${a.kind}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {direction === "in" && (
            <>
              <div className="space-y-1.5">
                <Label>Forma de recebimento</Label>
                <Select
                  value={f.payment_method ?? "pix"}
                  onValueChange={(v) => set("payment_method", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {cardPayment && (
                <>
                  <div className="space-y-1.5">
                    <Label>Bandeira</Label>
                    <Select
                      value={f.card_brand_id ?? NONE}
                      onValueChange={(v) => set("card_brand_id", v === NONE ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem bandeira</SelectItem>
                        {(cardBrands.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            {b.kind ? ` · ${b.kind}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={f.card_installments ?? 1}
                      onChange={(e) => set("card_installments", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Juros / taxa do cartão (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={f.card_fee_percent ?? ""}
                      onChange={(e) => set("card_fee_percent", e.target.value)}
                      placeholder="Auto pela bandeira"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Data prevista</Label>
            <Input
              type="date"
              value={f.expected_date ?? ""}
              onChange={(e) => set("expected_date", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{direction === "in" ? "Data de recebimento" : "Data de pagamento"}</Label>
            <Input
              type="date"
              value={f.settled_at ?? ""}
              onChange={(e) => set("settled_at", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input
              type="time"
              value={f.occurs_time ?? ""}
              onChange={(e) => set("occurs_time", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select
              value={f.company_id ?? NONE}
              onValueChange={(v) => set("company_id", v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(companies.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Palestra</Label>
            <Select
              value={f.lecture_id ?? NONE}
              onValueChange={(v) => {
                if (v === NONE) {
                  set("lecture_id", null);
                  return;
                }
                const l = (lectures.data ?? []).find((x) => x.id === v);
                setF((p) => ({
                  ...p,
                  lecture_id: v,
                  company_id: p.company_id ?? l?.company_id ?? null,
                  agent_id: p.agent_id ?? l?.agent_id ?? null,
                  season_id: p.season_id ?? l?.season_id ?? null,
                  project_id: p.project_id ?? l?.project_id ?? null,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(lectures.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Empresa, agendista e temporada são preenchidos automaticamente pela palestra.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Agendista</Label>
            <Select
              value={f.agent_id ?? NONE}
              onValueChange={(v) => set("agent_id", v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(agents.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Temporada</Label>
            <Select
              value={f.season_id ?? NONE}
              onValueChange={(v) => set("season_id", v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(seasons.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
