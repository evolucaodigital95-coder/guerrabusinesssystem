# GBS — Fase Final: Centro de Operações

Data: 2026-08-02 · Versão 1.1 (build 2026.08)

## 1. Objetivo da fase
Transformar a Home/Dashboard em um **Centro de Operações** que responde, em uma tela:
como está a empresa, o que fazer hoje, quais riscos e oportunidades existem e o que está pendente.
Nenhum módulo novo, nenhuma regra financeira alterada, nenhuma migração de banco.

## 2. Funcionalidades revisadas
- Dashboard (`/app/dashboard`), Home (`/app/`), Hoje, Agenda, Financeiro, Estoque,
  Fornecedor (prestação de contas), Palestras, Temporadas, Metas, Painel do Diretor.

## 3. Melhorias implementadas
1. **Situação da Temporada** (hero): receita bruta, lucro líquido, empresas atendidas,
   pessoas impactadas, palestras realizadas, compra acumulada de livros, valor devido e pago
   ao fornecedor, recebimentos pendentes e meta anual atingida (%) — lida das metas do usuário.
2. **Ações rápidas**: 9 botões grandes (Nova Empresa, Nova Palestra, Entrada de Estoque,
   Novo Pagamento, Gerar Extrato, Prestação de Contas, Relatórios, Agenda, Painel do Diretor).
3. **Agenda de Hoje**: palestras do dia com empresa, cidade, contato, telefone/WhatsApp,
   agendista e status + bloco de próximas atividades.
4. **Alertas inteligentes**: pagamentos/recebimentos vencidos, palestras sem fechamento
   financeiro, fornecedor com saldo pendente, estoque abaixo do mínimo, materiais próximos do fim,
   empresas sem follow-up (60+ dias) e vencimentos dos próximos 7 dias — com severidade e link direto.
5. **Resumo Executivo**: receita, lucro, a receber, recebido, despesas, materiais utilizados e
   saldo disponível.
6. **Tarefas automáticas** derivadas dos dados reais, com prioridade, responsável, prazo e status,
   marcáveis na tela.
7. **Painel de Desempenho**: Top empresas, agendistas, cidades, campanhas e temporadas +
   recordes (ticket médio, maior lucro, maior público, conversão).
8. **Central de Decisões**: insights automáticos (concentração de faturamento, peso do material no
   custo, variação de resultado vs. mês anterior, cobertura de estoque em palestras, saldo de
   fornecedor, campanha mais lucrativa, ticket médio).

## 4. Problemas encontrados e corrigidos
| Problema | Correção |
| --- | --- |
| `/app/` levava a uma tela parcial em vez do painel executivo | Redirecionamento passa a apontar para `/app/dashboard` |
| Links para `/app/financeiro` sem os search params exigidos pela rota (erro de tipo) | Adicionado `search={{ lancamento: undefined }}` em `app.tsx` e `app.painel-diretor.tsx` |
| Links de palestra montados por string interpolada (rota não tipada) | Migrados para `to="/app/palestras/$id" params={{ id }}` |
| Dashboard exibia apenas contagens de cadastro (baixo valor de decisão) | Substituído por painel executivo orientado a ação |

## 5. Arquivos alterados
- `src/routes/app.dashboard.tsx` (reescrito como Centro de Operações)
- `src/routes/app.index.tsx` (redirect da Home)
- `src/routes/app.tsx` (link tipado)
- `src/routes/app.painel-diretor.tsx` (link tipado)

## 6. Testes realizados
- Typecheck completo do projeto: **0 erros**.
- Carga do app no navegador headless: **0 erros de console**.
- Revisão de rotas usadas pelos novos links (todas existem no route tree gerado).

## 7. Integridade preservada
Nenhuma alteração em `finance-engine.ts`, snapshots, Livro Razão, conta corrente,
custo médio de estoque, split 50/50, taxas de cartão, PDFs ou schema do banco.
Todos os números do Centro de Operações são **derivados por leitura** das tabelas existentes.

## 8. Sugestões futuras (não implementadas)
- Persistir as tarefas em tabela própria (hoje o "check" é apenas de sessão).
- Metas em banco (hoje em armazenamento local por organização/ano).
- Notificações por e-mail/WhatsApp para alertas de severidade alta.
- Cache incremental por temporada para bases com dezenas de milhares de lançamentos.
