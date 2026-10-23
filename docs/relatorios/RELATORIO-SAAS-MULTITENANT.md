# GBS — Auditoria de Arquitetura para SaaS Multi-Tenant
Data: 10/08/2026 · Escopo: **auditoria somente** (nenhum código, banco, RLS ou dado foi alterado)

---

## 1. BANCO DE DADOS — mapa das 35 tabelas

Padrão dominante: `organization_id` + FK → `organizations` + `created_by` + `updated_by` + RLS ativo + 4 policies (read/insert/update por membro; delete por owner/admin), todas usando as funções `SECURITY DEFINER` `private.is_org_member(org)` e `private.has_org_role(org, role)`.

**PRONTAS PARA MULTI-TENANT (28 tabelas)** — org_id + FK + RLS + 4 policies + auditoria:
accounts, advances, agents, attachments, campaigns, card_brands, card_fee_tiers, companies, contacts, decisions, financial_movements, financial_rules, history_events, inventory_batches, leads, lecture_topics, lectures, notes, opportunities, projects, roadmap_projects, seasons, stock_items, stock_movements, supplier_settlements, taggings, tags, timeline_events.

**PARCIALMENTE PREPARADAS (5)**
| Tabela | Situação | Observação |
|---|---|---|
| `season_snapshots` | org_id + RLS + 4 policies, **sem FK para organizations** | integridade referencial frouxa; snapshot órfão é possível se a org for removida |
| `lecture_financial_snapshots` | org_id + FK + RLS OK, **sem created_by/updated_by** (tem `closed_by`) | aceitável, mas foge do padrão de auditoria |
| `audit_log` | org_id + FK + RLS; só 2 policies (read/insert exigindo `organization_id IS NOT NULL` + membro); UPDATE/DELETE negados | correto e imutável; falta `created_by` (usa `actor_id`) |
| `user_feedback` | org_id **nullable e sem FK**; policies apenas por `user_id` | feedback não é lido por organização; ao virar SaaS, suporte multi-cliente vai exigir leitura por org/admin global |
| `organization_members` | org_id + FK + RLS (read: membro da org OU o próprio; ALL: owner/admin) | base do isolamento — ver §2 |

**NÃO PRECISAM DE ISOLAMENTO POR ORG (2)**
- `organizations` (é o próprio tenant; RLS: read por membro, insert pelo criador, update por owner/admin, **delete negado**)
- `profiles` (identidade global do usuário; RLS estritamente `auth.uid() = id`)

**NÃO PREPARADAS:** nenhuma. Não há tabela de negócio sem `organization_id`.

---

## 2. ORGANIZAÇÕES — o que já existe

- `organizations` (name, slug, created_by, updated_by, archived_at).
- `organization_members` (organization_id, user_id, `role org_role`, archived_at) — **N:N já suporta usuário em múltiplas organizações**.
- `profiles` — 1:1 com o usuário autenticado (id, email, full_name, avatar_url).
- **Roles**: enum `org_role` = owner | admin | member | viewer, armazenado em tabela separada (`organization_members`) — padrão correto, sem risco de escalonamento via profile.
- **Permissions**: **não existe** granularidade além do papel. Hoje só há dois níveis efetivos nas policies: "membro" (CRUD) e "owner/admin" (delete). `member` e `viewer` têm exatamente os mesmos direitos — **viewer pode escrever**. Será necessário criar (não criado agora).
- Provisionamento automático: o trigger `handle_new_user()` cria profile + organização "<Nome> — Workspace" + membership `owner` a cada signup. Isso já é comportamento de SaaS.

---

## 3. AUTENTICAÇÃO — auditoria

| Item | Estado | Risco |
|---|---|---|
| Login e cadastro | `src/routes/index.tsx` (signUp / signInWithPassword + Google via broker Lovable) | OK |
| Recuperação de senha | **não existe** `resetPasswordForEmail` em nenhum lugar | **ALTO** para SaaS: cliente sem autoatendimento fica travado |
| Sessão / persistência | `use-session.ts` com `getSession()` + `onAuthStateChange`, `persistSession: true` | OK |
| Logout | `app.tsx` → `signOut()` + navigate | **MÉDIO**: não faz `queryClient.clear()`/`cancelQueries`; cache de uma org pode sobreviver à troca de usuário na mesma aba |
| Usuário → organização | `use-current-org.ts` pega **a primeira membership** (`order created_at asc limit 1`) | **CRÍTICO para SaaS**: não há seletor de organização; usuário em 2 orgs só enxerga a mais antiga |
| Múltiplas organizações | suportado no banco, **não suportado na UI** | ALTO |
| Proteção de rotas | `/app` é layout client-side com `if (!session) <Navigate to="/" />` (não usa `_authenticated`, sem `beforeLoad`) | MÉDIO: só protege UI; dados continuam protegidos por RLS. Há flash/latência, não vazamento |

