# GBS — Motor de Automações (Event Engine)

**Data:** 2026-08-03 · **Escopo:** automação e auditoria. Nenhuma regra financeira, cálculo ou estrutura de banco foi alterada.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `src/lib/automation/events.ts` | Catálogo de 13 eventos de negócio |
| `src/lib/automation/rules.ts` | 8 regras declarativas de reação |
| `src/lib/automation/engine.ts` | Motor: executa regras, isola falhas, grava log |
| `src/hooks/use-automation.ts` | Ponto único de disparo na interface (`emit`) |
| `src/routes/app.automacoes.tsx` | Painel de regras, log auditável e testes |

## Eventos monitorados

Empresa criada/atualizada · Palestra criada/atualizada · Fechamento financeiro ·
Lançamento criado/atualizado · Pagamento recebido · Pagamento efetuado ·
Estoque movimentado · Entrada de lote · Adiantamento realizado · Acerto com fornecedor.

## Regras automáticas

1. Sincronizar painéis executivos (Dashboard, Hoje, Agenda, Indicadores, Painel do Diretor, Inteligência, Centro do Palestrante)
2. Sincronizar CRM (lista + ficha da empresa relacionada)
3. Sincronizar palestras (agenda + Central da Palestra + fechamento)
4. Sincronizar livro razão (lançamentos, contas, saldos)
5. Sincronizar conta corrente dos agendistas (extrato, adiantamentos)
6. Sincronizar estoque (itens, lotes, movimentações, fornecedores)
7. Sincronizar temporadas (painel, campanhas, projetos)
8. Registrar na timeline da entidade (`kind = automation`)
9. Sincronizar busca global e trilha de auditoria

## Log de auditoria

Cada execução registra: **data/hora**, **usuário**, **evento**, **regra**, **resultado**, duração (ms) e se foi simulação. Consultável e filtrável em **Sistema → Automações**, com limpeza manual e limite de 400 registros.

## Testes executados

Bateria automatizada sobre os 13 eventos, com contexto simulado:

```
company.created              3 regras ok
company.updated              2 regras ok
lecture.created              5 regras ok
lecture.updated              2 regras ok
lecture.closed               9 regras ok
finance.movement.created     7 regras ok
finance.movement.updated     2 regras ok
finance.payment.received     3 regras ok
finance.payment.made         4 regras ok
stock.movement.created       5 regras ok
stock.batch.created          2 regras ok
advance.created              5 regras ok
supplier.settlement.created  5 regras ok

267 invalidações · 6 registros de timeline · 0 falhas
```

Typecheck do projeto: sem erros.

## Garantias

- Falha de uma regra nunca derruba a operação do usuário (execução isolada com log de erro).
- O motor não calcula valores — apenas propaga atualizações e registra histórico.
- Nenhuma migração de banco foi necessária.
