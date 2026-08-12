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
  | "expired";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Ativa",
  past_due: "Inadimplente",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
};

export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  past_due: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  suspended: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  canceled: "border-muted-foreground/30 bg-muted text-muted-foreground",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Recursos controláveis por plano. */
export type FeatureKey =
  | "crm"
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
  crm: "CRM",
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
  | "lectures_per_month"
  | "agents"
  | "speakers"
  | "storage_mb"
  | "ai_requests";

export const LIMIT_LABEL: Record<LimitKey, string> = {
  users: "Usuários",
  companies: "Empresas",
  lectures_per_month: "Palestras por mês",
  agents: "Agendistas",
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
  price_monthly: number;
  price_yearly: number;
  currency: string;
  status: string;
  trial_days: number;
  features: PlanFeatures;
  limits: PlanLimits;
  display_order: number;
  highlight: boolean;
  is_trial_default: boolean;
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
};

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

const BLOCKING: SubscriptionStatus[] = ["expired", "canceled", "suspended"];

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
