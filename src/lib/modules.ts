import {
  Home,
  LayoutDashboard,
  Users,
  Building2,
  Mic,
  Wallet,
  CalendarRange,
  Package,
  Sun,
  BarChart3,
  Map,
  Sparkles,
  BookOpen,
  Crown,
  Library,
  ShieldCheck,
  Settings,
  Search,
  UserCog,
  Briefcase,
  Megaphone,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  emptyMessage: string;
  primaryAction: string;
  section: "principal" | "preparação" | "comercial" | "operação" | "financeiro" | "estratégia" | "sistema";
}

export const MODULES: ModuleDef[] = [
  // PRINCIPAL
  { to: "/app/hoje", label: "Hoje", icon: Home, section: "principal",
    description: "Sua visão executiva do dia.",
    emptyMessage: "Nada por aqui ainda. Comece adicionando suas primeiras informações.",
    primaryAction: "Nova ação" },
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "principal",
    description: "Indicadores e performance em tempo real.",
    emptyMessage: "Conecte fontes de dados para visualizar seus indicadores.",
    primaryAction: "Configurar fontes" },

  // PREPARAÇÃO
  { to: "/app/temporadas", label: "Temporadas", icon: CalendarRange, section: "preparação",
    description: "Ciclos comerciais e metas por período.",
    emptyMessage: "Você ainda não criou uma temporada. Crie sua primeira temporada.",
    primaryAction: "Nova Temporada" },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone, section: "preparação",
    description: "Iniciativas comerciais por temporada.",
    emptyMessage: "Nenhuma campanha cadastrada ainda.",
    primaryAction: "Nova Campanha" },
  { to: "/app/projetos", label: "Projetos", icon: Briefcase, section: "preparação",
    description: "Projetos estratégicos por campanha/temporada.",
    emptyMessage: "Nenhum projeto cadastrado ainda.",
    primaryAction: "Novo Projeto" },
  { to: "/app/agendistas", label: "Agendistas", icon: UserCog, section: "preparação",
    description: "Equipe de prospecção e agendamentos.",
    emptyMessage: "Nenhum agendista cadastrado ainda.",
    primaryAction: "Novo Agendista" },
  { to: "/app/estoque", label: "Estoque", icon: Package, section: "preparação",
    description: "Materiais, kits e itens em movimento.",
    emptyMessage: "Seu estoque está vazio. Cadastre o primeiro item.",
    primaryAction: "Novo Item" },

  // COMERCIAL
  { to: "/app/crm", label: "CRM", icon: Users, section: "comercial",
    description: "Leads, oportunidades e relacionamento.",
    emptyMessage: "Você ainda não cadastrou nenhum lead. Clique em Novo Lead para começar.",
    primaryAction: "Novo Lead" },
  { to: "/app/crm", label: "Empresas", icon: Building2, section: "comercial",
    description: "Empresas cadastradas no CRM.",
    emptyMessage: "Nenhuma empresa cadastrada.",
    primaryAction: "Nova Empresa" },

  // OPERAÇÃO
  { to: "/app/palestras", label: "Palestras", icon: Mic, section: "operação",
    description: "Agenda, propostas e produção das palestras.",
    emptyMessage: "Você ainda não cadastrou nenhuma palestra nesta temporada. Clique em Nova Palestra para começar.",
    primaryAction: "Nova Palestra" },

  // FINANCEIRO
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, section: "financeiro",
    description: "Lançamentos, recebimentos e fluxo de caixa.",
    emptyMessage: "Nenhum lançamento por aqui. Crie um novo lançamento para iniciar.",
    primaryAction: "Novo Lançamento" },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3, section: "financeiro",
    description: "Análises consolidadas e exportações.",
    emptyMessage: "Nenhum relatório gerado ainda.",
    primaryAction: "Gerar Relatório" },

  // ESTRATÉGIA
  { to: "/app/inteligencia", label: "Centro de Inteligência", icon: BrainCircuit, section: "estratégia",
    description: "BI executivo — indicadores, rankings e gráficos em tempo real.",
    emptyMessage: "Cadastre dados operacionais para alimentar a inteligência.",
    primaryAction: "Atualizar" },
  { to: "/app/roadmap", label: "Roadmap", icon: Map, section: "estratégia",
    description: "Plano de evolução e iniciativas estratégicas.",
    emptyMessage: "Comece desenhando seu roadmap.",
    primaryAction: "Nova iniciativa" },
  { to: "/app/ia-guerra", label: "IA Guerra", icon: Sparkles, section: "estratégia",
    description: "Inteligência aplicada aos negócios do Grupo.",
    emptyMessage: "A IA Guerra está pronta para começar. Faça sua primeira pergunta.",
    primaryAction: "Nova conversa" },
  { to: "/app/historia", label: "História", icon: BookOpen, section: "estratégia",
    description: "Linha do tempo e marcos da jornada.",
    emptyMessage: "Sua história está esperando para ser contada.",
    primaryAction: "Novo marco" },
  { to: "/app/legado", label: "Legado", icon: Crown, section: "estratégia",
    description: "Princípios, valores e o que fica.",
    emptyMessage: "Registre os pilares do seu legado.",
    primaryAction: "Novo pilar" },
  { to: "/app/biblioteca", label: "Biblioteca", icon: Library, section: "estratégia",
    description: "Conteúdos, documentos e referências.",
    emptyMessage: "Sua biblioteca está vazia. Adicione o primeiro conteúdo.",
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
