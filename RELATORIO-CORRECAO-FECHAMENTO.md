# GBS — Correção de Segurança · Numeração dos Fechamentos de Conta

## 1. Qual era o alerta
Alerta do banco: "Signed-In Users Can Execute SECURITY DEFINER Function", sobre `public.next_closing_number(_org uuid)`.

## 2. Causa (auditoria antes da correção)
- **Função:** `public.next_closing_number`, chamada pelo app (RPC) em `account-closing.tsx` antes de gerar o Termo.
- **Tabela:** `account_closings` (índice único `organization_id + closing_number`).
- **Como gerava:** `MAX(número) + 1` dentro de `account_closings`, com padrão `GG-AAAA-AG-0001`.
- **Problemas encontrados:**
  1. Rodava com privilégios elevados (SECURITY DEFINER) e ficava exposta na API pública (motivo do alerta).
  2. **Condição de corrida:** dois fechamentos simultâneos podiam receber o mesmo número.
  3. **Permissão fraca:** só verificava se o usuário era membro. Visualizador, organização suspensa ou cancelada também conseguiam reservar números.
  4. **Enumeração:** como a função lia `account_closings` com privilégio elevado, qualquer membro podia descobrir quantos fechamentos a organização tinha, mesmo sem ter acesso a eles.
  5. **Achados durante os testes** (mesma área, corrigidos aqui): o banco aceitava (a) um fechamento com agendista de outra organização, quando o usuário participava das duas, e (b) um número inventado pelo usuário, por exemplo `GG-2026-AG-9999`.
- **SQL injection:** não havia risco. O parâmetro é uuid tipado e não existe SQL dinâmico. `search_path` já estava fixo.

## 3. Mecanismo envolvido
RPC `public.next_closing_number`. Criados ou alterados: `private.reserve_closing_number`, `private.closing_number_counters`, `private.validate_account_closing` e o gatilho `trg_validate_account_closing`.

## 4. Alteração feita
- Tabela interna de contadores `private.closing_number_counters` (organização + ano). Fica fora da API e nenhum usuário tem acesso direto. Foi iniciada com o último número já existente (Grupo Guerra: 8, então o próximo será `GG-2026-AG-0009`).
- Reserva **atômica** (`INSERT … ON CONFLICT DO UPDATE … RETURNING`): o próprio banco garante que dois pedidos simultâneos nunca recebem o mesmo número.
- A função pública `next_closing_number` passou a rodar com os privilégios do próprio usuário (**SECURITY INVOKER**), com o mesmo nome e a mesma assinatura. O app não precisou de nenhuma mudança.
- Novo gatilho na criação de fechamento, que valida no banco:
  - o agendista pertence à mesma organização;
  - o número foi reservado pelo sistema para aquela organização;
  - o formato oficial está correto;
  - numa reemissão, o número é o mesmo do original da própria organização.
- O padrão visual `GG-AAAA-AG-0001` foi mantido.

## 5–9. Como ficou a segurança
- **Multi-tenant:** cada organização tem o próprio contador. A organização vem da chamada, mas o banco só aceita se o usuário tiver permissão de escrita nela.
- **Concorrência:** contador atômico, mais o índice único que já existia como última barreira.
- **Permissões:** usa `private.can_write`, a mesma regra do resto do sistema. Exige usuário autenticado, membro ativo, papel owner/admin/member e organização ativa.
- **SECURITY DEFINER:** saiu da função pública. Ficou apenas nas funções internas do esquema privado, com `search_path` fixo, sem acesso para anônimos e sem exposição na API. Linter final: **nenhum alerta**.
- **Enumeração:** a função só devolve o número reservado. Não lê fechamentos nem permite consultar a sequência de outra organização.

## 10–13. Testes executados (chamadas diretas ao banco, sem passar pela interface)
Duas organizações temporárias, ZZ-TESTE Num Alpha e Beta.

| Teste | Resultado |
|---|---|
| Usuário autorizado, org ativa | PASS: 200, `GG-2026-AG-0001` |
| Sem login | PASS: bloqueado (401) |
| Visualizador | PASS: bloqueado (403) |
| Membro inativo | PASS: bloqueado (403) |
| Usuário de outra organização | PASS: bloqueado (403) |
| organization_id inválido / nulo | PASS: bloqueado (403) |
| Organização suspensa | PASS: bloqueado (403) |
| Organização cancelada | PASS: bloqueado (403) |
| Agendista de A em fechamento de B, e vice-versa | PASS: bloqueado (403), após a correção extra |
| Número inventado (`…-9999`) | PASS: bloqueado (403) |
| Formato inválido | PASS: bloqueado (400) |
| Número duplicado | PASS: rejeitado (409) |
| Ver fechamentos de outra organização | PASS: 0 linhas |
| **Concorrência:** 20 pedidos simultâneos em Alpha | PASS: 20 números, 20 únicos (0002–0021) |
| **Concorrência:** 20 simultâneos em Beta | PASS: 20 únicos, sequência própria a partir de 0001 |

## 14. Regressão
Feita no banco, na organização de teste. O fluxo na tela não foi refeito, para não criar fechamento em organização real.

| Etapa | Resultado |
|---|---|
| Reservar número | PASS |
| Salvar documento no armazenamento | PASS (200) |
| Registrar fechamento | PASS (201) |
| Histórico | PASS: listou o fechamento |
| Link para ver/baixar | PASS (200) |
| Auditoria | PASS: criação registrada pela infraestrutura existente, com usuário, organização, fechamento, data/hora e ação |

- Nenhuma regra de acesso, permissão, Conta Corrente, motor financeiro, layout ou geração de documento foi alterada. O código do app não mudou e os pacotes não foram atualizados.

## 15. Dados existentes
8 fechamentos antes e 8 depois. A assinatura de conteúdo (md5 `1f11388d…`) é idêntica: **nenhum fechamento existente foi alterado**.

## 16. Dados temporários
Organizações, agendistas, membros, fechamentos, contadores, auditoria e arquivo de teste foram removidos. Contagem final no banco: 0 em todos.

## PENDÊNCIA FUTURA
- **Reemissão de fechamento:** o índice único atual (`organização + número`) impede gravar a versão v2 com o mesmo número, então o botão "Reemitir" falharia ao arquivar. Nenhuma reemissão foi usada até hoje. A correção sugerida é tornar a unicidade `organização + número + versão`. Não foi implementada aqui.

---
**SEGURANÇA DA NUMERAÇÃO: PASS**
**REGRESSÃO: PASS**
**FASE DE CORREÇÃO: APROVADA**
