/**
 * FASE SAAS 2 — Onboarding + Configuração da Organização.
 *
 * Toda leitura/escrita passa por `organization_id` e é protegida por RLS
 * (`private.is_org_member` para ler, `private.can_write` para escrever,
 * `private.has_org_role` para convites). O frontend apenas reflete isso.
 */

export const ONBOARDING_STEPS = [
  { key: "empresa", label: "Sua empresa", description: "Dados cadastrais e tipo de operação" },
  { key: "identidade", label: "Identidade", description: "Logo, nome exibido e cores" },
  { key: "produtos", label: "Produtos e materiais", description: "Itens usados nas operações" },
  { key: "financeiro", label: "Regras financeiras", description: "Pagamentos, taxas e divisão" },
  { key: "equipe", label: "Equipe", description: "Convites e papéis" },
  { key: "operacional", label: "Configuração operacional", description: "Módulos utilizados" },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export const OPTIONAL_STEPS: OnboardingStepKey[] = ["identidade", "produtos", "equipe"];

export const OPERATION_TYPES = [
  { value: "palestrante", label: "Palestrante individual" },
  { value: "treinamentos", label: "Empresa de treinamentos" },
  { value: "consultoria", label: "Consultoria" },
  { value: "comercial", label: "Equipe comercial" },
  { value: "outro", label: "Outro" },
];

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "debito", label: "Cartão de débito" },
  { value: "cheque", label: "Cheque" },
  { value: "transferencia", label: "Transferência" },
];

export const OPERATIONAL_MODULES = [
  { value: "crm", label: "CRM" },
  { value: "palestras", label: "Palestras" },
  { value: "estoque", label: "Estoque" },
  { value: "financeiro", label: "Financeiro" },
  { value: "agendistas", label: "Agendistas" },
  { value: "palestrantes", label: "Palestrantes" },
  { value: "temporadas", label: "Temporadas" },
  { value: "campanhas", label: "Campanhas" },
  { value: "projetos", label: "Projetos" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "relatorios", label: "Relatórios" },
  { value: "biblioteca", label: "Biblioteca" },
  { value: "agenda", label: "Agenda" },
];

/** Valores padrão do sistema quando a organização ainda não configurou nada. */
export const DEFAULT_FINANCE = {
  payment_methods: ["pix", "dinheiro", "credito", "debito", "transferencia"],
  default_card_fee_percent: 0,
  max_installments: 12,
  speaker_share: 50,
  agent_share: 50,
  tithe_percent: 10,
};

export type OrgSettings = {
  id: string;
  organization_id: string;
  legal_name: string | null;
  trade_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  description: string | null;
  operation_type: string | null;
  logo_url: string | null;
  display_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  brand_image_url: string | null;
  payment_methods: string[];
  default_card_fee_percent: number;
  max_installments: number;
  speaker_share: number;
  agent_share: number;
  tithe_percent: number;
  finance_notes: string | null;
  enabled_modules: string[];
};

export type OrgOnboarding = {
  id: string;
  organization_id: string;
  status: string;
  current_step: number;
  total_steps: number;
  completed_steps: string[];
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
};

export function computeProgress(completed: string[]) {
  const valid = ONBOARDING_STEPS.filter((s) => completed.includes(s.key)).length;
  return Math.round((valid / ONBOARDING_STEPS.length) * 100);
}
