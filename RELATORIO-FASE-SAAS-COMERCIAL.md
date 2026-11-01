# RELATÓRIO — FASE SAAS COMERCIAL (GBS)

Data: 08/10/2026 · Processo: auditar → planejar → implementar → testar → corrigir → testar novamente → relatar.

## 1. Arquitetura existente encontrada
| Estrutura | Situação | Decisão |
|---|---|---|
| `plans` (recursos e limites em jsonb, trial, preços, ordem, destaque) | Existia | REUTILIZAR + EVOLUIR |
| `subscriptions` (1 por organização) | Existia | EVOLUIR |
| `subscription_events` | Existia, só gravado pela tela | EVOLUIR (gravado por trigger) |
| `platform_audit_log`, `platform_admins` | Existiam | REUTILIZAR |
| `billing_customers` / `billing_payments` / `billing_events` + Paddle | Existiam | Integração REMOVIDA; tabelas mantidas como histórico (vazias de uso) |
| Bloqueio por recurso/limite no banco | Não existia | CRIADO |
| Consumo | Não existia | CRIADO (contagem direta, sem contadores) |

Nenhuma tabela nova foi criada. Nenhuma segunda fonte de verdade.

## 2–4. Estruturas reutilizadas / alteradas / criadas
- **`subscriptions` (colunas novas):** `trial_started_at`, `pending_plan_id`, `pending_change_at`, `cancel_requested_at`, `cancel_requested_by`, `cancel_effective_at`, `limit_overrides`, `provider` e `external_customer_id/subscription_id/price_id/payment_id`. Os campos `gateway_*` antigos foram copiados para eles e mantidos.
- **`plans`:** `slug`, `is_active`; os preços podem ficar nulos ("Sob consulta").
- **Funções internas (schema `private`):** `effective_subscription_status`, `subscription_allows_write`, `has_feature`, `org_limit`, `org_usage`, `assert_can_create`, `enforce_commercial_insert`, `log_subscription_change`, `require_platform_admin`, `audit_subscription`.
- **`private.can_write`:** passa a exigir também uma assinatura que permita gravação. Organizações isentas continuam liberadas.
- **API (funções `SECURITY INVOKER` que só repassam):** `get_org_commercial_state`, `admin_change_plan`, `admin_set_trial`, `admin_set_subscription_status`, `admin_set_limits`.
- **Triggers BEFORE INSERT:** companies, contacts, lectures, agents, campaigns, projects, seasons e organization_members.

## 5. Migrations
1. Camada comercial: colunas, funções, triggers, revogação de escrita direta e funções de admin.
2. Funções de admin movidas para `private`, com wrappers invoker. Resolveu o alerta do linter.
3. Correção achada no teste: faltava `GRANT EXECUTE` em `private.is_platform_admin`, um problema que já existia antes desta fase. Sem ele, nenhum usuário conseguia ler a própria assinatura. Também foi revogado o acesso público às funções internas.

Os dados de planos foram ajustados por SQL de dados, não por migration.

## 6. Planos
| Código | Nome | Mensal | Situação |
|---|---|---|---|
| free | Free / Teste | — | criado, inativo, sem preço |
| starter | Starter (antigo Essencial, mesmo ID) | R$ 197 | ativo |
| pro | Pro (antigo Profissional, mesmo ID) | R$ 397 | ativo |
| business | Business | — | criado, inativo, sem preço |
| enterprise | Enterprise | R$ 897 | ativo |

Os limites de Free e Business foram sugeridos por mim e podem ser editados em GBS Admin › Planos.

## 7–8. Recursos e limites
- **Recursos:** CRM, contatos, palestras, agendistas, financeiro, conta corrente, estoque, campanhas, temporadas, projetos, relatórios, documentos, arquivo oficial, dashboard avançado, exportações, multiusuário e os demais já existentes.
- **Limites:** usuários, empresas, contatos, palestras/mês, agendistas, campanhas, projetos, temporadas e armazenamento. `null` significa ilimitado. A organização pode ter limites próprios, que substituem os do plano.

## 9–14. Trial, assinatura, upgrade, downgrade, suspensão e cancelamento
- **Trial vencido** conta como `expired` na hora da verificação. Não depende de rotina agendada.
- **Gravação bloqueada** em `expired`, `canceled`, `suspended` e `incomplete`. A leitura continua liberada.
- **Upgrade e downgrade** podem valer na hora ou ser agendados para a renovação (`pending_plan_id`). O downgrade nunca apaga dados.
- **Cancelamento** registra motivo, quem pediu, data do pedido e data efetiva, que pode ser futura.

