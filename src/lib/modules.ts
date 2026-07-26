import {
  LayoutDashboard,
  Users,
  Mic,
  Wallet,
  CalendarRange,
  Package,
  Sun,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Settings,
  UserCog,
  Briefcase,
  Megaphone,
  BrainCircuit,
  CalendarClock,
  Target,
  Trophy,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  emptyMessage: string;
  primaryAction: string;
  section: "principal" | "operação" | "gestão" | "inteligência" | "sistema";
}

export const MODULES: ModuleDef[] = [
  // PRINCIPAL
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "principal",
    description: "Indicadores e performance em tempo real.",
    emptyMessage: "Conecte fontes de dados para visualizar seus indicadores.",
    primaryAction: "Configurar fontes" },

  // OPERAÇÃO
  { to: "/app/crm", label: "Empresas", icon: Users, section: "operação",
    description: "Empresas, contatos e relacionamento comercial.",
    emptyMessage: "Nenhuma empresa cadastrada.",
    primaryAction: "Nova Empresa" },
  { to: "/app/palestras", label: "Palestras", icon: Mic, section: "operação",
    description: "Agenda, propostas e produção das palestras.",
    emptyMessage: "Você ainda não cadastrou nenhuma palestra nesta temporada. Clique em Nova Palestra para começar.",
    primaryAction: "Nova Palestra" },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, section: "operação",
    description: "Lançamentos, recebimentos e fluxo de caixa.",
    emptyMessage: "Nenhum lançamento por aqui. Crie um novo lançamento para iniciar.",
    primaryAction: "Novo Lançamento" },
  { to: "/app/agendistas", label: "Agendistas", icon: UserCog, section: "operação",
    description: "Equipe de prospecção e agendamentos.",
    emptyMessage: "Nenhum agendista cadastrado ainda.",
    primaryAction: "Novo Agendista" },
  { to: "/app/estoque", label: "Estoque", icon: Package, section: "operação",
    description: "Materiais, kits e itens em movimento.",
    emptyMessage: "Seu estoque está vazio. Cadastre o primeiro item.",
    primaryAction: "Novo Item" },
  { to: "/app/temporadas", label: "Temporadas", icon: CalendarRange, section: "operação",
    description: "Ciclos comerciais e metas por período.",
    emptyMessage: "Você ainda não criou uma temporada. Crie sua primeira temporada.",
    primaryAction: "Nova Temporada" },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone, section: "operação",
    description: "Iniciativas comerciais por temporada.",
    emptyMessage: "Nenhuma campanha cadastrada ainda.",
    primaryAction: "Nova Campanha" },
  { to: "/app/projetos", label: "Projetos", icon: Briefcase, section: "operação",
    description: "Projetos estratégicos por campanha/temporada.",
    emptyMessage: "Nenhum projeto cadastrado ainda.",
    primaryAction: "Novo Projeto" },
  { to: "/app/agenda", label: "Agenda", icon: CalendarClock, section: "operação",
    description: "Painel operacional dos compromissos por período.",
    emptyMessage: "Nenhum compromisso encontrado no período selecionado.",
    primaryAction: "Nova Palestra" },

  // GESTÃO
  { to: "/app/inteligencia", label: "Indicadores", icon: BarChart3, section: "gestão",
    description: "Painel executivo com KPIs consolidados em tempo real.",
    emptyMessage: "Cadastre dados operacionais para alimentar os indicadores.",
    primaryAction: "Atualizar" },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3, section: "gestão",
    description: "Análises consolidadas e exportações.",
    emptyMessage: "Nenhum relatório gerado ainda.",
    primaryAction: "Gerar Relatório" },
  { to: "/app/metas", label: "Metas", icon: Target, section: "gestão",
    description: "Objetivos por temporada e progresso realizado.",
    emptyMessage: "Defina metas nas temporadas para acompanhar o progresso.",
    primaryAction: "Definir metas" },
  { to: "/app/performance", label: "Performance", icon: Trophy, section: "gestão",
    description: "Rankings automáticos por agendista, empresa, cidade e temporada.",
    emptyMessage: "Registre palestras finalizadas para gerar rankings.",
    primaryAction: "Atualizar rankings" },

  // INTELIGÊNCIA
  { to: "/app/ia-guerra", label: "IA Guerra", icon: Sparkles, section: "inteligência",
    description: "Assistente executivo com dados reais do GBS.",
    emptyMessage: "A IA Guerra está pronta para começar. Faça sua primeira pergunta.",
    primaryAction: "Nova conversa" },
  { to: "/app/biblioteca", label: "Central de Conteúdo", icon: FolderOpen, section: "inteligência",
    description: "Repositório organizado — slides, livros, propostas, contratos e mídia.",
    emptyMessage: "Nenhum conteúdo cadastrado. Adicione o primeiro arquivo.",
    primaryAction: "Novo conteúdo" },

  // SISTEMA
  { to: "/app/auditoria", label: "Auditoria", icon: ShieldCheck, section: "sistema",
    description: "Trilha de eventos e segurança.",
    emptyMessage: "Nenhum evento registrado.",
    primaryAction: "Filtrar eventos" },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings, section: "sistema",
    description: "Preferências da conta e do sistema.",
    emptyMessage: "Configure sua experiência GBS.",
    primaryAction: "Editar preferências" },
];

export const SUN_ICON = Sun;
