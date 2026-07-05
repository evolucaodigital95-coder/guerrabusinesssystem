import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Calculator, ShieldCheck, FileText, History as HistoryIcon, Info, ExternalLink, Download, Filter, Wallet } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { AgentFormDialog, type AgentRow } from "@/components/agendistas/agent-form-dialog";
import { AdvanceFormDialog, type AdvanceRow } from "@/components/agendistas/advance-form-dialog";
import { RuleFormDialog, type RuleRow } from "@/components/agendistas/rule-form-dialog";
import { AgentPayoutDialog } from "@/components/agendistas/agent-payout-dialog";
import { AttachmentsTab } from "@/components/crm/attachments-tab";
import { TimelineTab } from "@/components/shared/timeline-tab";
import { ArchiveButton } from "@/components/shared/archive-button";
import { CalcBreakdown } from "@/components/finance/calc-breakdown";
import {
  buildAgentStatement, calculateLecture, selectRule, advanceStatusLabel,
  type RuleSnapshot,
} from "@/lib/finance-engine";
import { exportStatementCSV, exportStatementXLSX, exportStatementPDF, type ExportMovement } from "@/lib/agent-statement-export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agendistas/$id")({
  head: () => ({
    meta: [
      { title: "Agendista — GBS" },
      { name: "description", content: "Resumo executivo, conta corrente, adiantamentos e palestras do agendista." },
    ],
  }),
  component: AgentDetail,
});

function AgentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const [editOpen, setEditOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [editingAdv, setEditingAdv] = useState<AdvanceRow | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  // Filtros do extrato
  const [fStart, setFStart] = useState<string>("");
  const [fEnd, setFEnd] = useState<string>("");
  const [fType, setFType] = useState<string>("__all__");
  const [fFlow, setFFlow] = useState<"all" | "in" | "out">("all");
  const [fCompany, setFCompany] = useState<string>("__all__");
  const [fSeason, setFSeason] = useState<string>("__all__");
  const [fSearch, setFSearch] = useState<string>("");
  const qc = useQueryClient();

  const agent = useQuery({
    queryKey: ["agent", id],
    enabled: !!id && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, full_name, email, phone, cpf, pix_key, pix_kind, address, notes, status, created_at, updated_at")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const advances = useQuery({
    queryKey: ["advances", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select("id, amount, amount_amortized, granted_on, granted_time, source, paid_by_label, receipt_url, status, lecture_id, notes, created_at, created_by, updated_at, updated_by, lectures:lecture_id ( id, title, company_id, season_id, companies:company_id ( id, legal_name ), seasons:season_id ( id, name ) )")
        .eq("agent_id", id).is("archived_at", null)
        .order("granted_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshots = useQuery({
    queryKey: ["agent-snapshots", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecture_financial_snapshots")
        .select("id, lecture_id, agent_amount, gustavo_amount, net_profit, gross_revenue, total_expenses, total_advances, rule_snapshot, inputs, breakdown, closed_at, closed_by, lectures:lecture_id ( id, title, scheduled_at, company_id, season_id, companies:company_id ( id, legal_name ), seasons:season_id ( id, name ) )")
        .eq("agent_id", id).is("archived_at", null)
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pagamentos efetuados ao agendista (despesas categorizadas "Comissão" com agent_id)
  const payouts = useQuery({
    queryKey: ["agent-payouts", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, amount, occurs_on, occurs_time, description, status, direction, notes, lecture_id, company_id, payment_method, created_at, created_by, lectures:lecture_id ( id, title, company_id, season_id, companies:company_id ( id, legal_name ), seasons:season_id ( id, name ) ), companies:company_id ( id, legal_name )")
        .eq("agent_id", id).eq("direction", "out").in("status", ["paga", "parcial"])
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });


  const lectures = useQuery({
    queryKey: ["agent-lectures", id, organizationId],
    enabled: !!id && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at, status, gross_revenue, financial_status, closed_at, company_id, companies:company_id ( id, legal_name )")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rules = useQuery({
    queryKey: ["financial_rules", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_rules")
        .select("*").eq("organization_id", organizationId!)
        .is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["agent-audit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, entity_type, entity_id, action, diff, created_at, actor_id, profiles:actor_id ( full_name, email )")
        .or(`entity_id.eq.${id},and(entity_type.in.(advances,lecture_financial_snapshots))`)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const statement = useMemo(() => {
    if (!snapshots.data || !advances.data || !payouts.data) {
      return buildAgentStatement({ closedShares: [], advances: [], payouts: [] });
    }
    return buildAgentStatement({
      closedShares: snapshots.data.map((s) => ({
        lectureId: s.lecture_id,
        lectureTitle: (s.lectures as { title?: string } | null)?.title ?? "Palestra",
        date: s.closed_at,
        amount: Number(s.agent_amount ?? 0),
      })),
      advances: advances.data.map((a) => ({
        id: a.id, granted_on: a.granted_on, amount: Number(a.amount ?? 0),
        amount_amortized: Number(a.amount_amortized ?? 0), source: a.source, status: a.status,
      })),
      payouts: payouts.data.map((p) => ({
        id: p.id, occurs_on: p.occurs_on, amount: Number(p.amount ?? 0), description: p.description ?? undefined,
      })),
    });
  }, [snapshots.data, advances.data, payouts.data]);

  // Resolve actor names for "Ver Origem"
  const actorIds = useMemo(() => {
    const s = new Set<string>();
    (advances.data ?? []).forEach((a) => { if (a.created_by) s.add(a.created_by); if (a.updated_by) s.add(a.updated_by); });
    (snapshots.data ?? []).forEach((x) => { if (x.closed_by) s.add(x.closed_by); });
    (payouts.data ?? []).forEach((p) => { if (p.created_by) s.add(p.created_by); });
    return Array.from(s);
  }, [advances.data, snapshots.data, payouts.data]);

  const profilesMap = useQuery({
    queryKey: ["profiles-by-ids", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      if (error) throw error;
      const m = new Map<string, { full_name: string | null; email: string | null }>();
      (data ?? []).forEach((p) => m.set(p.id, { full_name: p.full_name, email: p.email }));
      return m;
    },
  });
  const actorName = (uid: string | null | undefined) => {
    if (!uid) return "Sistema";
    const p = profilesMap.data?.get(uid);
    return p?.full_name || p?.email || "Usuário";
  };

  // Extrato rico estilo bancário (cronológico, com hora e origem)
  type Movement = {
    id: string;
    date: string | null;     // ISO date
    time: string | null;     // HH:MM
    type: "Adiantamento" | "Comissão" | "Pagamento" | "Ajuste" | "Estorno";
    description: string;
    amount: number;          // signed
    companyId?: string | null;
    companyName?: string | null;
    lectureId?: string | null;
    lectureTitle?: string | null;
    seasonId?: string | null;
    seasonName?: string | null;
    origin: {
      actorId: string | null;
      createdAt: string | null;
      reason: string | null;
      docRoute?: string;
      docLabel?: string;
      extra?: { label: string; value: string }[];
    };
  };
  type LectureExpansion = {
    id?: string;
    title?: string;
    company_id?: string | null;
    season_id?: string | null;
    companies?: { id?: string; legal_name?: string } | null;
    seasons?: { id?: string; name?: string } | null;
  };
  const movements: Movement[] = useMemo(() => {
    const out: Movement[] = [];
    (advances.data ?? []).forEach((a) => {
      const lec = a.lectures as LectureExpansion | null;
      out.push({
        id: `adv-${a.id}`,
        date: a.granted_on,
        time: a.granted_time ? String(a.granted_time).slice(0, 5) : (a.created_at ? new Date(a.created_at).toTimeString().slice(0, 5) : null),
        type: "Adiantamento",
        description: `Adiantamento${a.source ? ` · ${a.source}` : ""}${a.paid_by_label ? ` · ${a.paid_by_label}` : ""}`,
        amount: -Math.abs(Number(a.amount ?? 0)),
        companyId: lec?.companies?.id ?? lec?.company_id ?? null,
        companyName: lec?.companies?.legal_name ?? null,
        lectureId: a.lecture_id ?? lec?.id ?? null,
        lectureTitle: lec?.title ?? null,
        seasonId: lec?.seasons?.id ?? lec?.season_id ?? null,
        seasonName: lec?.seasons?.name ?? null,
        origin: {
          actorId: a.created_by ?? a.updated_by ?? null,
          createdAt: a.created_at ?? null,
          reason: a.notes ?? null,
          docRoute: a.lecture_id ? `/app/palestras/${a.lecture_id}` : undefined,
          docLabel: a.lecture_id ? "Palestra vinculada" : undefined,
          extra: [
            ...(a.source ? [{ label: "Origem", value: String(a.source) }] : []),
            ...(a.receipt_url ? [{ label: "Comprovante", value: a.receipt_url }] : []),
            { label: "Status", value: advanceStatusLabel(a.status) },
          ],
        },
      });
    });
    (snapshots.data ?? []).forEach((s) => {
      const lec = s.lectures as LectureExpansion | null;
      out.push({
        id: `share-${s.id}`,
        date: s.closed_at ? s.closed_at.slice(0, 10) : null,
        time: s.closed_at ? new Date(s.closed_at).toTimeString().slice(0, 5) : null,
        type: "Comissão",
        description: `Comissão · ${lec?.title ?? "Palestra"}`,
        amount: Math.abs(Number(s.agent_amount ?? 0)),
        companyId: lec?.companies?.id ?? lec?.company_id ?? null,
        companyName: lec?.companies?.legal_name ?? null,
        lectureId: s.lecture_id ?? lec?.id ?? null,
        lectureTitle: lec?.title ?? null,
        seasonId: lec?.seasons?.id ?? lec?.season_id ?? null,
        seasonName: lec?.seasons?.name ?? null,
        origin: {
          actorId: s.closed_by ?? null,
          createdAt: s.closed_at ?? null,
          reason: `Fechamento financeiro da palestra · receita ${formatCurrency(Number(s.gross_revenue ?? 0))}`,
          docRoute: lec?.id ? `/app/palestras/${lec.id}` : undefined,
          docLabel: lec?.id ? "Abrir palestra" : undefined,
          extra: [
            { label: "Snapshot", value: s.id },
            { label: "Receita bruta", value: formatCurrency(Number(s.gross_revenue ?? 0)) },
            { label: "Lucro líquido", value: formatCurrency(Number(s.net_profit ?? 0)) },
          ],
        },
      });
    });
    (payouts.data ?? []).forEach((p) => {
      const lec = p.lectures as LectureExpansion | null;
      const co = p.companies as { id?: string; legal_name?: string } | null;
      out.push({
        id: `pay-${p.id}`,
        date: p.occurs_on,
        time: p.occurs_time ? String(p.occurs_time).slice(0, 5) : (p.created_at ? new Date(p.created_at).toTimeString().slice(0, 5) : null),
        type: "Pagamento",
        description: p.description ?? "Pagamento ao agendista",
        amount: -Math.abs(Number(p.amount ?? 0)),
        companyId: lec?.companies?.id ?? lec?.company_id ?? co?.id ?? null,
        companyName: lec?.companies?.legal_name ?? co?.legal_name ?? null,
        lectureId: p.lecture_id ?? lec?.id ?? null,
        lectureTitle: lec?.title ?? null,
        seasonId: lec?.seasons?.id ?? lec?.season_id ?? null,
        seasonName: lec?.seasons?.name ?? null,
        origin: {
          actorId: p.created_by ?? null,
          createdAt: p.created_at ?? null,
          reason: p.notes ?? null,
          docRoute: p.lecture_id ? `/app/palestras/${p.lecture_id}` : `/app/financeiro`,
          docLabel: p.lecture_id ? "Palestra vinculada" : "Abrir financeiro",
          extra: p.payment_method ? [{ label: "Forma", value: String(p.payment_method) }] : undefined,
        },
      });
    });
    // ordem cronológica ASC estável (data,hora,id) — determinística
    out.sort((a, b) => {
      const da = a.date ? new Date(`${a.date}T${a.time ?? "00:00"}:00`).getTime() : 0;
      const db = b.date ? new Date(`${b.date}T${b.time ?? "00:00"}:00`).getTime() : 0;
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
    return out;
  }, [advances.data, snapshots.data, payouts.data]);

  // Opções de filtro derivadas dos dados
  const companyOptions = useMemo(() => {
    const m = new Map<string, string>();
    movements.forEach((mv) => { if (mv.companyId && mv.companyName) m.set(mv.companyId, mv.companyName); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [movements]);
  const seasonOptions = useMemo(() => {
    const m = new Map<string, string>();
    movements.forEach((mv) => { if (mv.seasonId && mv.seasonName) m.set(mv.seasonId, mv.seasonName); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [movements]);

  const isInPeriod = (d: string | null) => {
    if (!d) return !fStart && !fEnd;
    if (fStart && d < fStart) return false;
    if (fEnd && d > fEnd) return false;
    return true;
  };
  const passesFilters = (mv: Movement) => {
    if (fType !== "__all__" && mv.type !== fType) return false;
    if (fFlow === "in" && mv.amount <= 0) return false;
    if (fFlow === "out" && mv.amount >= 0) return false;
    if (fCompany !== "__all__" && mv.companyId !== fCompany) return false;
    if (fSeason !== "__all__" && mv.seasonId !== fSeason) return false;
    if (fSearch.trim()) {
      const q = fSearch.trim().toLowerCase();
      const hay = [mv.description, mv.companyName, mv.lectureTitle, mv.type].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  // Saldo com base em TODOS os movimentos (ordem cronológica ASC)
  const movementsWithBalanceAsc = useMemo(() => {
    let running = 0;
    return movements.map((m) => { running += m.amount; return { ...m, balance: running }; });
  }, [movements]);

  // Saldo inicial do período = soma dos movimentos anteriores ao filtro
  const openingBalance = useMemo(() => {
    if (!fStart) return 0;
    return movementsWithBalanceAsc
      .filter((m) => (m.date ?? "") < fStart)
      .reduce((s, m) => s + m.amount, 0);
  }, [movementsWithBalanceAsc, fStart]);

  // Movimentos filtrados (mantém ordem ASC para cálculo do saldo acumulado do período)
  const filteredAsc = useMemo(() => {
    const asc = movementsWithBalanceAsc.filter((m) => isInPeriod(m.date) && passesFilters(m));
    let running = openingBalance;
    return asc.map((m) => { running += m.amount; return { ...m, balance: running }; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementsWithBalanceAsc, openingBalance, fStart, fEnd, fType, fFlow, fCompany, fSeason, fSearch]);

  // Para exibir na tela em ordem DESC
  const movementsWithBalance = useMemo(() => [...filteredAsc].reverse(), [filteredAsc]);

  // Totais do período filtrado
  const periodTotals = useMemo(() => {
    const credits = filteredAsc.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const debits = filteredAsc.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
    return { credits, debits, closing: openingBalance + credits - debits };
  }, [filteredAsc, openingBalance]);

  const totals = useMemo(() => {
    const credits = movements.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const debits = movements.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
    const advancesSum = movements.filter((m) => m.type === "Adiantamento").reduce((s, m) => s + Math.abs(m.amount), 0);
    const commissionsSum = movements.filter((m) => m.type === "Comissão").reduce((s, m) => s + m.amount, 0);
    const paymentsSum = movements.filter((m) => m.type === "Pagamento").reduce((s, m) => s + Math.abs(m.amount), 0);
    return { credits, debits, advances: advancesSum, commissions: commissionsSum, payments: paymentsSum };
  }, [movements]);


  const activeRule: RuleSnapshot = useMemo(() => selectRule({
    rules: (rules.data ?? []) as unknown as Parameters<typeof selectRule>[0]["rules"],
    agentId: id,
  }), [rules.data, id]);

  const saveNotes = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase.from("agents").update({ notes, updated_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notas salvas");
      qc.invalidateQueries({ queryKey: ["agent", id] });
      setNotesDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const closeLecture = useMutation({
    mutationFn: async (lectureId: string) => {
      if (!organizationId || !user) throw new Error("Sessão inválida");
      const lec = lectures.data?.find((l) => l.id === lectureId);
      if (!lec) throw new Error("Palestra não encontrada");
      const gross = Number(lec.gross_revenue ?? 0);
      if (!gross) throw new Error("Defina a receita bruta da palestra antes de fechar.");

      // despesas da palestra
      const { data: exps } = await supabase.from("financial_movements")
        .select("description, amount, occurs_on")
        .eq("lecture_id", lectureId).eq("direction", "out").is("archived_at", null);

      // adiantamentos abertos do agendista
      const { data: advs } = await supabase.from("advances")
        .select("id, amount, granted_on, source, status, amount_amortized")
        .eq("agent_id", id).is("archived_at", null).neq("status", "cancelado");

      const openAdvances = (advs ?? []).map((a) => ({
        id: a.id, amount: Math.max(0, Number(a.amount ?? 0) - Number(a.amount_amortized ?? 0)),
        granted_on: a.granted_on, source: a.source ?? null,
      })).filter((a) => a.amount > 0);

      const calc = calculateLecture({
        grossRevenue: gross,
        expenses: (exps ?? []).map((e) => ({ description: e.description, amount: Number(e.amount ?? 0), date: e.occurs_on })),
        advances: openAdvances,
        rule: activeRule,
      });

      const { error: insErr } = await supabase.from("lecture_financial_snapshots").insert({
        organization_id: organizationId,
        lecture_id: lectureId,
        agent_id: id,
        rule_id: activeRule.id ?? null,
        rule_snapshot: JSON.parse(JSON.stringify(activeRule)),
        inputs: JSON.parse(JSON.stringify({ grossRevenue: gross, expenses: exps ?? [], advances: openAdvances })),
        breakdown: JSON.parse(JSON.stringify(calc)),
        gross_revenue: gross,
        total_expenses: calc.totals.totalExpenses,
        total_advances: calc.totals.totalAdvances,
        net_profit: calc.totals.netProfit,
        gustavo_amount: calc.totals.gustavoAmount,
        agent_amount: calc.totals.agentAmount,
        closed_by: user.id,
      });
      if (insErr) throw insErr;

      // Amortiza adiantamentos
      for (const a of openAdvances) {
        const original = (advs ?? []).find((x) => x.id === a.id);
        if (!original) continue;
        const newAmortized = Number(original.amount_amortized ?? 0) + a.amount;
        const fullyAmortized = newAmortized >= Number(original.amount ?? 0);
        await supabase.from("advances").update({
          amount_amortized: newAmortized,
          status: fullyAmortized ? "abatido_total" : "abatido_parcial",
          updated_by: user.id,
        }).eq("id", a.id);
      }

      await supabase.from("lectures").update({
        financial_status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: user.id,
      }).eq("id", lectureId);
    },
    onSuccess: () => {
      toast.success("Palestra fechada financeiramente");
      qc.invalidateQueries({ queryKey: ["agent-snapshots", id] });
      qc.invalidateQueries({ queryKey: ["advances", id] });
      qc.invalidateQueries({ queryKey: ["agent-lectures", id, organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (agent.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!agent.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/agendistas" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Agendista não encontrado.</p>
      </div>
    );
  }

  const a = agent.data;

  return (
    <div className="space-y-8">
      <Link to="/app/agendistas" className="inline-flex items-center text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Agendistas
      </Link>

      <PageHeader
        eyebrow="Agendista"
        title={a.full_name}
        description={[a.email, a.phone].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <ArchiveButton table="agents" id={id} label="este agendista" listQueryKey="agents" backTo="/app/agendistas" />
            <Button variant="outline" className="rounded-full" onClick={() => { setEditingAdv(null); setAdvOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Adiantamento
            </Button>
            <Button variant="navy" className="rounded-full" onClick={() => setPayoutOpen(true)}>
              <Wallet className="mr-1.5 h-4 w-4" /> Registrar pagamento
            </Button>
          </div>
        }
      />

      {/* Resumo de conta corrente — estilo extrato bancário */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <BalanceCard
          label="Saldo Atual"
          value={statement.totals.balance}
          accent={statement.totals.balance >= 0 ? "positive" : "negative"}
          breakdown={
            <CalcBreakdown
              title="Saldo do agendista"
              subtitle="Créditos − Débitos"
              lines={[
                { label: "Comissões (lucros)", amount: totals.commissions, kind: "in" },
                { label: "Adiantamentos entregues", amount: -totals.advances, kind: "out" },
                { label: "Pagamentos efetuados", amount: -totals.payments, kind: "out" },
                { label: "Saldo", amount: statement.totals.balance, kind: "subtotal" },
              ]}
            />
          }
        />
        <BalanceCard label="Créditos" value={totals.credits} accent="positive" />
        <BalanceCard label="Débitos" value={totals.debits} accent="negative" />
        <BalanceCard label="Comissões" value={totals.commissions} accent="muted" />
        <BalanceCard label="Adiantamentos" value={totals.advances} accent="muted" />
        <BalanceCard label="Pagamentos" value={totals.payments} accent="muted" />
        <BalanceCard
          label="Dízimo sugerido acumulado"
          value={statement.totals.titheAccumulated}
          accent="muted"
          hint="10% sobre comissões — informativo, não abate saldo."
        />
      </div>


      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/40">
          <TabsTrigger value="overview">Dados</TabsTrigger>
          <TabsTrigger value="statement">Conta Corrente</TabsTrigger>
          <TabsTrigger value="advances">Adiantamentos</TabsTrigger>
          <TabsTrigger value="lectures">Palestras</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
          <TabsTrigger value="audit">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard label="CPF" value={a.cpf ?? "—"} />
            <InfoCard label="Status" value={<Badge variant={a.status === "ativo" ? "secondary" : "outline"} className="capitalize">{a.status ?? "ativo"}</Badge>} />
            <InfoCard label="Telefone" value={a.phone ?? "—"} />
            <InfoCard label="E-mail" value={a.email ?? "—"} />
            <InfoCard label="PIX" value={a.pix_key ? `${a.pix_kind ?? "—"} · ${a.pix_key}` : "—"} />
            <InfoCard label="Endereço" value={a.address ?? "—"} />
            <InfoCard label="Cadastrado em" value={formatDate(a.created_at)} />
          </div>
        </TabsContent>

        <TabsContent value="statement">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Extrato cronológico</p>
              <p className="mt-1 font-serif text-lg text-foreground">Conta Corrente do Agendista</p>
            </div>
            <Button variant="navy" size="sm" className="rounded-full" onClick={() => { setEditingAdv(null); setAdvOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo adiantamento
            </Button>
          </div>
          {movementsWithBalance.length === 0 ? (
            <Empty title="Sem movimentações" subtitle="Adiantamentos, comissões e pagamentos aparecerão aqui automaticamente." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Hora</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Descrição</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="px-4 py-3 text-right font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsWithBalance.map((m) => (
                    <tr key={m.id} className="border-t border-border/70 hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(m.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{m.time ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-normal">{m.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{m.description}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", m.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {m.amount >= 0 ? "+" : "−"} {formatCurrency(Math.abs(m.amount))}
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", m.balance >= 0 ? "text-foreground" : "text-rose-600")}>
                        {formatCurrency(m.balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs">
                              <Info className="mr-1 h-3.5 w-3.5" /> Ver Origem
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80 text-xs">
                            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Origem do movimento</p>
                            <dl className="space-y-1.5">
                              <Row label="Lançado por" value={actorName(m.origin.actorId)} />
                              <Row label="Lançado em" value={m.origin.createdAt ? formatDate(m.origin.createdAt) + " · " + new Date(m.origin.createdAt).toTimeString().slice(0, 5) : "—"} />
                              <Row label="Tipo" value={m.type} />
                              {m.origin.reason && <Row label="Motivo" value={m.origin.reason} />}
                              {m.origin.extra?.map((x) => (<Row key={x.label} label={x.label} value={x.value} />))}
                            </dl>
                            {m.origin.docRoute && (
                              <Link to={m.origin.docRoute} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--gold)] hover:underline">
                                <ExternalLink className="h-3.5 w-3.5" /> {m.origin.docLabel ?? "Documento relacionado"}
                              </Link>
                            )}
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3 w-3" /> Nenhum movimento é apagado. Alterações ficam registradas na aba Histórico.
              </p>
            </div>
          )}
        </TabsContent>



        <TabsContent value="advances" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => { setEditingAdv(null); setAdvOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo adiantamento
            </Button>
          </div>
          {(advances.data ?? []).length === 0 ? (
            <Empty title="Sem adiantamentos" subtitle="Todo adiantamento entra na conta corrente automaticamente." />
          ) : (
            <div className="grid gap-3">
              {(advances.data ?? []).map((adv) => {
                const remaining = Number(adv.amount ?? 0) - Number(adv.amount_amortized ?? 0);
                return (
                  <div key={adv.id} className="rounded-2xl border border-border bg-card/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{adv.source ?? "Outro"}</p>
                        <p className="mt-1 font-serif text-xl text-foreground tabular-nums">{formatCurrency(Number(adv.amount ?? 0))}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(adv.granted_on)}{adv.granted_time ? ` · ${adv.granted_time.slice(0,5)}` : ""}
                          {adv.paid_by_label ? ` · pago por ${adv.paid_by_label}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="font-normal">{advanceStatusLabel(adv.status)}</Badge>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Restam {formatCurrency(remaining)}</p>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingAdv(adv as AdvanceRow); setAdvOpen(true); }}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                      </div>
                    </div>
                    {adv.notes && <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">{adv.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lectures" className="space-y-4">
          {(snapshots.data ?? []).length > 0 && (
            <div>
              <h4 className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Palestras fechadas</h4>
              <div className="grid gap-3">
                {(snapshots.data ?? []).map((s) => {
                  const lec = s.lectures as { title?: string; scheduled_at?: string } | null;
                  const breakdown = s.breakdown as ReturnType<typeof calculateLecture>;
                  return (
                    <div key={s.id} className="rounded-2xl border border-border bg-card/40 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-serif text-lg text-foreground">{lec?.title ?? "Palestra"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Fechada em {formatDate(s.closed_at)} · Receita {formatCurrency(Number(s.gross_revenue ?? 0))}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Agendista</p>
                            <p className="font-serif text-xl text-[var(--gold)] tabular-nums">{formatCurrency(Number(s.agent_amount ?? 0))}</p>
                          </div>
                          <CalcBreakdown
                            title={lec?.title ?? "Cálculo"}
                            subtitle={`Regra: ${(s.rule_snapshot as RuleSnapshot)?.name ?? "—"}`}
                            lines={breakdown?.lines ?? []}
                            footer={<>Snapshot congelado em {formatDate(s.closed_at)}.</>}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Palestras em aberto</h4>
            {(lectures.data ?? []).filter((l) => l.financial_status !== "closed").length === 0 ? (
              <Empty title="Nenhuma palestra em aberto" subtitle="Quando uma palestra for cadastrada, o fechamento financeiro aparece aqui." />
            ) : (
              <div className="grid gap-3">
                {(lectures.data ?? []).filter((l) => l.financial_status !== "closed").map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-5">
                    <div>
                      <p className="font-medium text-foreground">{l.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(l.scheduled_at)}
                        {(l.companies as { legal_name?: string } | null)?.legal_name
                          ? ` · ${(l.companies as { legal_name?: string }).legal_name}`
                          : ""}
                        {l.gross_revenue ? ` · Receita ${formatCurrency(Number(l.gross_revenue))}` : " · sem receita definida"}
                      </p>
                    </div>
                    <Button
                      variant="navy" size="sm" className="rounded-full"
                      onClick={() => closeLecture.mutate(l.id)}
                      disabled={closeLecture.isPending || !l.gross_revenue}
                    >
                      <Calculator className="mr-1.5 h-4 w-4" /> Fechar e calcular
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="companies" className="space-y-4">
          <AgentCompaniesTab agentId={id} />
        </TabsContent>

        <TabsContent value="timeline">
          {organizationId && user && (
            <TimelineTab entityType="agent" entityId={id} organizationId={organizationId} userId={user.id} />
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Regra vigente para este agendista</p>
              <p className="mt-1 font-serif text-xl text-foreground">{activeRule.name ?? "—"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pct(activeRule.gustavo_share)} Gustavo · {pct(activeRule.agent_share)} Agendista · Taxa {pct(activeRule.fee_percent)}
                {activeRule.fee_fixed ? ` + ${formatCurrency(activeRule.fee_fixed)}` : ""}
              </p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => { setEditingRule(null); setRuleOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova regra
            </Button>
          </div>
          {(rules.data ?? []).length === 0 ? (
            <Empty title="Nenhuma regra cadastrada" subtitle="Crie a primeira regra para parametrizar a divisão de lucros." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nome</th>
                    <th className="px-4 py-3 text-left font-medium">Escopo</th>
                    <th className="px-4 py-3 text-right font-medium">Gustavo</th>
                    <th className="px-4 py-3 text-right font-medium">Agendista</th>
                    <th className="px-4 py-3 text-right font-medium">Taxa</th>
                    <th className="px-4 py-3 text-left font-medium">Vigência</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(rules.data ?? []).map((r) => (
                    <tr key={r.id} className="border-t border-border/70">
                      <td className="px-4 py-3 text-foreground">
                        {r.name}{r.is_default ? <Badge variant="secondary" className="ml-2 font-normal">padrão</Badge> : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{r.scope}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(Number(r.gustavo_share))}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(Number(r.agent_share))}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {pct(Number(r.fee_percent))}{Number(r.fee_fixed) ? ` + ${formatCurrency(Number(r.fee_fixed))}` : ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.effective_from)}{r.effective_to ? ` → ${formatDate(r.effective_to)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingRule(r as RuleRow); setRuleOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <Label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Notas privadas</Label>
            <Textarea
              rows={10}
              className="mt-3"
              value={notesDraft ?? a.notes ?? ""}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Anote contexto, combinados e particularidades do agendista."
            />
            <div className="mt-3 flex justify-end gap-2">
              {notesDraft !== null && (
                <Button variant="ghost" onClick={() => setNotesDraft(null)}>Descartar</Button>
              )}
              <Button
                variant="navy"
                disabled={notesDraft === null || saveNotes.isPending}
                onClick={() => saveNotes.mutate(notesDraft ?? "")}
              >
                <FileText className="mr-1.5 h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attachments">
          {organizationId && user && (
            <AttachmentsTab
              entityType="agent" entityId={id}
              organizationId={organizationId} userId={user.id}
            />
          )}
        </TabsContent>

        <TabsContent value="audit">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Trilha completa — nada é apagado
            </p>
            {(audit.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {(audit.data ?? []).map((ev) => {
                  const profile = ev.profiles as { full_name?: string; email?: string } | null;
                  const diff = ev.diff as { changes?: Record<string, { old: unknown; new: unknown }> } | null;
                  return (
                    <li key={ev.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm text-foreground">
                          <HistoryIcon className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                          <span className="capitalize">{ev.action}</span> · {ev.entity_type}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {profile?.full_name ?? profile?.email ?? "Sistema"} · {formatDate(ev.created_at)}
                        </p>
                      </div>
                      {diff?.changes && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {Object.entries(diff.changes).map(([key, v]) => (
                            <li key={key} className="text-muted-foreground">
                              <span className="text-foreground">{key}:</span> <span className="line-through opacity-60">{String(v.old ?? "—")}</span> → {String(v.new ?? "—")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <>
          <AgentFormDialog
            open={editOpen} onOpenChange={setEditOpen}
            organizationId={organizationId} userId={user.id}
            initial={a as AgentRow}
          />
          <AdvanceFormDialog
            open={advOpen} onOpenChange={(v) => { setAdvOpen(v); if (!v) setEditingAdv(null); }}
            organizationId={organizationId} userId={user.id} agentId={id}
            initial={editingAdv ?? undefined}
          />
          <RuleFormDialog
            open={ruleOpen} onOpenChange={(v) => { setRuleOpen(v); if (!v) setEditingRule(null); }}
            organizationId={organizationId} userId={user.id} agentId={id}
            initial={editingRule ?? undefined}
          />
        </>
      )}
    </div>
  );
}

function BalanceCard({ label, value, accent, breakdown }: { label: string; value: number; accent?: "positive" | "negative" | "muted"; breakdown?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        {breakdown}
      </div>
      <p className={cn(
        "mt-3 font-serif text-2xl tabular-nums",
        accent === "positive" && "text-emerald-600",
        accent === "negative" && "text-rose-600",
        accent === "muted" && "text-muted-foreground",
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isUrl = /^https?:\/\//i.test(value);
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground break-words">
        {isUrl ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">abrir</a>
        ) : value}
      </dd>
    </div>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle: string }) {

  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-12 text-center">
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/* ---------------- Empresas atendidas pelo agendista ---------------- */

type AgentLectureRow = {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  gross_revenue: number | null;
  company_id: string | null;
  companies: { id: string; legal_name: string } | null;
};

function AgentCompaniesTab({ agentId }: { agentId: string }) {
  const list = useQuery({
    queryKey: ["agent-companies", agentId],
    queryFn: async (): Promise<AgentLectureRow[]> => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at, status, gross_revenue, company_id, companies:company_id ( id, legal_name )")
        .eq("agent_id", agentId).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentLectureRow[];
    },
  });

  const map = new Map<string, { id: string; name: string; lectures: number; revenue: number; lastAt: string | null }>();
  for (const l of list.data ?? []) {
    const cid = l.companies?.id ?? l.company_id;
    if (!cid) continue;
    const cur = map.get(cid) ?? { id: cid, name: l.companies?.legal_name ?? "Empresa", lectures: 0, revenue: 0, lastAt: null };
    cur.lectures += 1;
    cur.revenue += Number(l.gross_revenue ?? 0);
    if (!cur.lastAt || (l.scheduled_at && l.scheduled_at > cur.lastAt)) cur.lastAt = l.scheduled_at;
    map.set(cid, cur);
  }
  const rows = Array.from(map.values()).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  if (list.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (rows.length === 0) {
    return <Empty title="Sem empresas atendidas" subtitle="Quando você vincular palestras deste agendista a empresas, elas aparecerão aqui." />;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Empresa</th>
            <th className="px-4 py-3 text-right font-medium">Palestras</th>
            <th className="px-4 py-3 text-right font-medium">Receita</th>
            <th className="px-4 py-3 text-left font-medium">Última palestra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/70 hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link to="/app/crm/$id" params={{ id: r.id }} className="font-medium text-foreground hover:underline">
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.lectures}</td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(r.revenue)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(r.lastAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pct(v: number | null | undefined) {
  return `${Math.round((Number(v ?? 0)) * 1000) / 10}%`;
}
