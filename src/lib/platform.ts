/**
 * GBS PLATFORM (Fase SaaS 3)
 *
 * Camada de PLATAFORMA — separada dos dados operacionais do cliente.
 *
 *   PLATAFORMA  -> organizações, planos, assinaturas, recursos, limites, métricas
 *   CLIENTE     -> empresas, palestras, financeiro, estoque, etc.
 *
 * Nada aqui altera regras financeiras do GBS. O RLS continua sendo a camada
 * definitiva de segurança; este módulo é apenas produto/controle de acesso.
 */

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired"
  | "incomplete";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Ativa",
  past_due: "Inadimplente",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
  incomplete: "Incompleta",
};

export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  past_due: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  suspended: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  canceled: "border-muted-foreground/30 bg-muted text-muted-foreground",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  incomplete: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

/** Recursos controláveis por plano. */
export type FeatureKey =
  | "crm"
  | "contatos"
  | "agendistas"
  | "documentos"
  | "arquivo_oficial"
  | "exportacoes"
  | "palestras"
  | "financeiro"
  | "estoque"
  | "conta_corrente"
  | "relatorios"
  | "dashboard_avancado"
  | "temporadas"
  | "campanhas"
  | "projetos"
  | "fornecedores"
  | "ia_guerra"
  | "centro_operacoes"
  | "automacao"
  | "multi_usuarios"
  | "export_pdf"
  | "export_excel";

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  crm: "CRM e Empresas",
  contatos: "Contatos",
  agendistas: "Agendistas",
  documentos: "Documentos",
  arquivo_oficial: "Arquivo oficial",
  exportacoes: "Exportações",
  palestras: "Palestras",
  financeiro: "Financeiro",
  estoque: "Estoque",
  conta_corrente: "Conta Corrente",
  relatorios: "Relatórios",
  dashboard_avancado: "Dashboard avançado",
  temporadas: "Temporadas",
  campanhas: "Campanhas",
  projetos: "Projetos",
  fornecedores: "Fornecedores",
  ia_guerra: "IA Guerra",
  centro_operacoes: "Centro de Operações",
  automacao: "Automação",
  multi_usuarios: "Múltiplos usuários",
  export_pdf: "Exportação PDF",
  export_excel: "Exportação Excel",
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as FeatureKey[];

/** Limites configuráveis por plano. `null` = ilimitado. */
export type LimitKey =
  | "users"
  | "companies"
  | "contacts"
  | "lectures_per_month"
  | "agents"
  | "campaigns"
  | "projects"
  | "seasons"
  | "speakers"
  | "storage_mb"
  | "ai_requests";

export const LIMIT_LABEL: Record<LimitKey, string> = {
  users: "Usuários",
  companies: "Empresas",
  contacts: "Contatos",
  lectures_per_month: "Palestras por mês",
  agents: "Agendistas",
  campaigns: "Campanhas",
  projects: "Projetos",
  seasons: "Temporadas",
  speakers: "Palestrantes",
  storage_mb: "Armazenamento (MB)",
  ai_requests: "Requisições de IA",
};

export const LIMIT_KEYS = Object.keys(LIMIT_LABEL) as LimitKey[];

export type PlanFeatures = Partial<Record<FeatureKey, boolean>>;
export type PlanLimits = Partial<Record<LimitKey, number | null>>;

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  status: string;
  trial_days: number;
  features: PlanFeatures;
  limits: PlanLimits;
  display_order: number;
  highlight: boolean;
  is_trial_default: boolean;
  is_active?: boolean;
  slug?: string | null;
  archived_at: string | null;
};

