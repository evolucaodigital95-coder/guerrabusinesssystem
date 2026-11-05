# Revisão de redundâncias — GBS

## Escopo

Revisão de navegação, telas, referências e controles compartilhados. Limpeza conservadora: nenhuma exclusão de dados reais, tabela, política de acesso ou regra financeira.

## Removido ou simplificado

- Retirado o segundo conjunto de seis cartões “Seu dia” da página inicial: repetia o resumo operacional existente, sem compartilhar seus filtros.
- Retirado o indicador “Meta do mês”: seu valor era fixo em zero e não consultava as metas configuradas.
- Retirado o indicador simplificado “Estoque baixo”: contava itens com quantidade mínima cadastrada, não itens efetivamente abaixo do mínimo. O alerta existente do resumo operacional permanece.
- Retiradas consultas da página inicial que só alimentavam esses cartões, incluindo uma consulta de temporada explicitamente marcada como placeholder e sem uso.
- Mantidos os três indicadores do cabeçalho e o resumo operacional com prioridades, filtros, agenda e ações.
- “Plano e cobrança” passou a “Minha assinatura”, coerente com a tela existente e com a ausência de integração de pagamento.
- “Configurações” passou a “Sobre e feedback”: essa página não continha ajustes. Os ajustes reais continuam em Organização.
- Retirado o atalho repetido dessa página no menu da conta; permanece no menu lateral.
- Retirados versão, build, arquitetura e “Última atualização” sem fonte verificável. A suposta atualização era apenas a data em que a página era aberta.
- Retirada a lista antiga de “novidades” que repetia os módulos do menu.
- Unificados os imports de anexos em `src/components/shared/attachments-tab.tsx`, que agora contém a implementação original. Removido o arquivo intermediário em CRM; comportamento, permissões e bucket preservados.

## Preservado

CRM, Financeiro, Estoque, Palestras, Agendistas, Conta Corrente, fechamentos, snapshots, planos e assinaturas, metas, automações, documentos e Central de Inteligência. Essas áreas têm funções próprias; não foram removidas por semelhança de nome ou conteúdo.

O endereço antigo `/app/dashboard` continua redirecionando para Início, para preservar links salvos. URLs de organização, assinatura e feedback permanecem iguais.

## Verificação prática

Sessão autenticada da conta solicitante, sem inserir ou modificar registros.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Problema antes da limpeza | Confirmado | A página inicial exibia os dois resumos, “Meta do mês” e o alerta simplificado de estoque. |
| Página inicial após limpeza | PASS | Um resumo operacional; nenhum cartão “Meta do mês”, “Estoque baixo” ou seção “Seu dia”. |
| Menu | PASS | “Minha assinatura” e “Sobre e feedback” disponíveis. |
| Feedback | PASS parcial | Diálogo “Ideia” abriu e foi cancelado; não foi enviado feedback de teste. |
| CRM, Financeiro e Inteligência | PASS de abertura | Títulos Empresas, Livro Razão e Central de Inteligência renderizados. Não equivale a teste completo de cada módulo. |
| Link legado Dashboard | PASS | Navegação para `/app/dashboard` terminou em `/app/hoje`. |
| Tela menor | PASS | Menu aberto, navegação para feedback e ausência de transbordamento horizontal em 797×642. |
| Erros de navegador | PASS | Nenhum erro de execução capturado no percurso. |
| Compilação automática | PASS | Últimas entradas disponíveis do registro indicam `build OK`. |

## Limitações

A revisão não estabelece que todo o sistema esteja livre de redundâncias. Não foram excluídos registros possivelmente duplicados: identificar duplicidade de negócio e decidir qual histórico preservar exige validação individual. Não foram executados uploads, exclusões, fechamentos ou alterações financeiras. Nenhum dado temporário foi criado; não houve migração.