# Polimento Final GBS — Plano de Execução

O escopo pedido é enorme (14 frentes cruzando UX, motor financeiro, PDF, performance, validações). Para entregar com qualidade e sem regressão, proponho executar em **5 ondas sequenciais**, cada uma auditada + corrigida + verificada antes de seguir. Você aprova o plano uma vez; eu executo as ondas em turnos subsequentes e sinalizo ao final de cada uma para você validar visualmente.

## Onda 1 — Correções críticas de navegação e cálculo (bloqueadores)
Foco no que está quebrado ou matematicamente instável hoje.
- **Livro Razão**: varrer todos os links do Sheet e da tabela; garantir que empresa/palestra/agendista/temporada/projeto/conta arquivados não gerem 404; abrir rotas em nova aba quando fizer sentido; badge de status 100% não-clicável.
- **Fechamento de palestra**: cálculo sempre vivo (nunca ler snapshot obsoleto para exibição); banner de divergência + botão "Recalcular" já existente revisto; garantir que saída de estoque vinculada à palestra entre no subtotal imediatamente.
- **Motor financeiro**: auditar ordem Receita → Materiais → Taxas → Custos → Lucro → Split 50/50 → Dízimo informativo. Testar E2E com uma palestra real e comparar valores linha a linha.
- **Conta Corrente do agendista**: garantir 1 crédito por snapshot (sem duplicar em rebuild), origem rastreável em cada linha.

## Onda 2 — UX de formulários (menos cliques, mais autopreenchimento)
- Selecionar palestra em qualquer diálogo (financeiro, estoque, adiantamento) autopreenche empresa, contato, agendista, temporada, campanha, projeto — campos ficam readonly com opção "trocar".
- Estoque simplificado: 3 tipos de movimento (Entrada / Saída para palestra / Ajuste). Custo, preço e valor nunca mais são pedidos ao usuário — sempre buscados do item/lote.
- Validações humanas: mensagens em português, sem stack técnica; bloquear duplo-clique em todos os botões de submit (disable + spinner enquanto mutation roda).
- Padronizar AlertDialog de confirmação, toasts de sucesso/erro, e loading states.

## Onda 3 — Fluxo guiado + Central da Palestra
- **Checklist da palestra** no topo do detalhe: Empresa ✓, Contato ⚠, Agendista ✓, Receita ⚠, Estoque ⚠, Fechamento pendente… cada item clicável abre o diálogo correspondente.
- **Central da Palestra**: reordenar abas para refletir ciclo (Visão → Financeiro → Estoque → Fechamento → Timeline → Anexos → Notas), consolidar dados dispersos.
- **Dashboard**: revisar cards para mostrar métricas realmente úteis (Receita mês, Lucro mês, Margem %, Melhor agendista, Maior empresa, Próximas palestras, Pendências acionáveis).
- **Hoje**: pendências operacionais reais (fechamentos pendentes, receitas não lançadas, estoque baixo).

## Onda 4 — PDF executivo + Exportações
- Auditar PDF do agendista (já premium) e replicar mesma linguagem visual em: extrato do palestrante, fechamento da palestra, snapshot da temporada.
- Header institucional, marca d'água, rodapé com numeração e ID do documento, hierarquia tipográfica consistente.
- Garantir que todo relatório baixável (CSV, XLSX, PDF) tenha metadata coerente (período, filtros aplicados, autor).

## Onda 5 — Performance, padronização visual e polimento
- **Performance**: React Query staleTime/gcTime revisados; queries duplicadas consolidadas; `select` do Supabase enxuto (só colunas usadas); memoização em listas grandes.
- **Padronização**: espaçamento, tamanhos de fonte, botões, tabelas, modais e filtros usando mesmos tokens/variantes shadcn. Auditoria visual página por página.
- **Auditoria de rotas**: varredura automatizada para links quebrados; toda rota inexistente cai no notFound consistente.
- **Relatório final** com erros encontrados, arquivos alterados, riscos restantes e sugestões futuras.

## Como vou trabalhar
- Cada onda é 1 turno (às vezes 2 se for grande). No fim de cada onda paro e te aviso o que mudou + o que testar visualmente.
- Não crio módulos novos. Não altero schema do banco a menos que uma correção crítica exija (aí eu pergunto antes).
- Não toco identidade visual (paleta navy/gold, tipografia, layout base).
- Se durante uma onda eu descobrir algo que exige decisão sua (ex: comportamento ambíguo), paro e pergunto em vez de assumir.

## Confirmação
Aprovar este plano me autoriza a começar pela **Onda 1** no próximo turno. Se quiser reordenar ondas (ex: PDF antes de UX), ou executar só uma parte, me diga qual.
