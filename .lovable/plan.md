# Plano — Ajustes no Extrato + Centro Financeiro do Palestrante

O trabalho tem três frentes, todas na mesma entrega. **Nenhuma delas cria nova fonte de verdade**: tudo lê `lecture_financial_snapshots`, `financial_movements`, `advances`, `lectures`, `companies` e `agents` — os mesmos dados que já alimentam o Motor Financeiro.

---

## Frente 1 — Ajustes no PDF do Extrato do Agendista

Arquivo: `src/lib/agent-statement-export.ts` e caller em `src/routes/app.agendistas.$id.tsx`.

1. **Logo Grupo Guerra no cabeçalho do PDF**
   - Registrar a logo enviada (`user-uploads://hf_20260604_150902_...png`) como asset estático em `src/assets/grupo-guerra-logo.png.asset.json`.
   - Pré-carregar como dataURL no `exportStatementPDF` (fetch + FileReader) e desenhar no header (canto esquerdo, ~44pt), mantendo o layout navy/gold atual.
   - Adicionar também como marca d'água discreta (opacidade ~5%) no centro de cada página.

2. **Juros do cartão explícitos no documento**
   - Hoje o campo aparece na composição de créditos, mas não no detalhamento por palestra. Adicionar coluna dedicada "Juros Cartão" na tabela "Palestras Fechadas" (já é derivado de `breakdown.totalCardFees` no snapshot).
   - Nova subseção **"Deduções por Palestra"** listando, para cada palestra: bruto, materiais, **juros/taxa cartão** (com bandeira e parcelas quando houver), taxa da regra, outros custos, lucro líquido. Já lemos esse detalhe em `app.agendistas.$id.tsx` — só falta expor no PDF.

---

## Frente 2 — Novo Módulo: Centro Financeiro do Palestrante

Rota: `src/routes/app.centro-palestrante.tsx` (nova). Item no sidebar dentro de "Financeiro".

Arquitetura de dados — **uma única query central** (`useCentroPalestrante`) que agrega:
- `lecture_financial_snapshots` (JOIN `lectures`, `companies`, `agents`, `seasons`, `campaigns`, `projects`).
- `financial_movements` (pagamentos ao palestrante — categoria "Pró-labore"/"Palestrante").
- `advances` (adiantamentos que o palestrante concedeu / recebeu, conforme papel).
- `lectures` sem snapshot (para "A receber" / "Previsão de recebimentos").

**Nunca recalcular histórico** — todos os valores retro vêm dos snapshots congelados. Valores atuais (previsões) usam `lectures.gross_amount` e regra vigente.

### Seções da página (uma rota, abas)

Layout premium: Header executivo com nome do palestrante (Gustavo), período (seletor global), botão exportar PDF/XLSX/CSV.

**Aba 1 — Dashboard Executivo**
KPIs em cards navy/gold: Saldo Atual, A Receber, Recebido, Adiantamentos Abertos, Lucro Líquido Mês, Lucro Líquido Ano, Receita Bruta, Custos Totais, Margem %, Dízimo Sugerido, # Empresas, # Palestras, # Pessoas Impactadas.

**Aba 2 — Extrato Detalhado**
Tabela cronológica com colunas: Data · Empresa · Palestra · Valor Vendido · Materiais · Juros/Taxas · Outros Custos · Lucro Líquido · Parte Palestrante · Dízimo · Saldo Acumulado. Filtros: empresa, palestra, cidade, estado, temporada, campanha, projeto, período.

**Aba 3 — Resultados** (sub-tabs internas)
- Por Empresa (ranking): palestras, receita, lucro, % palestrante, % agendista, pessoas, margem.
- Por Agendista: palestras, receita, lucro, % participação, ticket médio, público.
- Por Cidade: palestras, receita, lucro, pessoas.
- Por Temporada: receita, lucro, palestras, empresas, pessoas.

**Aba 4 — Evolução Mensal**
Recharts: linha de Receita Bruta vs Lucro Líquido; barras de # Palestras e # Empresas; linha de Pessoas Impactadas; linha de Ticket Médio.

**Aba 5 — Rentabilidade por Palestra**
Tabela com heatmap de margem (verde/âmbar/vermelho): bruto, material, taxas, custos, lucro, margem, resultado palestrante, resultado agendista. Ordenável por margem.

**Aba 6 — Adiantamentos & Pagamentos**
Duas seções lado a lado: adiantamentos (data, valor, responsável, forma, observação, saldo após) e pagamentos (data, forma, conta, comprovante, valor, saldo restante). Lê de `advances` e `financial_movements`.

**Aba 7 — Dízimo (Informativo)**
Cards: dízimo do mês, do ano, acumulado (10% sobre `gustavo_amount` dos snapshots). Aviso claro "Apenas informativo — nunca descontado automaticamente". Tabela de origem por palestra.

**Aba 8 — Metas & Previsão**
- Metas: input local (persistido em `localStorage` por enquanto — pergunto se querem tabela dedicada) mensal e anual, com barras de progresso.
- Previsão de Recebimentos: palestras confirmadas/agendadas sem snapshot, com valor previsto, data e empresa.

### Exportação PDF Premium

`src/lib/speaker-report-export.ts` (novo, reutiliza estilo do agent-statement-export):
Header com logo Grupo Guerra + marca d'água, resumo executivo, indicadores, resultados por empresa/agendista/cidade/temporada, extrato, mini-gráficos renderizados como imagem (recharts → `toDataURL` via `html-to-image`), rodapé institucional, paginação, QR Code (usando `qrcode` — se não tiver, adiciono) apontando para hash do relatório.

Também XLSX e CSV via `report-export.ts` existente.

---

## Frente 3 — Testes & Validação

1. Comparar totais do Centro Palestrante com totais somados diretamente dos snapshots (script node ad-hoc).
2. Verificar que "Saldo Atual" = Recebido − Adiantamentos abatidos, cruzando com Livro Razão.
3. Testar filtros (empresa, período, temporada) e conferir que somas batem com os subtotais.
4. Gerar o PDF e inspecionar visualmente (logo, marca d'água, tabelas dentro da página, QR).

---

## Detalhes técnicos

**Arquivos novos**
- `src/assets/grupo-guerra-logo.png.asset.json` (pointer via `lovable-assets`)
- `src/routes/app.centro-palestrante.tsx`
- `src/lib/speaker-report-export.ts`
- `src/hooks/use-speaker-finance.ts` (query agregada)

**Arquivos alterados**
- `src/lib/agent-statement-export.ts` (logo + coluna juros cartão + seção deduções por palestra)
- `src/routes/app.agendistas.$id.tsx` (passar detalhes de card fees ao PDF — já está preparado; garantir que estão sendo enviados)
- `src/lib/modules.ts` ou sidebar equivalente (adicionar item "Centro do Palestrante" na seção Financeiro)

**Dependências novas (se faltar)**
- `qrcode` para QR de autenticidade.
- `html-to-image` para converter gráficos em PNG no PDF.

**Riscos**
- Renderizar gráficos recharts no PDF exige montá-los off-screen; se ficar pesado, gero versões estáticas via jsPDF nativo (linhas/barras).
- Metas: sem tabela dedicada, uso `localStorage` — se você preferir persistência real, criamos `speaker_goals` na base (uma migration a mais).

---

**Pergunta antes de executar:** confirma o uso de `localStorage` para as metas, ou quer que eu já crie uma tabela `speaker_goals` no banco? Se não responder, sigo com `localStorage` (mais rápido, sem migration) e deixo a troca fácil no futuro.
