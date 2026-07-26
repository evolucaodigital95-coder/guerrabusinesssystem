# Reestruturação Estratégica do GBS

Sem alterar identidade visual, banco de dados, regras financeiras ou relacionamentos. Nenhuma funcionalidade existente será removida — apenas realocada e/ou ocultada do menu.

## 1. Menu lateral (src/lib/modules.ts + src/routes/app.tsx)

Reorganizar seções e ordem exatamente conforme solicitado:

- **PRINCIPAL**: Dashboard
- **OPERAÇÃO**: Empresas (CRM), Palestras, Financeiro, Agendistas, Estoque, Temporadas, Campanhas, Projetos, Agenda *(nova)*
- **GESTÃO**: Indicadores *(nova, renomeada da atual "Centro de Inteligência")*, Relatórios, Metas *(nova)*, Performance *(nova)*
- **INTELIGÊNCIA**: IA Guerra, Central de Conteúdo *(rename de Biblioteca)*
- **SISTEMA**: Auditoria, Configurações

Remover do menu (rotas permanecem acessíveis por URL para não perder dados): **Hoje**, **História**, **Legado**, **Roadmap**, **Centro do Palestrante** (fica acessível por link direto no Dashboard e Financeiro).

## 2. Novas rotas

Criar arquivos vazios/wireframes funcionais usando dados reais do Supabase:

- `src/routes/app.agenda.tsx` — Painel operacional (Hoje / Amanhã / Semana / Mês) baseado em `lectures` com filtros de data. Cada card mostra empresa, cidade, contato, telefone, agendista, palestrante, status, link para abrir a palestra.
- `src/routes/app.indicadores.tsx` — Painel executivo com KPIs: Empresas Ativas, Novas Empresas (mês), Palestras, Receita, Lucro, Ticket Médio, Pessoas Impactadas, Valor em Estoque, Valor Utilizado, Saldo a Acertar (usa `supplier-accounts.ts`), Agendistas, Taxa de Conversão.
- `src/routes/app.metas.tsx` — Metas por temporada usando campos existentes em `seasons` (goal_revenue, goal_lectures etc.) + cálculo do realizado. Barras de progresso: Meta / Realizado / % / Falta.
- `src/routes/app.performance.tsx` — Rankings automáticos (Agendistas, Empresas, Cidades, Campanhas, Temporadas, Palestras) — Receita, Lucro, Pessoas, Materiais, Ticket Médio a partir de `lecture_financial_snapshots`.

## 3. Central de Conteúdo (rename da Biblioteca)

- Atualizar label em `modules.ts` e rota `src/routes/app.biblioteca.tsx` (mantém URL para não quebrar links) renderizando uma UI de repositório com categorias fixas (Slides, Livros, Propostas, Contratos, Autorizações, Modelos PDF, Identidade Visual, Logos, Fotos, Vídeos, Treinamentos, Documentos), pesquisa, filtros, favoritos e recentes. Reutiliza `attachments` (bucket `crm-attachments`) com `entity_kind='content'` — sem alterar schema.

## 4. Dashboard — atalhos rápidos

Adicionar seção "Atalhos" no topo do `app.dashboard.tsx`: Nova Empresa, Nova Palestra, Novo Lançamento, Nova Entrada de Estoque, Novo Agendista, Registrar Pagamento, Registrar Acerto com Fornecedor. Cada botão navega para o módulo com estado inicial abrindo o diálogo apropriado (via query param `?new=1`).

## 5. IA Guerra executiva

`app.ia-guerra.tsx` deixa de ser placeholder. Cria chat simples que consulta o gateway Lovable AI (Gemini) com um contexto injetado no system prompt contendo um snapshot resumido em tempo real (faturamento do mês, top empresas, saldo com fornecedor, palestras pendentes, estoque). Usa `createServerFn` para não expor chave. Escopo mínimo nesta fase — o suficiente para responder às perguntas de exemplo do briefing.

## 6. Relatórios

Reorganizar `app.relatorios.tsx` em 9 abas/categorias (Financeiro, Empresas, Palestras, Agendistas, Estoque, Fornecedores, Performance, Temporadas, Campanhas). Reaproveita `report-export.ts` (PDF/XLSX/CSV).

## Fora de escopo desta entrega

- Nenhum ajuste em `finance-engine.ts`, snapshots, triggers de auditoria ou motores existentes.
- Sem migração de banco. Metas usam colunas já existentes em `seasons`; se algum campo faltar, o card mostra "Definir meta" e link para editar a temporada (sem criar coluna nova).

## Entrega

Ao final: lista de arquivos novos/alterados, rotas criadas, confirmação de que Financeiro, Palestras, Estoque e Livro Razão não foram tocados, e verificação com build/typecheck.
