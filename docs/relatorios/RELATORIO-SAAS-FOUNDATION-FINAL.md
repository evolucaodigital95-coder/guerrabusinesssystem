# GBS — SaaS Foundation · Relatório Final de Validação

Ambiente temporário: organizações `ZZ-TESTE Empresa Alpha` e `ZZ-TESTE Empresa Beta` (1 empresa, 1 agendista, 1 lançamento, 1 documento cada; Alpha verde #1B7F5A, Beta bordô #7A1F3D). Testes executados com token real contra o banco (regras de acesso aplicadas) e no navegador real. Todos os dados foram removidos ao final.

**Limitação importante:** não foram criadas contas de login novas (teste-a/teste-b). Foi usada uma única conta real da equipe, ligada a uma organização por vez; o papel "Visualizador" e o membro inativo foram simulados alterando temporariamente o papel/status dessa conta.

| # | TESTE | STATUS | EVIDÊNCIA | OBSERVAÇÃO |
|---|---|---|---|---|
| 1 | Isolamento entre organizações | PASS | Membro de Alpha leu 1 empresa/agendista/lançamento/documento de Alpha e 0 de Beta | Mesma conta, membership de uma org por vez |
| 2 | Acesso direto a ID de outra org | PASS | Consulta por ID de Beta retornou 0 linhas | — |
| 3 | RLS leitura | PASS | 0 linhas de Beta em todas as tabelas testadas | — |
| 4 | RLS criação | PASS | INSERT em Beta → HTTP 403 / 42501 | — |
| 5 | RLS edição | PASS | UPDATE em Beta afetou 0 linhas; dado preservado | — |
| 6 | RLS exclusão | PASS | DELETE em Beta afetou 0 linhas; dado preservado | — |
| 7 | Visualizador cria | PASS | INSERT → 403 | Papel trocado temporariamente |
| 8 | Visualizador edita | PASS | 0 linhas afetadas | idem |
| 9 | Visualizador exclui | PASS | 0 linhas afetadas | idem |
| 10 | Visualizador envia arquivo | PASS | Upload → 400 (bloqueado) | idem |
| 11 | Isolamento de arquivos | PASS | Upload na pasta Alpha 200; na pasta Beta 400 | — |
| 12 | Troca de organização | PASS | Navegador: CRM em Alpha mostrou só empresas Alpha; após troca, Beta mostrou só a empresa Beta | Capturas de tela conferidas |
| 13 | Limpeza de estado ao trocar | PASS | Nenhum registro de Alpha visível em Beta após troca | — |
| 14 | Login | PASS | Login inválido → "Invalid login credentials"; sessão válida abriu o painel | Login válido via sessão emitida, não digitado no formulário |
| 15 | Sessão persistente | PASS | Recarregar a página manteve o acesso | — |
| 16 | Logout + voltar | PASS | Após sair, /app/dashboard redirecionou para "/"; botão Voltar não exibiu dados | — |
| 17 | Recuperação de senha | NÃO TESTADO | — | Não há caixa de e-mail de teste acessível para receber o link |
| 18 | Redefinição / link inválido, expirado, usado | NÃO TESTADO | — | Depende do item 17 |
| 19 | Organização suspensa | PASS | Leitura OK; criar 403, editar/excluir 0 linhas, upload 400; reativada | Aviso visual verificado na rodada anterior |
| 20 | Organização cancelada | PASS | Mesmo resultado; nenhum dado apagado; reativada | — |
| 21 | Membro inativo | PASS | 0 linhas lidas; criar/enviar bloqueados; reativado | — |
| 22 | Permissões por papel | PASS | Admin cria/edita/exclui; Visualizador só lê | — |
| 23 | Documentos | PASS | 0 documentos de Beta vistos por Alpha | — |
| 24 | Conta corrente | PASS | 0 adiantamentos/lançamentos de Beta | — |
| 25 | Fechamentos | PASS | 0 fechamentos de Beta | — |
| 26 | Financeiro | PASS | 0 lançamentos de Beta | — |
| 27 | Estoque | PASS | 0 itens de Beta | — |
| 28 | CRM | PASS | 0 empresas de Beta (banco e tela) | — |
| 29 | Palestras | PASS | 0 palestras de Beta | — |
| 30 | PDFs com a organização correta | PASS | Extrato baixado em Alpha: "EMPRESA ALPHA"; em Beta: "EMPRESA BETA"; sem identidade cruzada | Grupo Guerra usa o padrão original (código sem alteração de layout); PDF do Grupo Guerra não foi baixado nesta rodada |
| 31 | Auditoria administrativa | PASS (após correção) | Suspender, reativar, cancelar, trocar papel e desativar/reativar membro geraram 8 registros com ação, organização, data/hora, alvo e antes/depois | Antes da correção, troca de papel e desativação de membro NÃO eram registradas |
| 32 | Dados de teste removidos | PASS | Contagem no banco: 0 orgs, empresas, agendistas, lançamentos, documentos, membros, arquivos e registros de auditoria de teste | — |

**TOTAL PASS: 30 · TOTAL FAIL: 0 · TOTAL NÃO TESTADO: 2**

**FASE APROVADA** — sem falhas; pendentes apenas os testes 17 e 18 (recuperação de senha por e-mail).

## Correções realizadas
1. PDFs (extrato do agendista, termo de fechamento, relatórios, palestrante, fornecedor) passam a usar nome, logo e cores da organização ativa; Grupo Guerra inalterado.
2. Auditoria automática no servidor de mudança de status de organização e de papel/status/entrada/saída de membros.

## Arquivos alterados
`src/lib/doc-brand.ts`, `src/hooks/use-doc-brand.ts`, `src/lib/agent-statement-export.ts`, `src/lib/closing-term-export.ts`, `src/lib/speaker-report-export.ts`, `src/lib/supplier-report-export.ts`, `src/lib/report-export.ts` e seus chamadores (`app.agendistas.$id.tsx`, `account-closing.tsx`, `supplier-accounts-tab.tsx`, relatórios).

## Banco
Nova função `audit_admin_change` + gatilhos em `organizations` e `organization_members`. Nenhuma regra financeira, comissão, dízimo, snapshot ou fechamento alterado.

## Limitações
- Sem contas de login separadas por organização; sem teste de e-mail de recuperação.
- Registros de auditoria gerados pelo teste via banco ficaram sem autor (ações feitas pelo app registram o usuário).
