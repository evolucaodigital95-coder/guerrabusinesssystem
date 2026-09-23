# GBS — Fase SaaS Foundation

Auditei o que já existe antes de propor mudanças. Boa parte da fundação já está pronta: organização ativa com seletor, permissões por papel, convites, onboarding, configurações e identidade da organização, planos/assinaturas e a área GBS Admin. O plano abaixo cobre apenas as lacunas reais.

## Já existe e será reaproveitado (sem reescrever)
- Organização ativa com seletor no topo e na barra lateral, memória da última escolha e limpeza total dos dados ao trocar.
- Membros da organização com papel e data de entrada.
- Papéis e matriz de permissões (Proprietário, Administrador, Editor, Visualizador).
- Convites por e-mail com papel, status e validade.
- Configurações da organização: dados da empresa, logo, cores, moeda e módulos.
- Planos, assinaturas e status (teste, ativa, atrasada, cancelada) + limites já previstos no plano.
- GBS Admin separado (clientes, planos, auditoria).
- Auditoria automática das alterações e isolamento por organização em todas as tabelas.

## Lacunas que serão implementadas

### 1. Acesso e conta (maior lacuna)
- "Esqueci minha senha" na tela de entrada, com envio de link por e-mail.
- Nova página de redefinição de senha, que abre pelo link recebido e leva à entrada ao concluir.
- Nova página **Minha conta**: nome, e-mail, foto, organizações e papel (somente leitura), troca de senha e encerrar sessão.
- Mensagens de erro em português claro (e-mail/senha inválidos, e-mail não confirmado, link expirado).
- Encerramento de sessão limpando todo o cache, sem voltar pelo botão "voltar".

### 2. Situação da organização
- Cada organização passa a ter situação: **Ativa**, **Suspensa** ou **Cancelada** (nenhum dado é apagado).
- Organização suspensa/cancelada: leitura e exportação continuam, criação/edição/exclusão bloqueadas no banco, com aviso no topo.
- Membros ganham situação (ativo/inativo) explícita; membro inativo não acessa a organização.
- Alteração de situação feita pelo GBS Admin e registrada na auditoria.

### 3. Correções de segurança encontradas
- **Envio de arquivos**: hoje qualquer membro, incluindo Visualizador, pode enviar e sobrescrever arquivos. Será restrito a quem tem permissão de escrita.
- Revisão completa das regras de acesso de todas as tabelas com dados de organização (leitura, criação, edição, exclusão), confirmando que nenhuma permite ver dados de outra empresa.
- Verificação de que nenhum arquivo de uma organização é acessível por outra.

### 4. Marca por organização nos documentos
- Os documentos e PDFs passam a usar logo, nome e cores da organização ativa, mantendo a identidade Grupo Guerra para a organização do Grupo Guerra. Sem mudar layout nem valores.

### 5. Navegação e experiência
- Topo padronizado: logo, nome da organização e menu do usuário com Minha conta, tema e sair.
- Itens de menu escondidos conforme o papel (a autorização real continua no banco).

## Testes que vou executar
- Criação de duas organizações de teste com dados distintos e verificação, direta no banco e pela interface, de que uma nunca enxerga a outra em CRM, financeiro, estoque, palestras, agendistas, documentos, conta corrente e fechamentos.
- Tentativa de acesso direto a registros de outra organização (deve ser bloqueado).
- Visualizador tentando criar, editar, excluir e enviar arquivo (deve ser bloqueado no banco, não só na tela).
- Troca de organização verificando que nenhum dado antigo permanece.
- Entrada, sessão persistente, saída, recuperação e redefinição de senha.
- Organização suspensa tentando gravar dados.
- Ao final, os dados de teste são removidos.

## Não será feito nesta fase
Cobrança real, publicação nas lojas, novos módulos, mudanças no motor financeiro, nos cálculos, nas comissões, nos snapshots ou nos fechamentos. Nenhum dado fictício permanece no sistema.

## Detalhes técnicos
- Migração: `organizations.status` (enum `org_status`), `organization_members.status` + `joined_at`; funções `private.is_org_active`, `private.can_write` passa a exigir organização ativa e membro ativo; políticas de `storage.objects` de INSERT/UPDATE migradas de `is_org_member` para `can_write`.
- Novas rotas: `/redefinir-senha`, `/app/minha-conta`. Ajustes em `src/routes/index.tsx` (link de recuperação), `src/routes/app.tsx` (menu do usuário, aviso de organização suspensa), `src/components/org-provider.tsx` (expor situação da organização).
- Branding: helper `useOrgBranding` alimentando os exportadores de PDF existentes por parâmetro, sem alterar cálculos.
- Relatório final `RELATORIO-SAAS-FOUNDATION.md` com os 13 itens pedidos, incluindo falhas encontradas.
