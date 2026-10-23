# GBS Event Engine — Fase 2.1

## Eventos criados (12)
| Evento | Chave interna |
| --- | --- |
| Empresa criada | company.created |
| Empresa editada | company.updated |
| Palestra criada | lecture.created |
| Palestra alterada | lecture.updated |
| Palestra encerrada / Fechamento financeiro | lecture.closed |
| Pagamento registrado | finance.movement.created |
| Lançamento alterado | finance.movement.updated |
| Pagamento confirmado (entrada) | finance.payment.received |
| Pagamento confirmado (saída) | finance.payment.made |
| Entrada de estoque | stock.batch.created |
| Saída de estoque | stock.movement.created |
| Adiantamento realizado | advance.created |
| Acerto com fornecedor | supplier.settlement.created |

## Fila de execução
Cada evento gera um `runId` e entra numa fila serializada (uma execução por vez,
sem concorrência sobre o cache). As etapas rodam em sequência e são registradas
individualmente: `etapa X de N`, resultado, usuário, data/hora e tempo (ms).

Exemplo — **Palestra encerrada** dispara 8 etapas: painéis executivos, CRM,
palestras, livro razão, conta corrente do agendista, estoque/fornecedor,
temporadas/campanhas/projetos, timeline e busca/auditoria.

## Isolamento de falhas
Uma etapa que falha não interrompe as demais. O log guarda a etapa exata,
mensagem de erro crua, data, hora, usuário e tempo de execução.

## Monitor interno (Sistema → Automações)
- Regras ativas · Etapas executadas · Concluídas · Falhas · Na fila · Tempo médio (ms)
- Lista da fila (aguardando / executando)
- Bloco "Eventos com erro" com etapa e mensagem
- Log completo filtrável por evento + botão de testes em modo simulação

## Tempo médio
Em teste de simulação dos 13 eventos: **< 5 ms por etapa** (invalidações de cache),
exibido em tempo real no monitor.

## Arquivos alterados
- `src/lib/automation/engine.ts` — fila, runId, log por etapa, erro detalhado
- `src/lib/automation/events.ts` — catálogo alinhado à Fase 2.1
- `src/routes/app.automacoes.tsx` — monitor com fila, erros e tempo médio

Nenhuma regra financeira, cálculo ou tabela do banco foi alterada.

## Possíveis melhorias
- Persistir o log em tabela dedicada para auditoria multiusuário
- Retry automático com backoff para etapas que dependem de rede
- Alertas ao diretor quando a taxa de erro passar de um limite