---

## 4. RLS / SEGURANÇA — matriz de risco

Todas as 35 tabelas com RLS **ativo**; nenhuma policy `USING (true)`; nenhuma policy concedida a `anon`; todas restritas a `authenticated`.

| Cenário entre organizações | Classificação | Justificativa |
|---|---|---|
| Consultar dados de outra org | **OK** | todo SELECT passa por `private.is_org_member(organization_id)` |
| Editar dados de outra org | **OK** | UPDATE tem USING + WITH CHECK por membro |
| Excluir dados de outra org | **OK** | DELETE restrito a owner/admin da própria org |
| Acessar arquivos de outra org | **OK** | policies em `storage.objects` derivam a org de `foldername(name)[1]` e exigem membership |
| Relatórios / dados financeiros | **OK** | são gerados no cliente a partir das mesmas tabelas sob RLS |
| `viewer`/`member` escrevendo dados | **ALTO** | papéis não diferenciados nas policies |
| Qualquer membro alterando snapshot financeiro/temporada (imutabilidade) | **MÉDIO** | `lecture_financial_snapshots` e `season_snapshots` aceitam UPDATE por qualquer membro |
| `audit_log` sem `organization_id` | **BAIXO** | escrita exige org não nula; o trigger deriva org da linha |
| `user_feedback` sem escopo de org | **BAIXO** | só o autor lê |
| `season_snapshots` sem FK de org | **BAIXO** | integridade, não vazamento |

**Conclusão de segurança: o isolamento por tenant já é sólido.** O que falta é *autorização por papel*, não *isolamento*.

---

## 5. QUERIES NO CÓDIGO

- Listagens: praticamente todas filtram por `.eq("organization_id", organizationId)` — padrão consistente.
- **Consultas por ID puro** (`.eq("id", id)` sem org): `app.crm.$id.tsx`, `app.palestras.$id.tsx`, `app.agendistas.$id.tsx`, `app.estoque.$id.tsx`, `app.temporadas.$id.tsx`, `app.projetos.$id.tsx`, `app.campanhas.$id.tsx`. **Não vazam** (RLS bloqueia), mas retornam `null` silenciosamente em vez de "não encontrado/sem acesso" — corrigir por robustez e UX, não por segurança.
- **Arquivos sem nenhuma referência a `organization_id`**: `src/routes/app.projetos.$id.tsx` e `src/routes/app.campanhas.$id.tsx` — dependem 100% da RLS.
- Escritas: todas enviam `organization_id` vindo de `useCurrentOrg()`; com WITH CHECK ativo, não é possível gravar em org alheia.
- `useCurrentOrg()` é o ponto único de acoplamento de tenant no frontend — é ele que precisará virar "organização ativa selecionável".

---

## 6. STORAGE / ARQUIVOS

- Bucket único **`crm-attachments`**, privado.
- Convenção de path: `"{organization_id}/{entity_type}/{entity_id}/{timestamp}-{arquivo}"` (`src/components/crm/attachments-tab.tsx`) — **isolamento por pasta já implementado e reforçado pelas policies**.
- Leitura via `createSignedUrls` (`app.agendistas.$id.tsx`), TTL 1h.
- **PDFs (extrato do agendista, relatórios de fornecedor/palestrante, exportações CSV/Excel) são gerados no navegador e não são persistidos** — não há arquivo compartilhado no servidor.
- Logos, biblioteca de conteúdo e documentos institucionais: **não há upload próprio hoje** (logo é asset estático no bundle). Ao virar SaaS, exigirá bucket/prefixo por organização.
- Risco de acesso cruzado: **BAIXO**. Ressalva: o path é montado no cliente; a defesa real é a policy, que está correta.

---

## 7. DADOS GLOBAIS × DADOS DA ORGANIZAÇÃO

**Por organização (já é assim):** empresas, contatos, leads, oportunidades, palestras e tópicos, agendistas, palestrantes, adiantamentos, estoque/lotes/movimentos, fornecedores e acertos, contas, lançamentos, regras financeiras, bandeiras e taxas de cartão, temporadas, campanhas, projetos, tags, notas, anexos, timeline, snapshots, auditoria, roadmap, decisões, histórico.

