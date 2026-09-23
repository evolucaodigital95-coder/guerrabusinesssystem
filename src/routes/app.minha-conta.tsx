import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ROLE_LABEL } from "@/lib/permissions";
import { authErrorMessage } from "@/lib/auth-messages";

export const Route = createFileRoute("/app/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — GBS" },
      {
        name: "description",
        content: "Gerencie seu nome, e-mail, organizações, papel e senha de acesso ao GBS.",
      },
      { property: "og:title", content: "Minha conta — GBS" },
      {
        property: "og:description",
        content: "Gerencie seu nome, e-mail, organizações, papel e senha de acesso ao GBS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Minha conta — GBS" },
      {
        name: "twitter:description",
        content: "Gerencie seu nome, e-mail, organizações, papel e senha de acesso ao GBS.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const { user } = useSession();
  const { memberships, organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data?.full_name) setFullName(profile.data.full_name);
  }, [profile.data?.full_name]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      } as Parameters<typeof supabase.auth.updateUser>[0]);
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso.");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  async function signOutEverything() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const initials = (fullName || user?.email || "GG").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <PageHeader title="Minha conta" description="Seus dados de acesso, organizações e senha." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-border bg-card text-sm font-medium">
                {profile.data?.avatar_url ? (
                  <img
                    src={profile.data.avatar_url}
                    alt="Foto do usuário"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{fullName || "Sem nome"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Nome completo</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" value={user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  O e-mail de acesso é definido no cadastro e não pode ser alterado aqui.
                </p>
              </div>
              <Button type="submit" variant="navy" size="sm" disabled={savingProfile}>
                {savingProfile ? "Salvando…" : "Salvar perfil"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha atual</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="navy" size="sm" disabled={savingPassword}>
                {savingPassword ? "Alterando…" : "Alterar senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organizações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Você ainda não pertence a nenhuma organização.
            </p>
          )}
          {memberships.map((m) => (
            <div
              key={m.organizationId}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{m.organizationName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</p>
              </div>
              {m.organizationId === organizationId && <Badge variant="secondary">Ativa</Badge>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            O seu papel só pode ser alterado por um administrador da organização.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessão</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Sua sessão permanece ativa neste dispositivo até você sair.
          </p>
          <Button variant="outline" size="sm" onClick={signOutEverything}>
            <LogOut className="mr-2 h-4 w-4" /> Encerrar sessão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
