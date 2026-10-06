
ALTER FUNCTION public.get_org_commercial_state(uuid) SET SCHEMA private;
ALTER FUNCTION public.admin_change_plan(uuid, uuid, text, text) SET SCHEMA private;
ALTER FUNCTION public.admin_set_trial(uuid, integer, boolean) SET SCHEMA private;
ALTER FUNCTION public.admin_set_subscription_status(uuid, text, text, timestamptz) SET SCHEMA private;
ALTER FUNCTION public.admin_set_limits(uuid, jsonb) SET SCHEMA private;

CREATE FUNCTION public.get_org_commercial_state(_org uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_org_commercial_state(_org) $$;
CREATE FUNCTION public.admin_change_plan(_org uuid, _plan uuid, _apply text DEFAULT 'now', _period text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.admin_change_plan(_org, _plan, _apply, _period) $$;
CREATE FUNCTION public.admin_set_trial(_org uuid, _days integer, _restart boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.admin_set_trial(_org, _days, _restart) $$;
CREATE FUNCTION public.admin_set_subscription_status(_org uuid, _status text, _reason text DEFAULT NULL, _effective_at timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.admin_set_subscription_status(_org, _status, _reason, _effective_at) $$;
CREATE FUNCTION public.admin_set_limits(_org uuid, _overrides jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.admin_set_limits(_org, _overrides) $$;

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.get_org_commercial_state(uuid), public.admin_change_plan(uuid, uuid, text, text), public.admin_set_trial(uuid, integer, boolean), public.admin_set_subscription_status(uuid, text, text, timestamptz), public.admin_set_limits(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_commercial_state(uuid), public.admin_change_plan(uuid, uuid, text, text), public.admin_set_trial(uuid, integer, boolean), public.admin_set_subscription_status(uuid, text, text, timestamptz), public.admin_set_limits(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_org_commercial_state(uuid), private.admin_change_plan(uuid, uuid, text, text), private.admin_set_trial(uuid, integer, boolean), private.admin_set_subscription_status(uuid, text, text, timestamptz), private.admin_set_limits(uuid, jsonb) TO authenticated;
