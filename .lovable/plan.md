# GBS — Fase SaaS Comercial

## Resultado da auditoria

| Estrutura | Situação | Decisão |
|---|---|---|
| Planos (com recursos, limites, trial, preços, ordem, destaque) | Existe | REUTILIZAR |
| Assinaturas (status, ciclo, trial, cancelamento) | Existe, 1 por organização | EVOLUIR |
| Histórico da assinatura | Existe, mas não é preenchido automaticamente | EVOLUIR |
| Auditoria da plataforma | Existe | REUTILIZAR |
| Integração de cobrança Paddle (clientes, pagamentos, eventos, rota de retorno) | Existe | REMOVER (sua escolha) |
| Bloqueio por recurso e por limite no banco | Não existe, só na tela | CRIAR |
| Consumo | Não existe | CRIAR (contado direto dos dados reais) |
| Downgrade pendente, início do trial, limites por organização | Não existe | CRIAR (colunas nas tabelas atuais) |

Nenhuma tabela paralela de planos, recursos ou assinaturas será criada.

## O que vai mudar

1. **Remover o Paddle**: apago a rota de retorno, as funções e o botão de pagamento. Os registros antigos de cobrança continuam guardados no banco, só para consulta. Os campos neutros de provedor (provider, external_customer_id, external_subscription_id, external_price_id, external_payment_id) ficam prontos para qualquer gateway no futuro.
2. **Os 5 planos**:
   - Essencial vira **Starter** e Profissional vira **Pro**, com os mesmos IDs, preços e assinaturas.
   - O **Enterprise** continua igual.
   - **Free/Teste** e **Business** são criados sem preço e ficam desativados até você definir os valores no Admin.
   - Tudo é identificado pelo código, nunca pelo nome.
3. **Validação central no banco**: uma única regra checa login, se a pessoa é membro ativo, se a organização está ativa, o papel, a assinatura, o recurso do plano e o limite. Ela vale para empresas, contatos, palestras, agendistas, campanhas, projetos, temporadas e usuários. Ao passar do limite, a mensagem é: "Você atingiu o limite de empresas do seu plano." Nada é apagado.
4. **Trial, suspensão, cancelamento e expiração**: o trial vencido passa a contar como expirado na própria verificação, sem depender de rotina agendada. Nesses estados, gravar fica bloqueado e consultar continua liberado. O cancelamento guarda o motivo, quem pediu e a data efetiva.
5. **Upgrade e downgrade**: o upgrade vale na hora. O downgrade nunca apaga nada: se a organização tem mais registros do que o novo plano permite, novos cadastros ficam bloqueados e aparece uma orientação para se adequar.
6. **Proteção contra manipulação**: usuário comum não altera plano, status, limites nem organização da assinatura. Só o GBS Admin, por funções protegidas.
7. **Histórico e auditoria automáticos**: toda alteração de assinatura grava o evento (criada, trial, upgrade, downgrade, suspensa, reativada, cancelada, expirada) com antes, depois, quem e quando.
8. **Telas**:
   - **Minha Assinatura**: plano, status, valor, trial com contagem de dias, recursos, consumo com barras (normal até 70%, atenção a partir de 85%, limite em 100%) e botão de upgrade.
   - **Planos**: comparação dos planos, na identidade visual do GBS.
   - **Recurso bloqueado**: aparece "Disponível no plano Pro" com botão para conhecer os planos, em vez de esconder.
   - **GBS Admin**: lista com filtros e detalhe com identidade, comercial, consumo e segurança. Ações: trocar plano, iniciar ou estender trial, suspender, reativar, cancelar e alterar limites da organização.
9. **Testes reais**: os 18 testes do documento, rodados com as organizações temporárias GBS_SAAS_TEST_A e GBS_SAAS_TEST_B direto no banco e pela API. Depois, regressão dos módulos e limpeza total dos dados de teste, conferida no banco.
10. **Relatório** `RELATORIO-FASE-SAAS-COMERCIAL.md`, separando IMPLEMENTADO, VALIDADO, NÃO TESTADO e PENDENTE. A fase só será declarada aprovada sem nenhum FAIL.

## Fora do escopo
Motor financeiro, estoque, CRM, fechamentos, dados históricos e regras das lojas de apps.

## Detalhes técnicos
- Migração em `subscriptions`: `trial_started_at`, `pending_plan_id`, `pending_change_at`, `cancel_requested_at`, `cancel_requested_by`, `limit_overrides jsonb`, `provider` e `external_*`. A coluna `gateway_*` é renomeada ou mapeada sem perder dados.
- `plans`: adiciono `slug` (igual a `code`) e `is_active`; no `features`, as chaves que faltam (documentos, arquivo_oficial, contatos, agendistas, exportacoes).
- Funções em `private`: `effective_subscription(org)`, `has_feature(org, key)`, `org_limit(org, key)`, `org_usage(org)` (contagens via COUNT, sem contadores) e `assert_can_create(org, feature, limit_key)`. Triggers BEFORE INSERT nas tabelas limitadas. Mensagens de erro com código próprio, traduzidas na tela.
- RPC pública somente leitura `get_org_commercial_state(org)`, para membros. RPCs de admin `admin_set_plan`, `admin_extend_trial`, `admin_set_subscription_status` e `admin_set_limits`, que conferem `platform_admins`.
- Revogar UPDATE e INSERT direto em `subscriptions` e `plans` para `authenticated`. Trigger AFTER UPDATE gravando em `subscription_events` e `platform_audit_log`.
- Remover `src/routes/api/public/billing/paddle.ts`, `src/lib/billing*.ts` e o segredo e as referências na interface.
