# GBS — FASE SAAS FOUNDATION

## O que foi entregue nesta fase

### 1. Acesso e conta do usuário
- **Esqueci minha senha** na tela de entrada, com envio de link para o e-mail.
- Nova página **/redefinir-senha**: valida o link de recuperação, permite criar a nova senha e trata link inválido/expirado.
- Mensagens de autenticação traduzidas para português (`src/lib/auth-messages.ts`).
- Nova página **Minha conta** (`/app/minha-conta`): nome, e-mail, organizações e papéis, troca de senha e encerramento de sessão.
- Sair agora limpa todo o cache de dados antes de encerrar a sessão.

### 2. Status da organização e do membro
- `organizations` ganhou `status` (Ativa / Suspensa / Cancelada), `status_reason` e `status_changed_at`.
- `organization_members` ganhou `status` e `joined_at`.
- As funções de segurança do banco (`is_org_member`, `has_org_role`, `can_write`, `is_org_active`) passaram a exigir **membro ativo em organização ativa**.
- Organização suspensa/cancelada: leitura e exportação continuam liberadas, **escrita bloqueada** no banco e na interface.
- Aviso permanente no topo do sistema quando a organização não está ativa.
- O seletor de organizações mostra o status quando não é "Ativa".

### 3. GBS Admin
- No detalhe do cliente há o bloco **Status da organização**, com botões Suspender, Cancelar e Reativar, campo de motivo e registro automático na auditoria da plataforma.

### 4. Arquivos e documentos
- Envio e alteração de arquivos no armazenamento passaram a exigir permissão de escrita — Visualizador não envia nem sobrescreve arquivos.
- Novo `useOrgBranding`: nome, logo e cores da organização disponíveis para os documentos, sem tocar em nenhum cálculo.

## O que foi preservado
Nenhuma regra financeira, comissão, snapshot, fechamento, cálculo ou dado real foi alterado. Nenhum dado fictício foi criado e nenhum módulo foi removido.

## Verificações
- Compilação e checagem de tipos limpas.
- Página de redefinição de senha respondendo normalmente.
- Migração aplicada com sucesso.

## Pendências conhecidas
- O verificador de segurança sinaliza que usuários autenticados podem executar a função de numeração de fechamento (`next_closing_number`). É intencional: o próprio sistema a chama ao fechar conta e ela valida, internamente, se a pessoa pertence à organização.
- A troca de senha dentro de Minha conta envia a senha atual; o comportamento exato depende da configuração de autenticação e deve ser confirmado em uso real.
- Testes end-to-end com duas organizações reais e um usuário Visualizador dependem de contas de teste.
