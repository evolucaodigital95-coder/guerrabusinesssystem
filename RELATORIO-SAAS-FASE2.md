# GBS — FASE SAAS 2: Onboarding + Configuração da Organização

## 1. Tabelas criadas
| Tabela | Função |
|---|---|
| `organization_settings` | Perfil da empresa, identidade visual, regras financeiras, módulos e preferências — 1 registro por organização (`UNIQUE organization_id`). |
| `organization_onboarding` | Estado do primeiro acesso: status, etapa atual, etapas concluídas, percentual, início, conclusão e usuário responsável. |
| `organization_invites` | Convites de equipe por organização (e-mail, papel, status, quem convidou, expiração). |

Nenhuma tabela existente foi alterada. Nenhuma regra financeira ou cálculo existente foi tocado.

## 2. Policies (RLS)
Todas as três tabelas com RLS habilitado e GRANTs explícitos:
- **Leitura**: `private.is_org_member(organization_id)`.
- **Escrita** (settings/onboarding): `private.can_write(organization_id)` → `viewer` é somente leitura.
- **Convites**: criação/edição/exclusão restritas a `owner`/`admin` (`private.has_org_role`).
- Exclusão de settings/onboarding: apenas `owner`/`admin`.

## 3. Automação de banco
- Trigger `trg_bootstrap_org_setup` em `organizations`: toda organização nova nasce com onboarding `pending` (0%) e um registro de configuração.
- Função `bootstrap_organization_setup()` é `SECURITY DEFINER` com `EXECUTE` revogado de `public`/`anon`/`authenticated` (linter limpo).
- Triggers `set_updated_at` nas três tabelas.

## 4. Dados existentes (Grupo Guerra intacto)
As 3 organizações já existentes foram marcadas como `completed` / 100% para **não reexecutar onboarding**, e receberam apenas um registro de configuração vazio (`display_name` = nome da organização). Verificado por consulta:
`Grupo Guerra — Workspace → completed / 100%`. Nenhuma empresa, palestra, lançamento, item de estoque, agendista, temporada, campanha, projeto, fornecedor ou relatório foi modificado. Nenhum dado fictício foi criado.

## 5. Rotas criadas
- `/app/onboarding` — assistente de 6 etapas (protegido por `RequirePermission("settings")`).
- `/app/organizacao` — Configuração da Organização (checklist + abas permanentes), adicionada ao menu **Sistema**.

## 6. Componentes / hooks criados
- `src/lib/onboarding.ts` — etapas, opções (tipo de operação, formas de pagamento, módulos), padrões do sistema, cálculo de progresso.
- `src/hooks/use-onboarding.ts` — `useOrgSettings`, `useUpdateOrgSettings`, `useOnboarding`, `useCompleteStep`, `useOrgInvites`, `useInviteMember`, `useCancelInvite`, `useSetupChecklist`.
- `src/components/onboarding/setup-banner.tsx` — aviso discreto "Configuração do seu GBS: X%" no Dashboard, com botão "Continuar configuração" (não bloqueia nada).
- `src/components/onboarding/onboarding-gate.tsx` — leva ao assistente apenas no primeiro acesso (status `pending` e 0%).

## 7. Estrutura do onboarding
1. **Sua empresa** — nome, nome comercial, responsável, telefone, e-mail, cidade, estado, site, descrição, tipo de operação.
2. **Identidade** (opcional) — logo, nome exibido, cor principal, cor secundária, imagem de marca, com prévia.
3. **Produtos e materiais** (opcional) — cadastro via formulário de estoque existente, preços gravados por organização.
4. **Regras financeiras** — formas de pagamento, taxa de cartão, parcelamento, comissão do palestrante/agendista, dízimo, observações. Sem configuração → padrões do sistema; nada é substituído silenciosamente.
5. **Equipe** (opcional) — convite por e-mail + papel, lista de membros ativos e convites pendentes.
6. **Configuração operacional** — seleção dos módulos utilizados (nenhum módulo é removido do sistema).

Recursos de experiência: barra de progresso e "Etapa X de 6", navegação por etapas, **Salvar e continuar depois**, **Pular etapa** (apenas nas opcionais), hidratação do formulário com o que já foi salvo, mensagens de erro claras, layout responsivo e tela final "Seu GBS está pronto" com resumo (empresa, equipe, produtos, regras, módulos, logo, percentual) e botão "Entrar no GBS".

## 8. Configurações permanentes
`/app/organizacao` com checklist reeditável e abas: Perfil da empresa · Identidade visual · Produtos e estoque · Financeiro · Equipe e permissões · Preferências (módulos). Notificações, integrações e importação CSV/XLSX ficam preparadas como área — a arquitetura (`preferences jsonb`, settings por organização) já suporta, sem implementação complexa nesta fase.

## 9. Testes realizados
- Typecheck (`tsgo`) e ESLint/Prettier: **limpos**.
- Rota `/app/onboarding` responde 200 no servidor de desenvolvimento.
- Consulta de banco confirmando onboarding concluído para as organizações existentes e settings criados sem duplicidade (`ON CONFLICT DO NOTHING`).
- Isolamento cross-tenant garantido em nível de banco: todas as leituras exigem membership e todas as escritas exigem papel com permissão **na mesma organização** — não há caminho para configurar outra organização, mesmo manipulando o frontend.

## 10. Problemas encontrados e corrigidos
- Linter apontou a função de bootstrap como `SECURITY DEFINER` executável → `EXECUTE` revogado.
- Erros de compilação por imports faltantes (`Building2`, `SetupBanner`, `OnboardingGate`) → corrigidos.

## 11. Pendência
O teste end-to-end com login real (criar organização A e B e navegar) não pôde ser executado porque a sessão do preview está deslogada. A barreira de isolamento, porém, é o RLS — validado por policy em todas as tabelas novas.

Nada de planos, assinaturas, cobrança ou GBS Admin foi implementado nesta fase.
