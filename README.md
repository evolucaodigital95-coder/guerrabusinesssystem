# GBS — Guerra Business System

Sistema de gestão do Grupo Guerra para palestrantes e grupos empresariais: palestras,
CRM, agendistas, estoque, financeiro, temporadas/campanhas/projetos, metas e uma central
de inteligência com relatórios. Multi-organização (SaaS), com papéis e permissões.

_Powered by Grupo Guerra._

## Stack

- **TanStack Start** (React 19, roteamento por arquivos em `src/routes`)
- **Tailwind CSS v4** + componentes Radix/shadcn em `src/components/ui`
- **Supabase** (Lovable Cloud): banco, autenticação, storage e RLS — migrações em `supabase/migrations`
- **TanStack Query** para dados

## Rodando localmente

```bash
bun install
bun run dev
```

O app abre em `http://localhost:8080`. As variáveis do Supabase ficam em `.env`.

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `src/routes` | Telas. `app.*` = área logada, `admin.*` = painel da plataforma |
| `src/components` | Componentes por domínio (`crm`, `finance`, `estoque`, `palestras`…) e `ui` (primitivos) |
| `src/lib` | Regras de negócio, cálculos financeiros, exportações em PDF/Excel |
| `src/hooks` | Sessão, organização ativa, plano e onboarding |
| `docs/relatorios` | Relatórios das fases de desenvolvimento |

## Design

A identidade visual segue uma linguagem inspirada no Claude: fundo marfim quente, texto
grafite, **argila** (`--clay`) como cor de ação, títulos em serifa (Source Serif 4) e o
**dourado** do Grupo Guerra (`--gold`) reservado para detalhes de marca. Todos os tokens
ficam em `src/styles.css` (modo claro e escuro).

Botões de ação principal usam `variant="brand"`; painéis escuros de destaque usam `bg-ink`.
