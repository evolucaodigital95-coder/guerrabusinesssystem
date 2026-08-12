import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  resolveSubscriptionState,
  type Plan,
  type Subscription,
  type SubscriptionState,
  type SubscriptionStatus,
} from "@/lib/platform";

/* eslint-disable @typescript-eslint/no-explicit-any */

const asPlan = (row: any): Plan => ({
  ...row,
  features: (row?.features ?? {}) as Plan["features"],
  limits: (row?.limits ?? {}) as Plan["limits"],
});

/** É administrador GLOBAL da plataforma (diferente de admin da organização). */
export function usePlatformAdmin() {
  const { user, loading } = useSession();
  const query = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isPlatformAdmin: query.data === true, loading: loading || query.isLoading };
}

export function usePlans(includeArchived = false) {
  return useQuery({
    queryKey: ["plans", includeArchived],
    queryFn: async (): Promise<Plan[]> => {
      let q = supabase.from("plans").select("*").order("display_order", { ascending: true });
      if (!includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(asPlan);
    },
  });
}

/** Assinatura da organização ATIVA + estado de acesso. */
export function useSubscriptionAccess(): SubscriptionState & { loading: boolean } {
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const query = useQuery({
    queryKey: ["subscription", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plans:plan_id (*)")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { subscription: null, plan: null };
      const { plans, ...sub } = data as any;
      return {
        subscription: sub as Subscription,
        plan: plans ? asPlan(plans) : null,
      };
    },
  });

  const state = useMemo(
    () => resolveSubscriptionState(query.data?.subscription ?? null, query.data?.plan ?? null),
    [query.data],
  );

  return { ...state, loading: orgLoading || query.isLoading };
}

export type AdminOrganization = {
  id: string;
  name: string;
  created_at: string;
  ownerName: string | null;
  ownerEmail: string | null;
  usersCount: number;
  companiesCount: number;
  lecturesCount: number;
  subscription: Subscription | null;
  plan: Plan | null;
  status: SubscriptionStatus;
};

/** Visão administrativa de todas as organizações (somente admin global — RLS garante). */
export function useAdminOrganizations() {
  return useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async (): Promise<AdminOrganization[]> => {
      const [orgs, subs, plans, members, companies, lectures, profiles] = await Promise.all([
        supabase.from("organizations").select("id, name, created_at, created_by").is("archived_at", null),
        supabase.from("subscriptions").select("*"),
        supabase.from("plans").select("*"),
        supabase.from("organization_members").select("organization_id, user_id, role").is("archived_at", null),
        supabase.from("companies").select("organization_id").is("archived_at", null),
        supabase.from("lectures").select("organization_id").is("archived_at", null),
        supabase.from("profiles").select("id, full_name, email"),
      ]);

      const err = [orgs, subs, plans, members, companies, lectures, profiles].find((r) => r.error);
      if (err?.error) throw err.error;

      const planById = new Map((plans.data ?? []).map((p: any) => [p.id, asPlan(p)]));
      const subByOrg = new Map((subs.data ?? []).map((s: any) => [s.organization_id, s as Subscription]));
      const profileById = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
      const count = (rows: any[] | null, org: string) =>
        (rows ?? []).filter((r) => r.organization_id === org).length;

      return (orgs.data ?? []).map((o: any) => {
        const sub = subByOrg.get(o.id) ?? null;
        const owner =
          (members.data ?? []).find((m: any) => m.organization_id === o.id && m.role === "owner") ??
          null;
        const profile = profileById.get(owner?.user_id ?? o.created_by);
        const plan = sub?.plan_id ? (planById.get(sub.plan_id) ?? null) : null;
        return {
          id: o.id,
          name: o.name,
          created_at: o.created_at,
          ownerName: profile?.full_name ?? null,
          ownerEmail: profile?.email ?? null,
          usersCount: count(members.data, o.id),
          companiesCount: count(companies.data, o.id),
          lecturesCount: count(lectures.data, o.id),
          subscription: sub,
          plan,
          status: resolveSubscriptionState(sub, plan).status,
        };
      });
    },
  });
}

export function useAdminOrganization(organizationId: string) {
  const list = useAdminOrganizations();
  const org = (list.data ?? []).find((o) => o.id === organizationId) ?? null;

  const detail = useQuery({
    queryKey: ["admin", "organization", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const [settings, events, members, onboarding] = await Promise.all([
        supabase.from("organization_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
        supabase
          .from("subscription_events")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("organization_members")
          .select("user_id, role, created_at, profiles:user_id (full_name, email)")
          .eq("organization_id", organizationId)
          .is("archived_at", null),
        supabase.from("organization_onboarding").select("*").eq("organization_id", organizationId).maybeSingle(),
      ]);
      const err = [settings, events, members, onboarding].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        settings: settings.data as any,
        events: (events.data ?? []) as any[],
        members: (members.data ?? []) as any[],
        onboarding: onboarding.data as any,
      };
    },
  });

  return { org, loading: list.isLoading || detail.isLoading, ...(detail.data ?? { settings: null, events: [], members: [], onboarding: null }) };
}

