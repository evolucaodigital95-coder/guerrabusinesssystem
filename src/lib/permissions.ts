/**
 * Matriz de permissões do GBS (SaaS Fase 1).
 *
 * Os papéis existentes no banco (enum `org_role`) são:
 *   owner | admin | member | viewer
 *
 * Mantemos o enum intacto por compatibilidade. O papel `member` cumpre
 * o papel de EDITOR / MANAGER descrito na especificação:
 *
 *   OWNER   -> acesso total (inclui excluir, usuários e configurações)
 *   ADMIN   -> acesso operacional completo + equipe + configurações + excluir
 *   MEMBER  -> criar, editar e visualizar (sem excluir, sem usuários)
 *   VIEWER  -> somente leitura
 *
 * A interface usa esta matriz para esconder/desabilitar ações.
 * O isolamento e o bloqueio definitivo continuam sendo do RLS
 * (`private.is_org_member` para leitura, `private.can_write` para escrita,
 * `private.has_org_role` para exclusão).
 */

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Editor",
  viewer: "Visualizador",
};

export type Permission =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "finance.write"
  | "stock.write"
  | "settings"
  | "members.manage";

const MATRIX: Record<OrgRole, Permission[]> = {
  owner: ["view", "create", "edit", "delete", "finance.write", "stock.write", "settings", "members.manage"],
  admin: ["view", "create", "edit", "delete", "finance.write", "stock.write", "settings", "members.manage"],
  member: ["view", "create", "edit", "finance.write", "stock.write"],
  viewer: ["view"],
};

export function hasPermission(role: OrgRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  "finance.write": "Movimentar financeiro",
  "stock.write": "Movimentar estoque",
  settings: "Configurações",
  "members.manage": "Gerenciar usuários",
};
