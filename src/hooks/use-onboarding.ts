import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import {
  computeProgress,
  DEFAULT_FINANCE,
  ONBOARDING_STEPS,
  type OnboardingStepKey,
  type OrgOnboarding,
  type OrgSettings,
} from "@/lib/onboarding";

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeSettings(row: any): OrgSettings {
  return {
    ...row,
    payment_methods: Array.isArray(row.payment_methods)
      ? row.payment_methods
      : DEFAULT_FINANCE.payment_methods,
    enabled_modules: Array.isArray(row.enabled_modules) ? row.enabled_modules : [],
    preferences:
      row.preferences && typeof row.preferences === "object" && !Array.isArray(row.preferences)
        ? row.preferences
        : {},
  } as OrgSettings;
}

/** Configuração da organização ativa (perfil, identidade, financeiro, módulos). */
export function useOrgSettings() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["org-settings", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgSettings | null> => {
      const { data, error } = await (supabase as any)
        .from("organization_settings")
        .select("*")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeSettings(data) : null;
    },
  });
}

export function useUpdateOrgSettings() {
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!organizationId) throw new Error("Nenhuma organização ativa.");
      const { data: existing } = await (supabase as any)
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from("organization_settings")
          .update({ ...patch, updated_by: user?.id ?? null })
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("organization_settings").insert({
          ...patch,
          organization_id: organizationId,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-settings", organizationId] }),
  });
}

/** Estado do onboarding da organização ativa. */
export function useOnboarding() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["org-onboarding", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgOnboarding | null> => {
      const { data, error } = await (supabase as any)
        .from("organization_onboarding")
        .select("*")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        completed_steps: Array.isArray(data.completed_steps) ? data.completed_steps : [],
      } as OrgOnboarding;
    },
  });
}

export function useCompleteStep() {
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      step,
      goTo,
      finish,
    }: {
      step?: OnboardingStepKey;
      goTo?: number;
      finish?: boolean;
    }) => {
      if (!organizationId) throw new Error("Nenhuma organização ativa.");
      const { data: current } = await (supabase as any)
        .from("organization_onboarding")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      const completed: string[] = Array.isArray(current?.completed_steps)
        ? current.completed_steps
        : [];
      const next = step && !completed.includes(step) ? [...completed, step] : completed;
      const progress = computeProgress(next);

      const payload: Record<string, unknown> = {
        completed_steps: next,
        progress_percent: progress,
        current_step: goTo ?? current?.current_step ?? 1,
        status: finish ? "completed" : progress > 0 ? "in_progress" : "pending",
        started_at: current?.started_at ?? new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      if (finish) {
        payload.completed_at = new Date().toISOString();
        payload.completed_by = user?.id ?? null;
      }

      if (current) {
        const { error } = await (supabase as any)
          .from("organization_onboarding")
          .update(payload)
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("organization_onboarding")
          .insert({ ...payload, organization_id: organizationId, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-onboarding", organizationId] }),
  });
}

export type OrgInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export function useOrgInvites() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["org-invites", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgInvite[]> => {
      const { data, error } = await (supabase as any)
        .from("organization_invites")
        .select("id, email, role, status, created_at")
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrgInvite[];
    },
  });
}

export function useInviteMember() {
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!organizationId) throw new Error("Nenhuma organização ativa.");
      const { error } = await (supabase as any).from("organization_invites").insert({
        organization_id: organizationId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user?.id ?? null,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", organizationId] }),
  });
}

export function useCancelInvite() {
  const { organizationId } = useCurrentOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("organization_invites")
        .update({ archived_at: new Date().toISOString(), status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invites", organizationId] }),
  });
}

/** Checklist derivado: usado no dashboard e na área de configuração. */
export function useSetupChecklist() {
  const onboarding = useOnboarding();
  const completed = onboarding.data?.completed_steps ?? [];
  return {
    loading: onboarding.isLoading,
    onboarding: onboarding.data ?? null,
    progress: onboarding.data?.progress_percent ?? 0,
    isComplete: onboarding.data?.status === "completed",
    items: ONBOARDING_STEPS.map((s) => ({ ...s, done: completed.includes(s.key) })),
  };
}