export type Subscription = {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  period: "monthly" | "yearly" | string;
  contracted_price: number | null;
  currency: string;
  started_at: string;
  trial_ends_at: string | null;
  ends_at: string | null;
  next_renewal_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  gateway: string | null;
  gateway_customer_id: string | null;
  gateway_subscription_id: string | null;
  gateway_payment_id: string | null;
  gateway_invoice_id: string | null;
  gateway_checkout_url: string | null;
  gateway_payment_status: string | null;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  trial_started_at?: string | null;
  pending_plan_id?: string | null;
  pending_change_at?: string | null;
  cancel_requested_at?: string | null;
  cancel_effective_at?: string | null;
  limit_overrides?: PlanLimits | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

/** Limites mostrados no consumo (mesma lista validada no banco). */
export const USAGE_KEYS: LimitKey[] = [
  "users",
  "companies",
  "contacts",
  "lectures_per_month",
  "agents",
  "campaigns",
  "projects",
  "seasons",
  "storage_mb",
];

export type UsageLevel = "normal" | "aviso" | "atencao" | "limite";

/** 70% aviso · 85% atenção · 100% limite (bloqueio de novos cadastros). */
export function usageLevel(used: number, limit: number | null): UsageLevel {
  if (limit === null) return "normal";
  if (limit <= 0 || used >= limit) return "limite";
  const pct = used / limit;
  if (pct >= 0.85) return "atencao";
  if (pct >= 0.7) return "aviso";
  return "normal";
}

export const USAGE_LEVEL_LABEL: Record<UsageLevel, string> = {
  normal: "Normal",
  aviso: "Aviso",
  atencao: "Atenção",
  limite: "Limite atingido",
};

/** Estado comercial lido do banco (fonte única de verdade). */
export type CommercialState = {
  organization_id: string;
  billing_exempt: boolean;
  status: SubscriptionStatus;
  stored_status: SubscriptionStatus | null;
  subscription: Subscription | null;
  plan: Plan | null;
  pending_plan: Plan | null;
  limits: Partial<Record<LimitKey, number | null>>;
  usage: Partial<Record<LimitKey, number>>;
};

const LIMIT_NOUN: Partial<Record<LimitKey, string>> = {
  users: "usuários",
  companies: "empresas",
  contacts: "contatos",
  lectures_per_month: "palestras no mês",
  agents: "agendistas",
  campaigns: "campanhas",
  projects: "projetos",
  seasons: "temporadas",
};

/** Traduz os bloqueios comerciais do banco para linguagem de cliente. */
export function commercialErrorMessage(raw: string | null | undefined): string | null {
  if (!raw || !raw.includes("GBS_")) return null;
  const limit = raw.match(/GBS_LIMIT_REACHED:(\w+)/);
  if (limit) {
    const noun = LIMIT_NOUN[limit[1] as LimitKey] ?? "registros";
    return `Você atingiu o limite de ${noun} do seu plano. Faça upgrade para continuar.`;
  }
  const feature = raw.match(/GBS_FEATURE_UNAVAILABLE:(\w+)/);
  if (feature) {
    const label = FEATURE_LABEL[feature[1] as FeatureKey] ?? "Este recurso";
    return `${label} não está disponível no seu plano. Conheça os planos para liberar.`;
  }
  if (raw.includes("GBS_SUBSCRIPTION_BLOCKED"))
    return "Sua assinatura não permite novos cadastros no momento. Seus dados continuam guardados.";
  if (raw.includes("GBS_FORBIDDEN")) return "Você não tem autorização para esta ação.";
  return "Não foi possível concluir a operação.";
}

export const NOT_AVAILABLE = "NÃO DISPONÍVEL";

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export type SubscriptionState = {
  subscription: Subscription | null;
  plan: Plan | null;
  /** Status efetivo (trial vencido vira "expired" sem depender de job). */
  status: SubscriptionStatus;
  /** Pode usar o sistema normalmente. */
  allowed: boolean;
  /** Precisa renovar — bloqueio de acesso operacional (dados nunca são apagados). */
  blocked: boolean;
  trialDaysLeft: number | null;
  renewalDaysLeft: number | null;
  /** Aviso discreto (trial ou vencimento próximo). */
  warning: string | null;
};

const BLOCKING: SubscriptionStatus[] = ["expired", "canceled", "suspended", "incomplete"];

export function resolveSubscriptionState(
  subscription: Subscription | null,
  plan: Plan | null,
): SubscriptionState {
  if (!subscription) {
    // Sem registro de assinatura não bloqueamos ninguém: a plataforma
    // cria a assinatura no cadastro da organização.
    return {
      subscription: null,
      plan: null,
      status: "active",
      allowed: true,
      blocked: false,
      trialDaysLeft: null,
      renewalDaysLeft: null,
      warning: null,
    };
  }

  const trialDaysLeft = daysUntil(subscription.trial_ends_at);
  const renewalDaysLeft = daysUntil(subscription.next_renewal_at ?? subscription.ends_at);

  let status = subscription.status;
  if (status === "trial" && trialDaysLeft !== null && trialDaysLeft < 0) status = "expired";
  if (status === "active" && renewalDaysLeft !== null && renewalDaysLeft < -7) status = "expired";

  const blocked = BLOCKING.includes(status);

  let warning: string | null = null;
  if (status === "trial" && trialDaysLeft !== null) {
    warning =
      trialDaysLeft <= 0
        ? "Seu período de teste termina hoje."
        : `Seu período de teste termina em ${trialDaysLeft} ${trialDaysLeft === 1 ? "dia" : "dias"}.`;
  } else if (status === "past_due") {
    warning = "Existe uma pendência de pagamento na sua assinatura.";
  } else if (status === "active" && renewalDaysLeft !== null && renewalDaysLeft <= 7) {
    warning =
      renewalDaysLeft < 0
        ? "Sua assinatura está vencida e aguarda renovação."
        : `Sua assinatura será renovada em ${renewalDaysLeft} ${renewalDaysLeft === 1 ? "dia" : "dias"}.`;
  }

  return {
    subscription,
    plan,
    status,
    allowed: !blocked,
    blocked,
    trialDaysLeft,
    renewalDaysLeft,
    warning,
  };
}

/** Recurso liberado pelo plano. Sem plano definido, liberamos (fase de preparação). */
export function planAllowsFeature(plan: Plan | null, feature: FeatureKey): boolean {
  if (!plan) return true;
  const value = plan.features?.[feature];
  return value === undefined ? true : !!value;
}

export function planLimit(plan: Plan | null, limit: LimitKey): number | null {
  if (!plan) return null;
  const value = plan.limits?.[limit];
  return value === undefined ? null : value;
}

export const money = (value: number | null | undefined, currency = "BRL") =>
  value === null || value === undefined
    ? NOT_AVAILABLE
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

export const SUBSCRIPTION_EVENT_LABEL: Record<string, string> = {
  trial_started: "Trial iniciado",
  plan_changed: "Plano alterado",
  activated: "Assinatura ativada",
  renewed: "Assinatura renovada",
  canceled: "Assinatura cancelada",
  suspended: "Assinatura suspensa",
  reactivated: "Assinatura reativada",
  status_changed: "Status alterado",
  expired: "Assinatura expirada",
};