**Globais (hoje inexistentes como dado):** versão do sistema, planos, recursos/feature flags, limites, catálogo de módulos, textos legais, configurações técnicas — todos hoje **constantes no código** (`src/lib/modules.ts`, `src/lib/finance.ts`, `src/lib/strategy.ts`, `src/lib/config.server.ts`).

---

## 8. CONFIGURAÇÕES HOJE FIXAS NO CÓDIGO QUE DEVEM VIRAR POR ORGANIZAÇÃO

| Item | Onde está hoje |
|---|---|
| Nome/marca "GBS / Grupo Guerra", assinatura de rodapé | `src/lib/modules.ts`, `src/routes/app.tsx`, `src/components/gbs-mark.tsx`, `index.tsx`, sitemap |
| Logo | asset estático `src/assets/grupo-guerra-logo.png` |
| Paleta/tema (azul-marinho + dourado) | `src/styles.css` |
| **Split 50/50 Gustavo/Agendista** | `src/lib/finance-engine.ts` (existe `financial_rules` por org, mas há defaults embutidos) |
| **Dízimo 10% informativo** | `finance-engine.ts` |
| Métodos de pagamento, categorias, status | `src/lib/finance.ts`, `src/lib/crm.ts`, `src/lib/strategy.ts`, `src/lib/stock.ts` |
| Taxas de cartão | já em `card_brands`/`card_fee_tiers` por org — **OK** |
| Preço de compra/venda, custo médio, estoque mínimo | já em `stock_items` por org — **OK** |
| Fornecedores | campo texto livre em `stock_items`/`supplier_settlements` — deveria ser tabela por org |
| Regras de automação (13 eventos / 9 regras) | `src/lib/automation/rules.ts`, fixas no código |
| Metas e indicadores | parcialmente hardcoded em `app.metas.tsx` / `app.indicadores.tsx` |
| Cabeçalho dos PDFs (marca, cores, dados do emissor) | `agent-statement-export.ts`, `supplier-report-export.ts`, `speaker-report-export.ts`, `report-export.ts` |
| Terminologia de negócio ("Palestra", "Agendista", "Temporada") | rotas e labels — relevante para palestrantes independentes |

---

## 9. ESTRUTURA DE PLANOS

**Não existe nada**: sem `plans`, `subscriptions`, `entitlements`, `usage`, `limits` ou status de assinatura; sem Stripe/Paddle; sem feature flags. Apontado apenas — nada implementado.

---

## 10. GBS ADMIN

**Não existe área administrativa global.** `app.configuracoes.tsx`, `app.auditoria.tsx` e `app.automacoes.tsx` são escopados à organização do usuário. Não há papel de superadmin nem schema/rotas de back-office.

Seria necessário criar (futuramente): papel de plataforma fora de `organization_members`, rotas protegidas separadas, e leituras cross-org via server functions com service role — **nunca** afrouxando RLS.

---

## 11. ARQUITETURA FUTURA PROPOSTA

```
GBS Platform
├─ global: platform_admins · plans · features · subscriptions · usage_counters
└─ Organizations (tenant)
   └─ Organization Members  (user_id + role + status)
      └─ Roles / Permissions (role_permissions: papel → permissão granular)
         └─ Dados da organização (as 28 tabelas já isoladas)
            └─ Storage: {organization_id}/... (convenção já vigente)
```

Preservação do que existe: a chave de tenant (`organization_id`), as funções `private.is_org_member` / `private.has_org_role` e o padrão de 4 policies **permanecem intactos**. Toda a evolução é **aditiva**: novas tabelas globais, uma coluna de permissão nas policies de escrita e um seletor de organização no frontend. Nenhuma tabela de negócio precisa ser recriada ou migrada.

---

## 12. COMPATIBILIDADE MÓDULO A MÓDULO

Sem quebra prevista em: CRM, Palestras, Financeiro, Estoque, Conta Corrente, Livro Razão, Palestrantes, Agendistas, Temporadas, Campanhas, Projetos, Fornecedor, Relatórios, PDFs, Dashboard, IA Guerra e Automação — **todos já leem o tenant de `useCurrentOrg()`**.

Pontos de atenção:
- Trocar "primeira org" por "org ativa" impacta **todos** os módulos ao mesmo tempo (ponto único, mas de alto alcance) — exige invalidação total de cache na troca.
- Motor financeiro e PDFs: precisarão ler marca/regras da organização em vez de constantes.
- Automações: hoje globais no código; ao virar por org, exigem escopo.
- IA Guerra / Assistente: analisa apenas dados já filtrados por org — compatível.

