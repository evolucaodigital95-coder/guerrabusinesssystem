import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Calculator, ShieldCheck, FileText, History as HistoryIcon, Info, ExternalLink, Download, Filter, Wallet, Trash2, Archive } from "lucide-react";
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
import { AgentDocuments } from "@/components/agendistas/agent-documents";
import { AccountClosing, type ClosingSource } from "@/components/agendistas/account-closing";
import { LectureFormDialog, type LectureRow } from "@/components/palestras/lecture-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

import { AttachmentsTab } from "@/components/crm/attachments-tab";
import { TimelineTab } from "@/components/shared/timeline-tab";
import { ArchiveButton } from "@/components/shared/archive-button";
import { CalcBreakdown } from "@/components/finance/calc-breakdown";
import {
  buildAgentStatement, calculateLecture, selectRule, advanceStatusLabel,
  type RuleSnapshot,
} from "@/lib/finance-engine";
import { useDocBrand } from "@/hooks/use-doc-brand";
import { exportStatementCSV, exportStatementXLSX, exportStatementPDF, type ExportContext, type ExportMovement, type CardEntry } from "@/lib/agent-statement-export";
import { paymentMethodLabel } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { openDoc } from "@/lib/doc-links";

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
  const { organizationId, organizationName } = useCurrentOrg();
  const [editOpen, setEditOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [editingAdv, setEditingAdv] = useState<AdvanceRow | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [lectureEditOpen, setLectureEditOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<LectureRow | null>(null);
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
        .select("id, lecture_id, agent_amount, gustavo_amount, net_profit, gross_revenue, total_expenses, total_advances, total_card_fees, total_stock_cost, rule_snapshot, inputs, breakdown, closed_at, closed_by, lectures:lecture_id ( id, title, scheduled_at, company_id, season_id, companies:company_id ( id, legal_name ), seasons:season_id ( id, name ) )")
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
        .select("id, title, theme, scheduled_at, scheduled_time, city, state, status, gross_revenue, financial_status, closed_at, company_id, contact_id, agent_id, season_id, campaign_id, project_id, expected_audience, actual_audience, notes, companies:company_id ( id, legal_name )")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * TODOS os cartões lançados nas palestras do agendista — de todas as empresas.
   * Inclui lançamentos sem foto, com bandeira, parcelas, juros e valor líquido,
   * além dos comprovantes anexados (assinados e convertidos para o PDF).
   */
  const cards = useQuery({
    queryKey: ["agent-cards", id, organizationId],
    enabled: !!id && !!organizationId,
    queryFn: async (): Promise<CardEntry[]> => {
      const { data: lecs, error: lecErr } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at, company_id, companies:company_id ( legal_name )")
        .eq("organization_id", organizationId!)
        .eq("agent_id", id)
        .is("archived_at", null);
      if (lecErr) throw lecErr;
      const lectureIds = (lecs ?? []).map((l) => l.id);
      const lecById = new Map((lecs ?? []).map((l) => [l.id, l]));

      const filters = [`agent_id.eq.${id}`];
      if (lectureIds.length) filters.push(`lecture_id.in.(${lectureIds.join(",")})`);

      const { data: movs, error } = await supabase
        .from("financial_movements")
        .select(
          "id, lecture_id, company_id, amount, net_amount, occurs_on, description, status, payment_method, card_installments, card_fee_amount, card_fee_percent, card_brands:card_brand_id ( name ), companies:company_id ( legal_name ), lectures:lecture_id ( id, title, scheduled_at, companies:company_id ( legal_name ) )",
        )
        .eq("organization_id", organizationId!)
        .not("card_brand_id", "is", null)
        .is("archived_at", null)
        .or(filters.join(","))
        .order("occurs_on", { ascending: true });
      if (error) throw error;

      const rows = movs ?? [];
      if (!rows.length) return [];

      // Comprovantes (fotos) dos cartões
      const movIds = rows.map((m) => m.id);
      const { data: atts } = await supabase
        .from("attachments")
        .select("entity_id, file_name, mime_type, storage_path, size_bytes, created_at")
        .eq("entity_type", "financial_movement")
        .in("entity_id", movIds)
        .is("archived_at", null)
        .order("created_at", { ascending: true });

      const paths = (atts ?? []).map((a) => a.storage_path);
      const signed = paths.length
        ? (await supabase.storage.from("crm-attachments").createSignedUrls(paths, 60 * 60)).data ?? []
        : [];
      const urlByPath = new Map<string, string>();
      signed.forEach((s, i) => { if (s?.signedUrl) urlByPath.set(paths[i], s.signedUrl); });

      const toDataUrl = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        } catch { return null; }
      };
      const isImage = (mime: string | null | undefined, name: string) =>
        (mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name ?? "");

      const photosByMov = new Map<string, CardEntry["photos"]>();
      for (const a of atts ?? []) {
        const url = urlByPath.get(a.storage_path) ?? null;
        const dataUrl = isImage(a.mime_type, a.file_name ?? "") && url ? await toDataUrl(url) : null;
        const arr = photosByMov.get(a.entity_id) ?? [];
        arr.push({
          fileName: a.file_name ?? "comprovante",
          mimeType: a.mime_type,
          sizeBytes: a.size_bytes,
          createdAt: a.created_at,
          dataUrl,
          url,
          source: "attachment",
        });
        photosByMov.set(a.entity_id, arr);
      }

      return rows.map((m) => {
        const lec = (m.lectures as { id?: string; title?: string; scheduled_at?: string; companies?: { legal_name?: string } } | null)
          ?? (m.lecture_id ? (lecById.get(m.lecture_id) as unknown as { title?: string; scheduled_at?: string; companies?: { legal_name?: string } } | undefined) ?? null : null);
        const company =
          lec?.companies?.legal_name
          ?? (m.companies as { legal_name?: string } | null)?.legal_name
          ?? "Sem empresa";
        const amount = Number(m.amount ?? 0);
        const fee = m.card_fee_amount != null ? Number(m.card_fee_amount) : null;
        return {
          date: m.occurs_on ?? lec?.scheduled_at ?? null,
          company,
          lecture: lec?.title ?? null,
          brand: (m.card_brands as { name?: string } | null)?.name ?? "Cartão",
          method: paymentMethodLabel(m.payment_method),
          installments: m.card_installments ?? 1,
          amount,
          feePercent: m.card_fee_percent != null ? Number(m.card_fee_percent) : null,
          feeAmount: fee,
          netAmount: m.net_amount != null ? Number(m.net_amount) : fee != null ? amount - fee : null,
          status: m.status ?? null,
          description: m.description ?? null,
          photos: photosByMov.get(m.id),
        } satisfies CardEntry;
      });
    },
  });

  /** Cartões filtrados pelo período/empresa selecionados na tela. */
  const cardEntries = useMemo(() => {
    return (cards.data ?? []).filter((c) => {
      const d = c.date ? c.date.slice(0, 10) : null;
      if (fStart && (!d || d < fStart)) return false;
      if (fEnd && (!d || d > fEnd)) return false;
      return true;
    });
  }, [cards.data, fStart, fEnd]);


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
      // Transparência: o que foi deduzido antes da divisão (juros do cartão inclusive)
      const bdTotals = ((s.breakdown ?? {}) as {
        totals?: {
          totalStock?: number; totalMaterials?: number; totalCardFees?: number;
          fee?: number; totalTaxes?: number; totalCosts?: number; totalOtherExpenses?: number;
        };
      }).totals ?? {};
      const cardFeesValue = Number(
        bdTotals.totalCardFees ?? (s.total_card_fees != null ? Number(s.total_card_fees) : 0),
      );
      const materialsValue = Number(bdTotals.totalStock ?? bdTotals.totalMaterials ?? s.total_stock_cost ?? 0);
      const ruleFeeValue = Number(bdTotals.fee ?? 0);
      const otherValue =
        Number(bdTotals.totalTaxes ?? 0) + Number(bdTotals.totalCosts ?? 0) + Number(bdTotals.totalOtherExpenses ?? 0);
      out.push({
        id: `share-${s.id}`,
        date: s.closed_at ? s.closed_at.slice(0, 10) : null,
        time: s.closed_at ? new Date(s.closed_at).toTimeString().slice(0, 5) : null,
        type: "Comissão",
        description:
          `Comissão · ${lec?.title ?? "Palestra"}` +
          (cardFeesValue > 0 ? ` · juros do cartão −${formatCurrency(cardFeesValue)}` : " · sem juros de cartão"),
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
          reason:
            `Fechamento financeiro da palestra · receita ${formatCurrency(Number(s.gross_revenue ?? 0))}` +
            ` · juros do cartão descontados ${formatCurrency(cardFeesValue)}`,
          docRoute: lec?.id ? `/app/palestras/${lec.id}` : undefined,
          docLabel: lec?.id ? "Abrir palestra" : undefined,
          extra: [
            { label: "Snapshot", value: s.id },
            { label: "Receita bruta", value: formatCurrency(Number(s.gross_revenue ?? 0)) },
            { label: "Materiais/estoque (−)", value: formatCurrency(materialsValue) },
            { label: "Juros do cartão (−)", value: formatCurrency(cardFeesValue) },
            ...(ruleFeeValue ? [{ label: "Taxa de regra (−)", value: formatCurrency(ruleFeeValue) }] : []),
            ...(otherValue ? [{ label: "Outros custos (−)", value: formatCurrency(otherValue) }] : []),
            { label: "Lucro líquido", value: formatCurrency(Number(s.net_profit ?? 0)) },
            { label: "Parte do agendista", value: formatCurrency(Number(s.agent_amount ?? 0)) },
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
          docRoute: p.lecture_id ? `/app/palestras/${p.lecture_id}` : `/app/financeiro/${p.id}`,
          docLabel: p.lecture_id ? "Palestra vinculada" : "Abrir lançamento",
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

  const invalidateLectures = () => {
    qc.invalidateQueries({ queryKey: ["agent-lectures", id, organizationId] });
    qc.invalidateQueries({ queryKey: ["agent-snapshots", id] });
    qc.invalidateQueries({ queryKey: ["finance-lectures"] });
    qc.invalidateQueries({ queryKey: ["lectures"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
  };

  const archiveLecture = useMutation({
    mutationFn: async (lectureId: string) => {
      if (!user) throw new Error("Sessão inválida");
      const { error } = await supabase.from("lectures")
        .update({ archived_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", lectureId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Palestra arquivada"); invalidateLectures(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao arquivar"),
  });

  const deleteLecture = useMutation({
    mutationFn: async (lectureId: string) => {
      const { count } = await supabase
        .from("lecture_financial_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("lecture_id", lectureId);
      if ((count ?? 0) > 0) {
        throw new Error("Esta palestra já tem fechamento financeiro. Arquive em vez de excluir.");
      }
      await supabase.from("financial_movements").update({ lecture_id: null }).eq("lecture_id", lectureId);
      await supabase.from("advances").update({ lecture_id: null }).eq("lecture_id", lectureId);
      await supabase.from("stock_movements").update({ lecture_id: null }).eq("lecture_id", lectureId);
      const { error } = await supabase.from("lectures").delete().eq("id", lectureId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Palestra excluída definitivamente"); invalidateLectures(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir"),
  });

  // Exclusão de palestra FECHADA (duplicidade): remove o snapshot de fechamento
  // junto, desvincula movimentos e apaga a palestra.
  const deleteClosedLecture = useMutation({
    mutationFn: async (lectureId: string) => {
      const { error: snapErr } = await supabase
        .from("lecture_financial_snapshots").delete().eq("lecture_id", lectureId);
      if (snapErr) throw snapErr;
      await supabase.from("financial_movements").update({ lecture_id: null }).eq("lecture_id", lectureId);
      await supabase.from("advances").update({ lecture_id: null }).eq("lecture_id", lectureId);
      await supabase.from("stock_movements").update({ lecture_id: null }).eq("lecture_id", lectureId);
      const { error } = await supabase.from("lectures").delete().eq("id", lectureId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Palestra e fechamento excluídos"); invalidateLectures(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir"),
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

  /** Exclui definitivamente um movimento do extrato (adiantamento ou pagamento). */
  const deleteMovement = useMutation({
    mutationFn: async (movementId: string) => {
      if (movementId.startsWith("adv-")) {
        const advId = movementId.slice(4);
        const { error } = await supabase.from("advances").delete().eq("id", advId);
        if (error) throw error;
        return;
      }
      if (movementId.startsWith("pay-")) {
        const payId = movementId.slice(4);
        const { error } = await supabase.from("financial_movements").delete().eq("id", payId);
        if (error) throw error;
        return;
      }
      throw new Error(
        "Comissões vêm do fechamento da palestra. Reabra a palestra para recalcular o valor.",
      );
    },
    onSuccess: () => {
      toast.success("Movimento excluído do extrato");
      qc.invalidateQueries({ queryKey: ["advances", id] });
      qc.invalidateQueries({ queryKey: ["agent-payouts", id] });
      qc.invalidateQueries({ queryKey: ["agent-snapshots", id] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });



  /**
   * Composição dos créditos a partir dos snapshots reais.
   * Fonte única para o extrato (PDF/Excel/CSV) e para o Termo de Fechamento.
   */
  const creditsComposition = useMemo(() => {
    return (snapshots.data ?? [])
      .filter((s) => {
        if (!fStart && !fEnd) return true;
        const d = s.closed_at ? s.closed_at.slice(0, 10) : null;
        if (fStart && (!d || d < fStart)) return false;
        if (fEnd && (!d || d > fEnd)) return false;
        return true;
      })
      .map((s) => {
        const lec = s.lectures as { title?: string; scheduled_at?: string; companies?: { legal_name?: string } } | null;
        type BreakdownLine = { label: string; amount: number; kind: string; hint?: string };
        const bd = (s.breakdown ?? {}) as {
          totals?: {
            totalStock?: number; totalMaterials?: number;
            totalCardFees?: number; fee?: number;
            totalTaxes?: number; totalCosts?: number; totalOtherExpenses?: number;
          };
          lines?: BreakdownLine[];
        };
        const t = bd.totals ?? {};
        const materials = t.totalStock ?? t.totalMaterials ?? (s.total_stock_cost != null ? Number(s.total_stock_cost) : null);
        const snapCardFees = s.total_card_fees != null ? Number(s.total_card_fees) : null;
        const cardFees = t.totalCardFees ?? snapCardFees;
        const ruleFee = t.fee ?? null;
        const otherCosts =
          (t.totalTaxes ?? 0) + (t.totalCosts ?? 0) + (t.totalOtherExpenses ?? 0) || null;

        const expenseLines = (bd.lines ?? [])
          .filter((ln) => ln.kind === "out" && Number(ln.amount) < 0)
          .map((ln) => {
            const lbl = String(ln.label ?? "");
            let category: "materials" | "cardFees" | "ruleFee" | "tax" | "cost" | "expense" = "expense";
            if (/juros|cart[aã]o/i.test(lbl)) category = "cardFees";
            else if (/taxa de regra|taxa da regra/i.test(lbl)) category = "ruleFee";
            else if (/material|estoque/i.test(lbl)) category = "materials";
            else if (/imposto|taxa/i.test(lbl)) category = "tax";
            else if (/custo/i.test(lbl)) category = "cost";
            return { label: lbl, amount: Math.abs(Number(ln.amount || 0)), category };
          });

        const agentShare = Number(s.agent_amount ?? 0);
        return {
          company: lec?.companies?.legal_name ?? "—",
          lecture: lec?.title ?? "Palestra",
          date: lec?.scheduled_at ?? s.closed_at ?? null,
          grossRevenue: Number(s.gross_revenue ?? 0),
          materials,
          cardFees,
          ruleFee,
          fees: (cardFees ?? 0) + (ruleFee ?? 0) || null,
          otherCosts,
          netProfit: Number(s.net_profit ?? 0),
          agentShare,
          tithe: Math.round(agentShare * 10) / 100,
          expenseLines,
        };
      });
  }, [snapshots.data, fStart, fEnd]);

  const advancesRows = useMemo(() => {
    return (advances.data ?? [])
      .filter((a) => {
        if (!fStart && !fEnd) return true;
        const d = a.granted_on;
        if (fStart && (!d || d < fStart)) return false;
        if (fEnd && (!d || d > fEnd)) return false;
        return true;
      })
      .map((a) => ({
        date: a.granted_on,
        amount: Number(a.amount ?? 0),
        source: a.source ?? null,
        lecture: (a.lectures as { title?: string } | null)?.title ?? null,
        notes: a.notes ?? null,
      }));
  }, [advances.data, fStart, fEnd]);

  /**
   * Fotografia dos valores JÁ APURADOS para o Termo de Fechamento.
   * Não recalcula nada — apenas consolida o que o motor financeiro produziu.
   */
  const buildClosingSource = (): ClosingSource => {
    const periodLabel = fStart || fEnd ? `${fStart || "início"} → ${fEnd || "hoje"}` : "Período completo";
    const comp = creditsComposition;
    const sum = (pick: (c: (typeof comp)[number]) => number | null | undefined) =>
      comp.reduce((acc, c) => acc + Number(pick(c) ?? 0), 0);

    const agentShare = sum((c) => c.agentShare);
    return {
      agentId: id,
      agentName: agent.data?.full_name ?? "Agendista",
      organizationName: organizationName ?? "Grupo Guerra",
      seasonId: fSeason !== "__all__" ? fSeason : null,
      seasonName: fSeason !== "__all__" ? seasonOptions.find((s) => s.id === fSeason)?.name ?? null : null,
      periodLabel,
      periodStart: fStart || null,
      periodEnd: fEnd || null,
      responsible: user?.email ?? "Grupo Guerra",
      totals: {
        companies: new Set(comp.map((c) => c.company)).size,
        lectures: comp.length,
        revenue: sum((c) => c.grossRevenue),
        materials: sum((c) => c.materials),
        fees: sum((c) => (c.cardFees ?? 0) + (c.ruleFee ?? 0)),
        expenses: sum((c) => c.otherCosts),
        netProfit: sum((c) => c.netProfit),
        agentShare,
        tithe: Math.round(agentShare * 10) / 100,
        advances: advancesRows.reduce((acc, a) => acc + a.amount, 0),
        credits: periodTotals.credits,
        debits: periodTotals.debits,
        openingBalance,
        finalBalance: periodTotals.closing,
      },
      movements: filteredAsc.map((m) => ({
        date: m.date, time: m.time, type: m.type, description: m.description,
        company: m.companyName ?? null, lecture: m.lectureTitle ?? null,
        credit: m.amount > 0 ? m.amount : 0,
        debit: m.amount < 0 ? Math.abs(m.amount) : 0,
        balance: m.balance,
      })),
      lectures: comp.map((c) => ({
        date: c.date,
        company: c.company,
        lecture: c.lecture,
        revenue: c.grossRevenue,
        materials: c.materials,
        fees: (c.cardFees ?? 0) + (c.ruleFee ?? 0) || null,
        netProfit: c.netProfit,
        agentShare: c.agentShare,
      })),
      advances: advancesRows,
      cards: cardEntries,
    };
  };


  const getDocBrand = useDocBrand();
  const downloadStatement = async (fmt: "pdf" | "xlsx" | "csv") => {
    const agentName = agent.data?.full_name ?? "Agendista";
    const periodLabel = fStart || fEnd ? `${fStart || "início"} → ${fEnd || "hoje"}` : "Completo";
    const rows: ExportMovement[] = filteredAsc.map((m) => ({
      date: m.date, time: m.time, type: m.type, description: m.description,
      company: m.companyName ?? null, lecture: m.lectureTitle ?? null,
      credit: m.amount > 0 ? m.amount : 0, debit: m.amount < 0 ? Math.abs(m.amount) : 0,
      balance: m.balance,
    }));

    // Resultado por empresa (créditos do período)
    const companyMap = new Map<string, number>();
    filteredAsc.forEach((m) => {
      if (m.amount > 0) {
        const key = m.companyName ?? "Sem empresa";
        companyMap.set(key, (companyMap.get(key) ?? 0) + m.amount);
      }
    });
    const companySummary = Array.from(companyMap.entries())
      .map(([company, amount]) => ({ company, amount }))
      .sort((a, b) => b.amount - a.amount);

    const payoutsRows = (payouts.data ?? [])
      .filter((p) => {
        if (!fStart && !fEnd) return true;
        const d = p.occurs_on;
        if (fStart && (!d || d < fStart)) return false;
        if (fEnd && (!d || d > fEnd)) return false;
        return true;
      })
      .map((p) => ({
        date: p.occurs_on,
        amount: Number(p.amount ?? 0),
        method: p.payment_method ?? null,
        description: p.description ?? null,
      }));

    const filters: { label: string; value: string }[] = [];
    if (fStart || fEnd) filters.push({ label: "Período", value: `${fStart || "início"} → ${fEnd || "hoje"}` });
    if (fType !== "__all__") filters.push({ label: "Tipo", value: fType });
    if (fFlow !== "all") filters.push({ label: "Fluxo", value: fFlow === "in" ? "Créditos" : "Débitos" });
    if (fCompany !== "__all__") {
      const c = companyOptions.find((x) => x.id === fCompany);
      if (c) filters.push({ label: "Empresa", value: c.name });
    }
    if (fSeason !== "__all__") {
      const s = seasonOptions.find((x) => x.id === fSeason);
      if (s) filters.push({ label: "Temporada", value: s.name });
    }
    if (fSearch.trim()) filters.push({ label: "Busca", value: fSearch.trim() });

    // Comprovantes (anexos das palestras + receipt_url dos adiantamentos) — só no PDF
    type ReceiptItem = {
      fileName: string; mimeType?: string | null; sizeBytes?: number | null;
      createdAt?: string | null; dataUrl?: string | null; url?: string | null;
      source?: "attachment" | "advance";
    };
    type ReceiptGroup = { company: string; lecture?: string | null; date?: string | null; items: ReceiptItem[] };
    let receipts: ReceiptGroup[] | undefined;

    if (fmt === "pdf") {
      try {
        const lecturesInPeriod = (snapshots.data ?? [])
          .filter((s) => {
            if (!fStart && !fEnd) return true;
            const d = s.closed_at ? s.closed_at.slice(0, 10) : null;
            if (fStart && (!d || d < fStart)) return false;
            if (fEnd && (!d || d > fEnd)) return false;
            return true;
          })
          .map((s) => {
            const lec = s.lectures as { id?: string; title?: string; scheduled_at?: string; companies?: { legal_name?: string } } | null;
            return {
              lectureId: lec?.id ?? null,
              company: lec?.companies?.legal_name ?? "—",
              lecture: lec?.title ?? "Palestra",
              date: lec?.scheduled_at ?? s.closed_at ?? null,
            };
          })
          .filter((x) => !!x.lectureId) as { lectureId: string; company: string; lecture: string; date: string | null }[];

        const lectureIds = Array.from(new Set(lecturesInPeriod.map((x) => x.lectureId)));

        // Busca anexos vinculados às palestras
        const { data: atts } = lectureIds.length
          ? await supabase
              .from("attachments")
              .select("id, entity_id, file_name, mime_type, storage_path, size_bytes, created_at")
              .eq("entity_type", "lecture")
              .in("entity_id", lectureIds)
              .is("archived_at", null)
              .order("created_at", { ascending: true })
          : { data: [] as Array<{ entity_id: string; file_name: string; mime_type: string | null; storage_path: string; size_bytes: number | null; created_at: string }> };

        // Cria URLs assinadas em lote
        const paths = (atts ?? []).map((a) => a.storage_path);
        const signed = paths.length
          ? (await supabase.storage.from("crm-attachments").createSignedUrls(paths, 60 * 60)).data ?? []
          : [];
        const urlByPath = new Map<string, string>();
        signed.forEach((s, i) => { if (s?.signedUrl) urlByPath.set(paths[i], s.signedUrl); });

        // Converte imagens em data URLs (para embutir no PDF)
        const toDataUrl = async (url: string): Promise<string | null> => {
          try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const blob = await res.blob();
            return await new Promise<string | null>((resolve) => {
              const r = new FileReader();
              r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
              r.onerror = () => resolve(null);
              r.readAsDataURL(blob);
            });
          } catch { return null; }
        };

        const isImage = (mime: string | null | undefined, name: string) =>
          (mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name ?? "");

        const itemsByLecture = new Map<string, ReceiptItem[]>();
        for (const a of atts ?? []) {
          const url = urlByPath.get(a.storage_path) ?? null;
          const img = isImage(a.mime_type, a.file_name ?? "");
          const dataUrl = img && url ? await toDataUrl(url) : null;
          const arr = itemsByLecture.get(a.entity_id) ?? [];
          arr.push({
            fileName: a.file_name ?? "arquivo",
            mimeType: a.mime_type,
            sizeBytes: a.size_bytes,
            createdAt: a.created_at,
            dataUrl,
            url,
            source: "attachment",
          });
          itemsByLecture.set(a.entity_id, arr);
        }

        // Comprovantes de TODOS os lançamentos das palestras do período (cartões, PIX, recibos, etc.)
        if (lectureIds.length) {
          const { data: cardMovs } = await supabase
            .from("financial_movements")
            .select(
              "id, lecture_id, amount, occurs_on, description, payment_method, card_installments, card_fee_amount, card_brands:card_brand_id ( name )",
            )
            .in("lecture_id", lectureIds)
            .is("archived_at", null);

          const movIds = (cardMovs ?? []).map((m) => m.id);
          if (movIds.length) {
            const { data: cardAtts } = await supabase
              .from("attachments")
              .select("id, entity_id, file_name, mime_type, storage_path, size_bytes, created_at")
              .eq("entity_type", "financial_movement")
              .in("entity_id", movIds)
              .is("archived_at", null)
              .order("created_at", { ascending: true });

            const cardPaths = (cardAtts ?? []).map((a) => a.storage_path);
            const cardSigned = cardPaths.length
              ? (await supabase.storage.from("crm-attachments").createSignedUrls(cardPaths, 60 * 60)).data ?? []
              : [];
            const cardUrlByPath = new Map<string, string>();
            cardSigned.forEach((s, i) => { if (s?.signedUrl) cardUrlByPath.set(cardPaths[i], s.signedUrl); });

            const movById = new Map((cardMovs ?? []).map((m) => [m.id, m]));
            for (const a of cardAtts ?? []) {
              const mov = movById.get(a.entity_id);
              if (!mov?.lecture_id) continue;
              const url = cardUrlByPath.get(a.storage_path) ?? null;
              const img = isImage(a.mime_type, a.file_name ?? "");
              const dataUrl = img && url ? await toDataUrl(url) : null;
              const brand = (mov.card_brands as { name?: string } | null)?.name ?? null;
              const parcels = mov.card_installments ? `${mov.card_installments}x` : "à vista";
              const label = brand
                ? `Cartão ${brand} · ${parcels} · ${formatCurrency(Number(mov.amount ?? 0))}`
                : `${mov.payment_method ? String(mov.payment_method).toUpperCase() : "Comprovante"} · ${mov.description ?? "Lançamento"} · ${formatCurrency(Number(mov.amount ?? 0))}`;
              const arr = itemsByLecture.get(mov.lecture_id) ?? [];
              arr.push({
                fileName: label,
                mimeType: a.mime_type,
                sizeBytes: a.size_bytes,
                createdAt: a.created_at,
                dataUrl,
                url,
                source: "attachment",
              });
              itemsByLecture.set(mov.lecture_id, arr);
            }
          }
        }



        // Comprovantes de adiantamentos (receipt_url — link externo)
        const advWithReceipt = (advances.data ?? []).filter((a) =>
          !!a.receipt_url &&
          (!fStart || (a.granted_on && a.granted_on >= fStart)) &&
          (!fEnd || (a.granted_on && a.granted_on <= fEnd))
        );

        // Monta grupos por palestra
        const groups: ReceiptGroup[] = lecturesInPeriod
          .map((l) => {
            const items = itemsByLecture.get(l.lectureId) ?? [];
            // Adiantamentos ligados a esta palestra
            const advItems: ReceiptItem[] = advWithReceipt
              .filter((a) => (a as { lecture_id?: string }).lecture_id === l.lectureId)
              .map((a) => ({
                fileName: `Adiantamento · ${formatCurrency(Number(a.amount ?? 0))}`,
                mimeType: "link/external",
                createdAt: a.granted_on,
                url: a.receipt_url,
                source: "advance",
              }));
            return { company: l.company, lecture: l.lecture, date: l.date, items: [...items, ...advItems] };
          })
          .filter((g) => g.items.length > 0);

        // Adiantamentos avulsos (sem palestra) com comprovante
        const looseAdv = advWithReceipt.filter((a) => !(a as { lecture_id?: string }).lecture_id);
        if (looseAdv.length) {
          groups.push({
            company: "Adiantamentos avulsos",
            lecture: null,
            date: null,
            items: looseAdv.map((a) => ({
              fileName: `Adiantamento · ${formatCurrency(Number(a.amount ?? 0))}`,
              mimeType: "link/external",
              createdAt: a.granted_on,
              url: a.receipt_url,
              source: "advance",
            })),
          });
        }

        // Documentos do agendista (PIX, contratos, recibos externos)
        {
          const { data: docs } = await supabase
            .from("agent_documents")
            .select("id, title, doc_type, doc_date, file_name, mime_type, storage_path, size_bytes, created_at")
            .eq("agent_id", id)
            .is("archived_at", null)
            .order("created_at", { ascending: true });

          const docPaths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
          const docSigned = docPaths.length
            ? (await supabase.storage.from("crm-attachments").createSignedUrls(docPaths, 60 * 60)).data ?? []
            : [];
          const docUrlByPath = new Map<string, string>();
          docSigned.forEach((s, i) => { if (s?.signedUrl) docUrlByPath.set(docPaths[i], s.signedUrl); });

          const docItems: ReceiptItem[] = [];
          for (const d of docs ?? []) {
            if (fStart && d.doc_date && d.doc_date < fStart) continue;
            if (fEnd && d.doc_date && d.doc_date > fEnd) continue;
            const url = d.storage_path ? docUrlByPath.get(d.storage_path) ?? null : null;
            const img = isImage(d.mime_type, d.file_name ?? "");
            const dataUrl = img && url ? await toDataUrl(url) : null;
            docItems.push({
              fileName: `${d.title ?? d.file_name ?? "Documento"}${d.doc_type ? ` · ${d.doc_type}` : ""}`,
              mimeType: d.mime_type,
              sizeBytes: d.size_bytes,
              createdAt: d.doc_date ?? d.created_at,
              dataUrl,
              url,
              source: "attachment",
            });
          }
          if (docItems.length) {
            groups.push({ company: "Documentos do agendista", lecture: null, date: null, items: docItems });
          }
        }

        if (groups.length) receipts = groups;
      } catch (e) {
        // Não bloqueia a exportação em caso de falha ao carregar comprovantes
        console.warn("Falha ao carregar comprovantes:", e);
      }
    }

    const ctx: ExportContext = {
      agentName,
      teamName: null as string | null,
      periodLabel,
      emittedAt: new Date().toLocaleString("pt-BR"),
      documentId: `GBS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${agentName.slice(0, 3).toUpperCase()}`,
      openingBalance,
      totalCredits: periodTotals.credits,
      totalDebits: periodTotals.debits,
      closingBalance: periodTotals.closing,
      titheAccumulated: statement.totals.titheAccumulated,
      movements: rows,
      companySummary,
      creditsComposition,
      advances: advancesRows,
      payouts: payoutsRows,
      filters: filters.length ? filters : undefined,
      receipts,
      cards: cardEntries.length ? cardEntries : undefined,
    };

    // Validação matemática — não mascarar divergência
    const expectedClosing = ctx.openingBalance + ctx.totalCredits - ctx.totalDebits;
    if (Math.abs(expectedClosing - ctx.closingBalance) > 0.01) {
      toast.error(`Divergência: saldo final calculado ${formatCurrency(expectedClosing)} ≠ exibido ${formatCurrency(ctx.closingBalance)}`);
      return;
    }

    try {
      ctx.brand = await getDocBrand();
      if (fmt === "csv") exportStatementCSV(ctx);
      else if (fmt === "xlsx") exportStatementXLSX(ctx);
      else await exportStatementPDF(ctx);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    }
  };



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

        <TabsContent value="statement" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Extrato cronológico</p>
              <p className="mt-1 font-serif text-lg text-foreground">Conta Corrente do Agendista</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setEditingAdv(null); setAdvOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> Adiantamento
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setPayoutOpen(true)}>
                <Wallet className="mr-1.5 h-4 w-4" /> Registrar pagamento
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="navy" size="sm" className="rounded-full">
                    <Download className="mr-1.5 h-4 w-4" /> Baixar extrato
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => downloadStatement("pdf")}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadStatement("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadStatement("csv")}>CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </div>
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-7">
              <div><Label className="text-[10px] uppercase">De</Label><Input type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} /></div>
              <div><Label className="text-[10px] uppercase">Até</Label><Input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></div>
              <div>
                <Label className="text-[10px] uppercase">Tipo</Label>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="Comissão">Comissão</SelectItem>
                    <SelectItem value="Adiantamento">Adiantamento</SelectItem>
                    <SelectItem value="Pagamento">Pagamento</SelectItem>
                    <SelectItem value="Ajuste">Ajuste</SelectItem>
                    <SelectItem value="Estorno">Estorno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Fluxo</Label>
                <Select value={fFlow} onValueChange={(v) => setFFlow(v as "all" | "in" | "out")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in">Créditos</SelectItem>
                    <SelectItem value="out">Débitos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Empresa</Label>
                <Select value={fCompany} onValueChange={setFCompany}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {companyOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Temporada</Label>
                <Select value={fSeason} onValueChange={setFSeason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {seasonOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] uppercase">Buscar</Label><Input placeholder="Descrição, palestra…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} /></div>
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <div>
                Saldo inicial: <strong className="text-foreground tabular-nums">{formatCurrency(openingBalance)}</strong> ·
                Créditos período: <strong className="text-emerald-600 tabular-nums">{formatCurrency(periodTotals.credits)}</strong> ·
                Débitos período: <strong className="text-rose-600 tabular-nums">{formatCurrency(periodTotals.debits)}</strong> ·
                Saldo final: <strong className="text-foreground tabular-nums">{formatCurrency(periodTotals.closing)}</strong>
              </div>
              <button
                type="button"
                className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                onClick={() => { setFStart(""); setFEnd(""); setFType("__all__"); setFFlow("all"); setFCompany("__all__"); setFSeason("__all__"); setFSearch(""); }}
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {movementsWithBalance.length === 0 ? (
            <Empty title="Sem movimentações no período" subtitle="Ajuste os filtros ou registre adiantamentos, comissões e pagamentos." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Hora</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Descrição</th>
                    <th className="px-4 py-3 text-left font-medium">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium">Palestra</th>
                    <th className="px-4 py-3 text-right font-medium">Crédito</th>
                    <th className="px-4 py-3 text-right font-medium">Débito</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="px-4 py-3 text-right font-medium">Origem</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>

                  </tr>
                </thead>
                <tbody>
                  {movementsWithBalance.map((m) => (
                    <tr key={m.id} className="border-t border-border/70 hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(m.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{m.time ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="font-normal">{m.type}</Badge></td>
                      <td className="px-4 py-3 text-foreground">{m.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.companyName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.lectureTitle ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{m.amount > 0 ? formatCurrency(m.amount) : ""}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{m.amount < 0 ? formatCurrency(Math.abs(m.amount)) : ""}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", m.balance >= 0 ? "text-foreground" : "text-rose-600")}>{formatCurrency(m.balance)}</td>
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
                              {m.companyName && <Row label="Empresa" value={m.companyName} />}
                              {m.lectureTitle && <Row label="Palestra" value={m.lectureTitle} />}
                              {m.origin.reason && <Row label="Motivo" value={m.origin.reason} />}
                              {m.origin.extra?.map((x) => (<Row key={x.label} label={x.label} value={x.value} />))}
                            </dl>
                            {m.origin.docRoute && (
                              <button
                                type="button"
                                onClick={() => openDoc(navigate, m.origin.docRoute)}
                                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--gold)] hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> {m.origin.docLabel ?? "Documento relacionado"}
                              </button>
                            )}
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.id.startsWith("share-") ? (
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Fechamento</span>
                        ) : (
                          <ConfirmDialog
                            title="Excluir movimento?"
                            description={`"${m.description}" (${formatCurrency(Math.abs(m.amount))}) será removido definitivamente do extrato e o saldo será recalculado.`}
                            confirmLabel="Excluir"
                            destructive
                            pending={deleteMovement.isPending}
                            onConfirm={() => deleteMovement.mutate(m.id)}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs text-rose-600 hover:text-rose-700">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
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

          <div className="border-t border-border pt-6">
            <AccountClosing agentId={id} userId={user?.id ?? ""} source={buildClosingSource} />
          </div>

          <div className="border-t border-border pt-6">
            <AgentDocuments agentId={id} userId={user?.id ?? ""} />
          </div>
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
                          {s.lecture_id && (
                            <Link
                              to="/app/palestras/$id" params={{ id: s.lecture_id }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Abrir / editar
                            </Link>
                          )}
                          {s.lecture_id && (
                            <ConfirmDialog
                              title="Excluir palestra fechada?"
                              description={<>A palestra <strong>{lec?.title ?? ""}</strong> e o fechamento financeiro dela serão apagados definitivamente. Use para remover duplicidades. Esta ação não pode ser desfeita.</>}
                              confirmLabel="Excluir definitivamente"
                              destructive
                              pending={deleteClosedLecture.isPending}
                              onConfirm={() => deleteClosedLecture.mutateAsync(s.lecture_id!).then(() => undefined)}
                              trigger={
                                <button className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-600 transition-colors hover:bg-rose-50">
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                                </button>
                              }
                            />
                          )}
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
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline" size="sm" className="rounded-full"
                        onClick={() => {
                          setEditingLecture({
                            id: l.id, title: l.title, theme: l.theme, company_id: l.company_id,
                            contact_id: l.contact_id, agent_id: l.agent_id, season_id: l.season_id,
                            campaign_id: l.campaign_id, project_id: l.project_id, city: l.city, state: l.state,
                            scheduled_at: l.scheduled_at, scheduled_time: l.scheduled_time,
                            expected_audience: l.expected_audience, actual_audience: l.actual_audience,
                            status: l.status, gross_revenue: l.gross_revenue, notes: l.notes,
                          });
                          setLectureEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        variant="navy" size="sm" className="rounded-full"
                        onClick={() => closeLecture.mutate(l.id)}
                        disabled={closeLecture.isPending || !l.gross_revenue}
                      >
                        <Calculator className="mr-1.5 h-4 w-4" /> Fechar e calcular
                      </Button>
                      <ConfirmDialog
                        title="Arquivar esta palestra?"
                        description="Ela some das listas, mas o histórico financeiro e a auditoria são preservados."
                        confirmLabel="Arquivar"
                        pending={archiveLecture.isPending}
                        onConfirm={() => archiveLecture.mutate(l.id)}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-muted-foreground">
                            <Archive className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        title="Excluir definitivamente?"
                        description="A palestra será apagada. Lançamentos do razão ligados a ela ficam sem vínculo. Não é possível excluir palestras já fechadas financeiramente."
                        confirmLabel="Excluir"
                        destructive
                        pending={deleteLecture.isPending}
                        onConfirm={() => deleteLecture.mutate(l.id)}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
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
          <AgentPayoutDialog
            open={payoutOpen} onOpenChange={setPayoutOpen}
            organizationId={organizationId} userId={user.id}
            agentId={id} agentName={a.full_name}
            maxAmount={Math.max(0, statement.totals.balance)}
          />
          <LectureFormDialog
            open={lectureEditOpen}
            onOpenChange={(v) => { setLectureEditOpen(v); if (!v) setEditingLecture(null); }}
            organizationId={organizationId}
            userId={user.id}
            initial={editingLecture ?? undefined}
          />


        </>
      )}
    </div>
  );
}

function BalanceCard({ label, value, accent, breakdown, hint }: { label: string; value: number; accent?: "positive" | "negative" | "muted"; breakdown?: React.ReactNode; hint?: string }) {
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
      {hint && <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{hint}</p>}
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
