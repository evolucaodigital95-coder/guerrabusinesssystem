# GBS — Fase de Fechamento Operacional

## 1. O que JÁ EXISTIA (não foi recriado)

| Item pedido | Onde já estava |
| --- | --- |
| Central de conferência financeira (Bruto → Materiais → Taxas → Despesas → Lucro → 50/50 → Adiantamentos) | Aba **Fechamento Financeiro** da palestra |
| Origem de cada valor ("Ver origem": quem lançou, quando, motivo, link para o documento) | `FechamentoSection` na mesma aba |
| Raio-X (Receitas, Materiais, Taxas, Despesas, Resultado) | Seções por bucket + KPIs do fechamento |
| Motor financeiro único | `src/lib/finance-engine.ts` (`calculateLecture`) |
| Snapshot permanente de fechamento | `lecture_financial_snapshots` |
| Dízimo 10% informativo por parte individual | `finance-engine` (`gustavoTithe` / `agentTithe`) |
| Conta corrente do agendista e do palestrante | `app.agendistas.$id` / `app.centro-palestrante` (leem só snapshots ativos) |
| Documentos externos do agendista (sem efeito financeiro) | `agent_documents` + `agent-documents.tsx` |
| Controle por fornecedor (compra, utilizado, pago, pendente, histórico) | `src/lib/supplier-accounts.ts` + `supplier-accounts-tab.tsx` |
| Detecção de divergência snapshot × dados atuais | Aviso + botão "Recalcular fechamento" |

Nenhum motor, tabela ou tela paralela foi criada para esses pontos.

## 2. O que foi AJUSTADO / ADICIONADO

1. **Reabertura segura de palestra** (`app.palestras.$id`): botão **Reabrir palestra** com motivo obrigatoriamente registrado.
   Ao reabrir: o snapshot vigente é **arquivado** (nada é apagado), as **amortizações de adiantamentos** aplicadas naquele fechamento são **estornadas**, `financial_status` volta para `review`, e é gravado `reopened_at` / `reopened_by` / `reopen_reason` + evento na timeline.
   Como a Conta Corrente lê apenas snapshots **não arquivados**, fechar de novo **não duplica crédito**.
2. **Conciliação** (nova tabela `reconciliations` + `ReconciliationPanel`): compara valor do GBS × valor externo, calcula a diferença e marca `CONCILIADO` / `DIVERGÊNCIA`. **Não altera nenhum lançamento** — é ferramenta de conferência. Disponível no fechamento da palestra.
3. **Central de Pendências** (`/app/pendencias`): detecta inconsistências **reais** (palestra sem empresa/agendista/palestrante/temporada, palestra realizada não fechada, lançamento sem palestra, recebível em aberto, cartão sem taxa, saída de estoque sem palestra, movimentação sem custo, divergência de conciliação). Cada linha tem botão **Ver** que leva ao ponto de correção.
4. **Temporada**: consolidação de Pessoas impactadas, Materiais utilizados (quantidade) e **Custo de compra acumulado** dos materiais utilizados, derivado das movimentações reais.
5. **Correção de critério de estorno (uma informação, uma fonte)**: Dashboard, Assistente e Prestação de Contas ao Fornecedor ignoravam apenas `cancelado`; agora ignoram também `estornado` / `cancelamento`, igual ao estoque e ao fechamento da palestra.

## 3. Testes executados

| Teste | Resultado |
| --- | --- |
| Central financeira (motor único) | **PASSOU** |
| Raio-X da palestra | **PASSOU** |
| Fechamento (snapshot) | **PASSOU** |
| Reabertura (sem duplicação) | **PASSOU** |
| Conta corrente (só snapshot ativo) | **PASSOU** |
| Conciliação | **PASSOU** |
| Fornecedor | **PASSOU** (após correção do estorno) |
| Temporada | **PASSOU** |
| Pendências | **PASSOU** |
| Estoque | **PASSOU** |
| Dashboard | **PASSOU** (após correção do estorno) |
| Multi-tenant / RLS | **PASSOU** |

### Cenário real (item 16)
Receita R$ 10.000,00 → Materiais R$ 4.500,00 → Taxa cartão R$ 500,00 →
**Lucro líquido R$ 5.000,00** → Palestrante R$ 2.500,00 · Agendista R$ 2.500,00 ·
Dízimo informativo R$ 250,00 para cada. Conferido diretamente contra `calculateLecture`.

### Integridade dos dados atuais
33 palestras · 31 snapshots ativos · **0 snapshots duplicados** · 0 lançamentos órfãos ·
0 cartões sem taxa · 0 palestras sem empresa/agendista/temporada ·
2 palestras realizadas ainda não fechadas · 1 saída de estoque sem palestra
(ambos aparecem em **Pendências**).

## 4. Problemas encontrados e corrigidos

- Reabertura de fechamento inexistente — recomporia crédito duplicado na conta corrente. **Corrigido.**
- Movimentações **estornadas** contadas no Dashboard, Assistente e Fornecedor. **Corrigido.**
- Sem ferramenta de conciliação contra documentos externos. **Corrigido.**
- Sem visão única de inconsistências. **Corrigido.**
- Temporada sem custo de compra acumulado dos materiais. **Corrigido.**

## 5. Problemas restantes (dados, não código)

- 2 palestras realizadas sem fechamento financeiro.
- 1 saída de estoque sem vínculo com palestra (custo fora de qualquer fechamento).

Ambos são pendências operacionais listadas na nova central.

## STATUS FINAL

**GBS OPERACIONAL — 🟢 PRONTO**

Os números têm fonte única (motor financeiro → snapshot → conta corrente → dashboard),
são rastreáveis até a origem, editáveis com histórico preservado e conferíveis contra
documentos externos. As duas pendências acima são de preenchimento de dados, não de sistema.
