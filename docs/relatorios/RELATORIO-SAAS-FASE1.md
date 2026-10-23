# GBS — FASE SAAS 1: Multi-tenant real, Organização Ativa e Permissões

## Arquivos alterados
- `src/lib/permissions.ts` (novo) — matriz de permissões.
- `src/components/org-provider.tsx` (novo) — contexto de organização ativa (persistida em `localStorage`, validada contra memberships reais).
- `src/components/org-switcher.tsx` (novo) — seletor no topo e na sidebar.
- `src/components/require-permission.tsx` (novo) — guarda de rota + tela "Acesso negado".
- `src/hooks/use-current-org.ts` — passa a ler o contexto (API antiga preservada: `organizationId`, `organizationName`, `role`, `loading`), agora com `memberships`, `setActiveOrg`, `can`, `switching`.
- `src/routes/app.tsx` — envolve o app no `OrgProvider`, exibe o seletor, estado de carregamento na troca, esconde "+ Novo" para viewers.
- `src/routes/app.configuracoes.tsx`, `app.auditoria.tsx`, `app.automacoes.tsx` — protegidas por permissão `settings`.

## Banco / policies
- Nova função `private.can_write(uuid)`: verdadeiro apenas para `owner`, `admin` e `member` da organização.
- Todas as policies `*_member_insert` e `*_member_update` (30 tabelas) passaram de `is_org_member` para `can_write`.
- Leitura (`is_org_member`) e exclusão (`has_org_role owner/admin`) permanecem como estavam.
- Nenhuma tabela criada/removida, nenhum dado alterado, nenhum cálculo financeiro tocado.

## Matriz final de permissões (enum `org_role` mantido)
| Papel | Ver | Criar | Editar | Excluir | Financeiro | Estoque | Config. | Usuários |
|---|---|---|---|---|---|---|---|---|
| owner | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| admin | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| member (Editor/Manager) | ✔ | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ | ✖ |
| viewer | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

O enum não foi alterado (compatibilidade). `member` cumpre o papel de Editor/Manager da especificação; papéis adicionais podem ser introduzidos em fase futura sem quebrar policies, pois tudo passa por `can_write`.

## Comportamento do seletor
- 1 membership → exibe a organização sem exigir seleção.
- 2+ → dropdown com nome e papel; ao trocar, o cache é descartado (`removeQueries`), mostra "Trocando de organização…" e recarrega tudo.
- A escolha persiste em `localStorage` e é revalidada contra as memberships a cada carregamento (ID inválido/estranho cai na primeira membership).

## Segurança
- A organização ativa é apenas UI/consulta; o isolamento definitivo é o RLS.
- Acesso direto por URL a registros de outra organização continua bloqueado pelo `SELECT` do RLS; edição/exclusão pelo `can_write`/`has_org_role`.
- Usuário sem membership não obtém organização ativa e vê "Acesso negado" nas áreas protegidas.

## Dados do Grupo Guerra
Nenhuma organização, empresa, palestra, lançamento ou item de estoque foi criado, duplicado ou removido. Todos os registros permanecem vinculados à organização atual.

## Verificações executadas
- Typecheck limpo (`tsgo --noEmit`).
- Migração aplicada e policies confirmadas usando `can_write`.
- Contagens de dados conferidas antes/depois (inalteradas).

## Pendente de verificação end-to-end
Os testes de interface com múltiplas organizações e com um usuário `viewer` real dependem de contas de teste; recomendo criar uma segunda organização/membership de teste para validar a troca e o bloqueio de escrita na prática.