---

## 13. MIGRAÇÃO DO GRUPO GUERRA

A organização do Grupo Guerra **já existe** e já é o tenant de todos os registros atuais. A transformação não requer backfill, reescrita de `organization_id` nem movimentação de arquivos no storage. Estratégia: manter o registro atual como organização nº 1, associá-la ao plano interno/ilimitado quando planos existirem, e migrar branding hardcoded → configuração da organização com **os valores atuais como default**, de modo que a experiência do Grupo Guerra permaneça idêntica. Nenhum dado atual precisa ser alterado.

---

## 14. RELATÓRIO FINAL

1. **Arquitetura atual**: TanStack Start + Lovable Cloud (Postgres), 35 tabelas, tenancy por `organization_id`, RLS via funções security-definer, storage particionado por pasta de organização.
2. **Já pronto para SaaS**: isolamento de dados, isolamento de arquivos, membership N:N, enum de papéis, auditoria automática, timeline automática, provisionamento de org no signup.
3. **Precisa mudar**: seletor de organização ativa, permissões por papel nas policies, recuperação de senha, teardown de cache no logout, branding/regras configuráveis, planos, GBS Admin.
4. **Tabelas que precisam de `organization_id`**: **nenhuma**. Faltam apenas FKs em `season_snapshots` e escopo de org em `user_feedback`.
5. **Policies a alterar**: escrita em todas as 28 tabelas de negócio (diferenciar `viewer` de `member`); UPDATE dos dois tipos de snapshot (imutabilidade); leitura de `user_feedback` por admin de org.
6. **Riscos de segurança**: ALTO → `viewer` com poder de escrita; ALTO → ausência de reset de senha; MÉDIO → snapshots editáveis, logout sem limpar cache; BAIXO → FK e escopo faltantes. **Nenhum vazamento cross-tenant identificado.**
7. **Queries a ajustar**: as 7 páginas `$id` (robustez) e os dois arquivos sem referência a org (`app.projetos.$id.tsx`, `app.campanhas.$id.tsx`).
8. **Storage a isolar**: já isolado; falta bucket/prefixo por org para logos e biblioteca quando existirem uploads.
9. **Configurações a virar por organização**: seção 8 na íntegra.
10. **Organizations**: acrescentar plan_id, status, branding (logo_url, cores), locale/moeda, terminologia, trial/limites.
11. **Members**: acrescentar status (convidado/ativo/suspenso), invited_by/invited_at, last_seen_at; tabela de convites com token.
12. **Roles**: manter enum + criar `role_permissions` (papel → permissão) e checagem `private.has_permission(org, perm)` nas policies de escrita.
13. **Planos**: `plans` (code, nome, preço, ciclo) + `plan_features` (limites: usuários, palestras, storage, orgs).
14. **Assinaturas**: `subscriptions` (organization_id, plan_id, status, período, provider ids) + `usage_counters` por período.
15. **GBS Admin**: `platform_admins` (fora de organization_members) + rotas administrativas isoladas + leituras cross-org apenas via server functions com service role.
16. **Migração do Grupo Guerra**: manter como organização existente; defaults de branding/regras iguais aos valores atuais; zero alteração de dados.
17. **Ordem recomendada**: (1) org ativa + seletor + cache; (2) reset de senha e higiene de logout; (3) permissões por papel; (4) branding e regras por organização; (5) convites e gestão de membros; (6) planos/limites; (7) assinaturas e cobrança; (8) GBS Admin; (9) onboarding self-service.
18. **NÃO alterar**: `organization_id` das linhas existentes, `private.is_org_member` / `private.has_org_role`, convenção de path do storage, motor financeiro (ordem Bruto → Estoque → Taxas → Lucro → Split), snapshots já gravados, imutabilidade do `audit_log`, arquivos autogerados de integração.
19. **Riscos de regressão**: troca de org ativa exibindo dados em cache da org anterior; endurecer papéis pode travar usuários hoje operantes; parametrizar regras financeiras pode alterar resultados de fechamento se defaults divergirem; branding dinâmico pode quebrar layout dos PDFs.
20. **Classificação geral: PARCIALMENTE PRONTA — com base multi-tenant forte.** O isolamento de dados (a parte cara e arriscada) já está feito e correto; falta a camada de produto SaaS (org ativa, permissões, planos, admin, configurabilidade).
