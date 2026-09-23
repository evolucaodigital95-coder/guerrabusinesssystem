/** Traduz erros de autenticação para português claro. */
export function authErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password should be")) return "A senha deve ter no mínimo 6 caracteres.";
  if (m.includes("same password")) return "A nova senha deve ser diferente da atual.";
  if (m.includes("current password") || m.includes("invalid password"))
    return "Senha atual incorreta.";
  if (m.includes("expired") || m.includes("invalid token") || m.includes("otp"))
    return "Link expirado ou já utilizado. Solicite um novo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sem conexão com o servidor. Verifique sua internet.";
  return raw || "Não foi possível concluir a operação.";
}