/** Indicadores executivos da plataforma. Nada é estimado sem dado real. */
export function usePlatformOverview() {
  const orgs = useAdminOrganizations();

  return useMemo(() => {
    const rows = orgs.data ?? [];
    const by = (s: SubscriptionStatus) => rows.filter((o) => o.status === s).length;
    const monthAgo = Date.now() - 30 * 86_400_000;

    const activeRows = rows.filter((o) => o.status === "active");
    const mrr = activeRows.reduce((sum, o) => {
      const price = o.subscription?.contracted_price ?? null;
      if (price === null) return sum;
      return sum + (o.subscription?.period === "yearly" ? price / 12 : price);
    }, 0);

    const converted = rows.filter(
      (o) => o.status === "active" && (o.subscription?.trial_ends_at ?? null) !== null,
    ).length;
    const everTrialed = rows.filter((o) => (o.subscription?.trial_ends_at ?? null) !== null).length;

    return {
      loading: orgs.isLoading,
      total: rows.length,
      active: by("active"),
      trial: by("trial"),
      pastDue: by("past_due"),
      suspended: by("suspended"),
      canceled: by("canceled"),
      expired: by("expired"),
      newOrgs: rows.filter((o) => new Date(o.created_at).getTime() >= monthAgo).length,
      users: new Set(rows.flatMap((o) => Array(o.usersCount).fill(o.id)).map((_, i) => i)).size,
      totalUsers: rows.reduce((s, o) => s + o.usersCount, 0),
      activeSubscriptions: activeRows.length,
      mrr,
      arr: mrr * 12,
      churn: rows.length ? (by("canceled") / rows.length) * 100 : 0,
      conversion: everTrialed ? (converted / everTrialed) * 100 : null,
    };
  }, [orgs.data, orgs.isLoading]);
}

async function logPlatformAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  organizationId: string | null,
  diff: Record<string, unknown>,
) {
  await supabase.from("platform_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    organization_id: organizationId,
    diff: diff as any,
  });
}

export function usePlatformMutations() {
  const { user } = useSession();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["plans"] });
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["subscription"] });
    qc.invalidateQueries({ queryKey: ["platform-audit"] });
  };

  const savePlan = useMutation({
    mutationFn: async (plan: Partial<Plan> & { id?: string }) => {
      const payload: any = { ...plan, updated_by: user?.id ?? null };
      if (plan.id) {
        const { error } = await supabase.from("plans").update(payload).eq("id", plan.id);
        if (error) throw error;
        await logPlatformAction(user!.id, "plan.updated", "plan", plan.id, null, payload);
        return plan.id;
      }
      payload.created_by = user?.id ?? null;
      const { data, error } = await supabase.from("plans").insert(payload).select("id").single();
      if (error) throw error;
      await logPlatformAction(user!.id, "plan.created", "plan", data.id, null, payload);
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const archivePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plans")
        .update({ archived_at: new Date().toISOString(), status: "inactive", updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
      await logPlatformAction(user!.id, "plan.archived", "plan", id, null, {});
    },
    onSuccess: invalidate,
  });

  const updateSubscription = useMutation({
    mutationFn: async (input: {
      subscription: Subscription;
      changes: Partial<Subscription>;
      event: string;
    }) => {
      const { subscription, changes, event } = input;
      const { error } = await supabase
        .from("subscriptions")
        .update({ ...(changes as any), updated_by: user?.id ?? null })
        .eq("id", subscription.id);
      if (error) throw error;

      await supabase.from("subscription_events").insert({
        organization_id: subscription.organization_id,
        subscription_id: subscription.id,
        event,
        from_status: subscription.status,
        to_status: (changes.status as string) ?? subscription.status,
        from_plan_id: subscription.plan_id,
        to_plan_id: (changes.plan_id as string) ?? subscription.plan_id,
        source: "admin",
        actor_id: user?.id ?? null,
        payload: changes as any,
      });

      await logPlatformAction(
        user!.id,
        `subscription.${event}`,
        "subscription",
        subscription.id,
        subscription.organization_id,
        changes as Record<string, unknown>,
      );
    },
    onSuccess: invalidate,
  });

  return { savePlan, archivePlan, updateSubscription };
}

export function usePlatformAudit(limit = 100) {
  return useQuery({
    queryKey: ["platform-audit", limit],
    queryFn: async () => {
      const [log, profiles] = await Promise.all([
        supabase
          .from("platform_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      if (log.error) throw log.error;
      const byId = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
      return (log.data ?? []).map((row: any) => ({
        ...row,
        actorName: byId.get(row.actor_id)?.full_name ?? byId.get(row.actor_id)?.email ?? "—",
      }));
    },
  });
}
