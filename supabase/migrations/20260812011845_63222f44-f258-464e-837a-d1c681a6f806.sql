-- Move platform admin check into the private (non-exposed) schema
CREATE OR REPLACE FUNCTION private.is_platform_admin(_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = _user);
$$;

REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;

-- Rewire policies
DROP POLICY "platform_admins_select" ON public.platform_admins;
CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin(auth.uid()));

DROP POLICY "plans_insert" ON public.plans;
DROP POLICY "plans_update" ON public.plans;
DROP POLICY "plans_delete" ON public.plans;
CREATE POLICY "plans_insert" ON public.plans
  FOR INSERT TO authenticated WITH CHECK (private.is_platform_admin(auth.uid()));
CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE TO authenticated USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE TO authenticated USING (private.is_platform_admin(auth.uid()));

DROP POLICY "subscriptions_select" ON public.subscriptions;
DROP POLICY "subscriptions_insert" ON public.subscriptions;
DROP POLICY "subscriptions_update" ON public.subscriptions;
DROP POLICY "subscriptions_delete" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()) OR private.is_org_member(organization_id));
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (private.is_platform_admin(auth.uid()));
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated USING (private.is_platform_admin(auth.uid()));

DROP POLICY "subscription_events_select" ON public.subscription_events;
DROP POLICY "subscription_events_insert" ON public.subscription_events;
CREATE POLICY "subscription_events_select" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()) OR private.is_org_member(organization_id));
CREATE POLICY "subscription_events_insert" ON public.subscription_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

DROP POLICY "platform_audit_select" ON public.platform_audit_log;
DROP POLICY "platform_audit_insert" ON public.platform_audit_log;
CREATE POLICY "platform_audit_select" ON public.platform_audit_log
  FOR SELECT TO authenticated USING (private.is_platform_admin(auth.uid()));
CREATE POLICY "platform_audit_insert" ON public.platform_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

DROP POLICY "platform_settings_insert" ON public.platform_settings;
DROP POLICY "platform_settings_update" ON public.platform_settings;
CREATE POLICY "platform_settings_insert" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (private.is_platform_admin(auth.uid()));
CREATE POLICY "platform_settings_update" ON public.platform_settings
  FOR UPDATE TO authenticated USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);

-- Trigger function must not be callable through the API
REVOKE ALL ON FUNCTION public.bootstrap_organization_subscription() FROM PUBLIC, anon, authenticated;