## 15. Consumo
Contado por `COUNT` sobre os dados reais. O armazenamento soma os arquivos da pasta da organização. As faixas são: aviso a partir de 70%, atenção a partir de 85% e bloqueio em 100%.

## 16. GBS Admin
A aba Assinatura do cliente tem:
- resumo comercial;
- alterar plano (agora ou na renovação);
- estender ou iniciar trial;
- ativar, marcar inadimplente, suspender ou cancelar (com data opcional);
- limites próprios da organização;
- consumo.

Tudo passa por funções protegidas e gera histórico e auditoria com antes, depois, quem, quando e organização.

## 17–19. RLS, multi-tenant e auditoria
- `authenticated` não tem mais INSERT/UPDATE/DELETE em `subscriptions` nem em `subscription_events`.
- O RLS de leitura continua igual: membros da org ou GBS Admin.
- `plans` continua só leitura para não-admin.

## 20. Testes reais
Ambiente: organizações temporárias GBS_SAAS_TEST_A (sua conta como dona) e GBS_SAAS_TEST_B (sem a sua conta), chamadas reais à API com sessão autenticada. Os testes de admin rodaram com acesso de GBS Admin dado temporariamente à sua conta e retirado ao final.

| Teste | Status | Evidência |
|---|---|---|
| 1 Planos | PASS | free, starter, pro, business, enterprise |
| 2 Associar plano | PASS | A nasceu no Starter |
| 3 Trial | PASS | status trial, término em 21/10 |
| 4 Período / extensão | PASS | +7 dias → 28/10 |
| 5 Alterar plano | PASS | Starter→Pro, Pro→Starter |
| 6 Recursos | PASS | campanha no Starter: `GBS_FEATURE_UNAVAILABLE`; no Pro: criada |
| 7 Atingir limite | PASS | limite 2: 2 empresas criadas |
| 8 Ultrapassar limite | PASS | 3ª recusada: `GBS_LIMIT_REACHED:companies` |
| 9 Upgrade | PASS | no Pro, nova empresa aceita |
| 10 Downgrade | PASS | 3 empresas preservadas, novo cadastro recusado; agendamento registrado |
| 11 Suspensão | PASS | gravação recusada, leitura 200 (3 registros) |
| 12 Reativação | PASS | cadastro aceito |
| 13 Cancelamento | PASS | 4 empresas preservadas, gravação recusada, motivo e data gravados |
| 14 Multi-tenant | PASS | A não lê estado, assinatura nem empresa de B (403 / vazio) |
| 15 Manipular plan_id/status/limites/eventos | PASS | 403 em todas as tentativas; plano não alterado |
| 16 Manipular organization_id | PASS | empresa em B recusada pelo RLS; assinatura não pode ser movida |
| 17 GBS Admin | PASS | não-admin recebe `GBS_FORBIDDEN`; admin consegue |
| 18 Auditoria | PASS | eventos e `platform_audit_log` com ator, ação, antes e depois |

## 21. Regressão
- **Telas:** Minha assinatura, CRM, Dashboard, Financeiro, Agendistas, Estoque, Palestras e GBS Admin abriram com sessão real, sem chamadas com erro.
- **Organizações reais:** as 3 originais são isentas, então nenhum limite se aplica a elas.
- **Sem mudanças:** motor financeiro, estoque, CRM e fechamentos não foram tocados. Os fechamentos existem e não foram alterados (11 hoje).
- **Não refeito nesta fase:** login, logout e fluxo de membros/roles (sem mudança de código; validados na fase Foundation).

## Limpeza
Organizações, membros, assinaturas, eventos, empresas, campanhas, auditorias e o acesso temporário de admin foram apagados. Conferência final no banco: 0 organizações de teste, 0 registros ZZ-TESTE, 0 assinaturas órfãs, 0 GBS Admin temporário.

Observação: existe uma 4ª organização real, "Gustavo Guerra — Workspace", criada em 08/10 por um cadastro, fora dos testes. Ela não foi tocada.

## 22. Pendências
- Não existe nenhum GBS Admin cadastrado. Sem isso, ninguém consegue usar a área de admin.
- Eventos `trial_ended` e `expired` automáticos sem ação humana dependem de rotina agendada (não criada). O bloqueio já funciona sem ela.
- Aplicação automática do downgrade agendado na data também depende de rotina agendada.
- Limite de armazenamento é mostrado, mas não bloqueia upload.
- Cobrança real: próxima fase.

## Resultado
TOTAL PASS 18 · FAIL 0 (1 FAIL encontrado e corrigido antes da rodada final) · NÃO TESTADO 0

**FASE SAAS COMERCIAL — APROVADA**
