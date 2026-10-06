
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS pending_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS limit_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS external_customer_id text,
  ADD COLUMN IF NOT EXISTS external_subscription_id text,
  ADD COLUMN IF NOT EXISTS external_price_id text,
  ADD COLUMN IF NOT EXISTS external_payment_id text;

UPDATE public.subscriptions SET
  provider = COALESCE(provider, gateway),
  external_customer_id = COALESCE(external_customer_id, gateway_customer_id),
  external_subscription_id = COALESCE(external_subscription_id, gateway_subscription_id),
  external_price_id = COALESCE(external_price_id, gateway_price_id),
  external_payment_id = COALESCE(external_payment_id, gateway_payment_id),
  trial_started_at = COALESCE(trial_started_at, CASE WHEN trial_ends_at IS NOT NULL THEN started_at END);

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE public.plans SET slug = code WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_unique ON public.plans(slug);
ALTER TABLE public.plans ALTER COLUMN price_monthly DROP NOT NULL;
ALTER TABLE public.plans ALTER COLUMN price_yearly DROP NOT NULL;

-- ===== Estado efetivo =====
CREATE OR REPLACE FUNCTION private.effective_subscription_status(_org uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN o.billing_exempt THEN 'active'
    WHEN s.id IS NULL THEN 'active'
    WHEN s.status = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at < now() THEN 'expired'
    WHEN s.status IN ('active','past_due') AND COALESCE(s.next_renewal_at, s.ends_at) IS NOT NULL
         AND COALESCE(s.next_renewal_at, s.ends_at) < now() - make_interval(days => COALESCE(s.grace_period_days, 7)) THEN 'expired'
    WHEN s.cancel_effective_at IS NOT NULL AND s.cancel_effective_at <= now() THEN 'canceled'
    ELSE s.status
  END
  FROM public.organizations o
  LEFT JOIN public.subscriptions s ON s.organization_id = o.id
  WHERE o.id = _org;
$$;

CREATE OR REPLACE FUNCTION private.subscription_allows_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(private.effective_subscription_status(_org), 'active') NOT IN ('expired','canceled','suspended','incomplete');
$$;

CREATE OR REPLACE FUNCTION private.can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org
      AND m.user_id = auth.uid()
      AND m.archived_at IS NULL
      AND m.status = 'active'::public.member_status
      AND o.status = 'active'::public.org_status
      AND o.archived_at IS NULL
      AND m.role IN ('owner'::org_role, 'admin'::org_role, 'member'::org_role)
  ) AND private.subscription_allows_write(_org);
$$;

CREATE OR REPLACE FUNCTION private.has_feature(_org uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN o.billing_exempt THEN true
    WHEN p.id IS NULL THEN true
    WHEN NOT (p.features ? _feature) THEN true
    ELSE COALESCE((p.features ->> _feature)::boolean, true)
  END
  FROM public.organizations o
  LEFT JOIN public.subscriptions s ON s.organization_id = o.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE o.id = _org;
$$;

-- NULL = ilimitado
CREATE OR REPLACE FUNCTION private.org_limit(_org uuid, _key text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN o.billing_exempt THEN NULL
    WHEN s.limit_overrides ? _key THEN NULLIF(s.limit_overrides ->> _key, '')::numeric
    WHEN p.id IS NULL OR NOT (p.limits ? _key) THEN NULL
    ELSE NULLIF(p.limits ->> _key, '')::numeric
  END
  FROM public.organizations o
  LEFT JOIN public.subscriptions s ON s.organization_id = o.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE o.id = _org;
$$;

CREATE OR REPLACE FUNCTION private.org_usage(_org uuid, _key text)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN CASE _key
    WHEN 'users' THEN (SELECT count(*) FROM organization_members WHERE organization_id=_org AND archived_at IS NULL AND status='active')
    WHEN 'companies' THEN (SELECT count(*) FROM companies WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'contacts' THEN (SELECT count(*) FROM contacts WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'lectures_per_month' THEN (SELECT count(*) FROM lectures WHERE organization_id=_org AND created_at >= date_trunc('month', now()))
    WHEN 'agents' THEN (SELECT count(*) FROM agents WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'campaigns' THEN (SELECT count(*) FROM campaigns WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'projects' THEN (SELECT count(*) FROM projects WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'seasons' THEN (SELECT count(*) FROM seasons WHERE organization_id=_org AND archived_at IS NULL)
    WHEN 'storage_mb' THEN (SELECT round(COALESCE(sum((metadata->>'size')::numeric),0)/1048576.0, 2)
                            FROM storage.objects WHERE (storage.foldername(name))[1] = _org::text)
    ELSE 0
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_can_create(_org uuid, _feature text, _limit text, _label text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit numeric; v_used numeric;
BEGIN
  IF _org IS NULL THEN RETURN; END IF;
  IF NOT private.subscription_allows_write(_org) THEN
    RAISE EXCEPTION 'GBS_SUBSCRIPTION_BLOCKED' USING ERRCODE = 'P0001', HINT = private.effective_subscription_status(_org);
  END IF;
  IF _feature IS NOT NULL AND NOT private.has_feature(_org, _feature) THEN
    RAISE EXCEPTION 'GBS_FEATURE_UNAVAILABLE:%', _feature USING ERRCODE = 'P0001';
  END IF;
  IF _limit IS NOT NULL THEN
    v_limit := private.org_limit(_org, _limit);
    IF v_limit IS NOT NULL THEN
      v_used := private.org_usage(_org, _limit);
      IF v_used >= v_limit THEN
        RAISE EXCEPTION 'GBS_LIMIT_REACHED:%', _limit USING ERRCODE = 'P0001', DETAIL = _label || '|' || v_limit || '|' || v_used;
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_commercial_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Bootstrap de organização (criador entrando como owner) não é limitado.
  IF TG_TABLE_NAME = 'organization_members' AND NOT EXISTS
     (SELECT 1 FROM organization_members WHERE organization_id = NEW.organization_id AND archived_at IS NULL) THEN
    RETURN NEW;
  END IF;
  PERFORM private.assert_can_create(NEW.organization_id, NULLIF(TG_ARGV[0],''), NULLIF(TG_ARGV[1],''), TG_ARGV[2]);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_companies ON public.companies;
CREATE TRIGGER trg_commercial_companies BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('crm','companies','empresas');
DROP TRIGGER IF EXISTS trg_commercial_contacts ON public.contacts;
CREATE TRIGGER trg_commercial_contacts BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('contatos','contacts','contatos');
DROP TRIGGER IF EXISTS trg_commercial_lectures ON public.lectures;
CREATE TRIGGER trg_commercial_lectures BEFORE INSERT ON public.lectures FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('palestras','lectures_per_month','palestras no mês');
DROP TRIGGER IF EXISTS trg_commercial_agents ON public.agents;
CREATE TRIGGER trg_commercial_agents BEFORE INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('agendistas','agents','agendistas');
DROP TRIGGER IF EXISTS trg_commercial_campaigns ON public.campaigns;
CREATE TRIGGER trg_commercial_campaigns BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('campanhas','campaigns','campanhas');
DROP TRIGGER IF EXISTS trg_commercial_projects ON public.projects;
CREATE TRIGGER trg_commercial_projects BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('projetos','projects','projetos');
DROP TRIGGER IF EXISTS trg_commercial_seasons ON public.seasons;
CREATE TRIGGER trg_commercial_seasons BEFORE INSERT ON public.seasons FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('temporadas','seasons','temporadas');
DROP TRIGGER IF EXISTS trg_commercial_members ON public.organization_members;
CREATE TRIGGER trg_commercial_members BEFORE INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION private.enforce_commercial_insert('multi_usuarios','users','usuários');

-- ===== Histórico automático =====
CREATE OR REPLACE FUNCTION private.log_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_old numeric; v_new numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO subscription_events (organization_id, subscription_id, event, to_status, to_plan_id, source, actor_id)
    VALUES (NEW.organization_id, NEW.id, 'subscription_created', NEW.status, NEW.plan_id, COALESCE(current_setting('gbs.source', true),'system'), auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    SELECT price_monthly INTO v_old FROM plans WHERE id = OLD.plan_id;
    SELECT price_monthly INTO v_new FROM plans WHERE id = NEW.plan_id;
    v_event := CASE WHEN COALESCE(v_new,0) > COALESCE(v_old,0) THEN 'plan_upgraded'
                    WHEN COALESCE(v_new,0) < COALESCE(v_old,0) THEN 'plan_downgraded' ELSE 'plan_changed' END;
    INSERT INTO subscription_events (organization_id, subscription_id, event, from_status, to_status, from_plan_id, to_plan_id, source, actor_id)
    VALUES (NEW.organization_id, NEW.id, v_event, OLD.status, NEW.status, OLD.plan_id, NEW.plan_id, COALESCE(current_setting('gbs.source', true),'system'), auth.uid());
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := CASE NEW.status WHEN 'suspended' THEN 'subscription_suspended' WHEN 'canceled' THEN 'subscription_canceled'
      WHEN 'expired' THEN 'subscription_expired' WHEN 'trial' THEN 'trial_started'
      WHEN 'active' THEN CASE WHEN OLD.status = 'trial' THEN 'trial_ended' ELSE 'subscription_reactivated' END
      ELSE 'status_changed' END;
    INSERT INTO subscription_events (organization_id, subscription_id, event, from_status, to_status, from_plan_id, to_plan_id, source, actor_id, payload)
    VALUES (NEW.organization_id, NEW.id, v_event, OLD.status, NEW.status, OLD.plan_id, NEW.plan_id, COALESCE(current_setting('gbs.source', true),'system'), auth.uid(),
            jsonb_build_object('reason', NEW.cancel_reason));
  ELSIF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    INSERT INTO subscription_events (organization_id, subscription_id, event, from_status, to_status, source, actor_id, payload)
    VALUES (NEW.organization_id, NEW.id, 'trial_extended', OLD.status, NEW.status, COALESCE(current_setting('gbs.source', true),'system'), auth.uid(),
            jsonb_build_object('from', OLD.trial_ends_at, 'to', NEW.trial_ends_at));
  END IF;
  IF NEW.limit_overrides IS DISTINCT FROM OLD.limit_overrides THEN
    INSERT INTO subscription_events (organization_id, subscription_id, event, from_status, to_status, source, actor_id, payload)
    VALUES (NEW.organization_id, NEW.id, 'limits_changed', OLD.status, NEW.status, COALESCE(current_setting('gbs.source', true),'system'), auth.uid(),
            jsonb_build_object('from', OLD.limit_overrides, 'to', NEW.limit_overrides));
  END IF;
  IF NEW.pending_plan_id IS DISTINCT FROM OLD.pending_plan_id AND NEW.pending_plan_id IS NOT NULL THEN
    INSERT INTO subscription_events (organization_id, subscription_id, event, from_status, to_status, from_plan_id, to_plan_id, source, actor_id, payload)
    VALUES (NEW.organization_id, NEW.id, 'downgrade_scheduled', OLD.status, NEW.status, NEW.plan_id, NEW.pending_plan_id, COALESCE(current_setting('gbs.source', true),'system'), auth.uid(),
            jsonb_build_object('effective_at', NEW.pending_change_at));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_subscription_history ON public.subscriptions;
CREATE TRIGGER trg_subscription_history AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION private.log_subscription_change();

-- O bootstrap já grava o evento de trial; preenche o início do trial.
CREATE OR REPLACE FUNCTION public.bootstrap_organization_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_plan public.plans%ROWTYPE; v_days integer; v_sub uuid;
BEGIN
  SELECT * INTO v_plan FROM public.plans
  WHERE archived_at IS NULL AND status = 'active' AND is_active
  ORDER BY is_trial_default DESC, display_order ASC LIMIT 1;
  SELECT default_trial_days INTO v_days FROM public.platform_settings LIMIT 1;
  v_days := COALESCE(v_plan.trial_days, v_days, 14);
  INSERT INTO public.subscriptions (organization_id, plan_id, status, period, contracted_price, started_at, trial_started_at, trial_ends_at, created_by, updated_by)
  VALUES (NEW.id, v_plan.id, 'trial', 'monthly', v_plan.price_monthly, now(), now(), now() + (v_days || ' days')::interval, NEW.created_by, NEW.created_by)
  ON CONFLICT (organization_id) DO NOTHING
  RETURNING id INTO v_sub;
  IF v_sub IS NOT NULL THEN
    INSERT INTO public.subscription_events (organization_id, subscription_id, event, to_status, to_plan_id, source, actor_id)
    VALUES (NEW.id, v_sub, 'trial_started', 'trial', v_plan.id, 'system', NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== Proteção contra manipulação =====
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_events FROM authenticated, anon;
GRANT SELECT ON public.subscriptions, public.subscription_events TO authenticated;
GRANT ALL ON public.subscriptions, public.subscription_events TO service_role;

-- ===== Leitura do estado comercial (somente membros da org ou GBS Admin) =====
CREATE OR REPLACE FUNCTION public.get_org_commercial_state(_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; k text; v_usage jsonb := '{}'::jsonb; v_limits jsonb := '{}'::jsonb;
  keys text[] := ARRAY['users','companies','contacts','lectures_per_month','agents','campaigns','projects','seasons','storage_mb'];
BEGIN
  IF auth.uid() IS NULL OR NOT (private.is_org_member(_org) OR private.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'GBS_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  FOREACH k IN ARRAY keys LOOP
    v_usage := v_usage || jsonb_build_object(k, private.org_usage(_org, k));
    v_limits := v_limits || jsonb_build_object(k, private.org_limit(_org, k));
  END LOOP;
  SELECT jsonb_build_object(
    'organization_id', o.id, 'billing_exempt', o.billing_exempt,
    'status', private.effective_subscription_status(_org),
    'stored_status', s.status,
    'subscription', to_jsonb(s) - 'gateway_metadata' - 'gateway_checkout_url',
    'plan', to_jsonb(p),
    'pending_plan', to_jsonb(pp),
    'limits', v_limits, 'usage', v_usage)
  INTO v
  FROM organizations o
  LEFT JOIN subscriptions s ON s.organization_id = o.id
  LEFT JOIN plans p ON p.id = s.plan_id
  LEFT JOIN plans pp ON pp.id = s.pending_plan_id
  WHERE o.id = _org;
  RETURN v;
END;
$$;

-- ===== Ações do GBS Admin =====
CREATE OR REPLACE FUNCTION private.require_platform_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'GBS_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION private.audit_subscription(_org uuid, _action text, _before jsonb, _after jsonb, _ctx jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO platform_audit_log (actor_id, action, entity_type, entity_id, organization_id, diff)
  SELECT auth.uid(), _action, 'subscription', (SELECT id FROM subscriptions WHERE organization_id=_org), _org,
         jsonb_build_object('before', _before, 'after', _after, 'context', COALESCE(_ctx,'{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.admin_change_plan(_org uuid, _plan uuid, _apply text DEFAULT 'now', _period text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_after jsonb; v_plan plans%ROWTYPE; v_period text;
BEGIN
  PERFORM private.require_platform_admin();
  SELECT * INTO v_plan FROM plans WHERE id = _plan AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GBS_PLAN_NOT_FOUND'; END IF;
  SELECT to_jsonb(s) INTO v_before FROM subscriptions s WHERE organization_id = _org;
  IF v_before IS NULL THEN RAISE EXCEPTION 'GBS_SUBSCRIPTION_NOT_FOUND'; END IF;
  PERFORM set_config('gbs.source', 'admin', true);
  v_period := COALESCE(_period, v_before->>'period', 'monthly');
  IF _apply = 'scheduled' THEN
    UPDATE subscriptions SET pending_plan_id = _plan,
      pending_change_at = COALESCE(next_renewal_at, current_period_end, now()), updated_by = auth.uid()
    WHERE organization_id = _org;
  ELSE
    UPDATE subscriptions SET plan_id = _plan, period = v_period,
      contracted_price = CASE WHEN v_period = 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END,
      pending_plan_id = NULL, pending_change_at = NULL, updated_by = auth.uid()
    WHERE organization_id = _org;
  END IF;
  SELECT to_jsonb(s) INTO v_after FROM subscriptions s WHERE organization_id = _org;
  PERFORM private.audit_subscription(_org, CASE WHEN _apply='scheduled' THEN 'subscription.downgrade_scheduled' ELSE 'subscription.plan_changed' END,
    v_before, v_after, jsonb_build_object('plan', v_plan.code, 'apply', _apply));
  RETURN v_after;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_trial(_org uuid, _days integer, _restart boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_after jsonb;
BEGIN
  PERFORM private.require_platform_admin();
  IF _days IS NULL OR _days < 1 OR _days > 365 THEN RAISE EXCEPTION 'GBS_INVALID_DAYS'; END IF;
  SELECT to_jsonb(s) INTO v_before FROM subscriptions s WHERE organization_id = _org;
  IF v_before IS NULL THEN RAISE EXCEPTION 'GBS_SUBSCRIPTION_NOT_FOUND'; END IF;
  PERFORM set_config('gbs.source', 'admin', true);
  UPDATE subscriptions SET status = 'trial',
    trial_started_at = CASE WHEN _restart OR trial_started_at IS NULL THEN now() ELSE trial_started_at END,
    trial_ends_at = CASE WHEN _restart OR trial_ends_at IS NULL OR trial_ends_at < now() THEN now() ELSE trial_ends_at END + make_interval(days => _days),
    canceled_at = NULL, cancel_effective_at = NULL, updated_by = auth.uid()
  WHERE organization_id = _org;
  SELECT to_jsonb(s) INTO v_after FROM subscriptions s WHERE organization_id = _org;
  PERFORM private.audit_subscription(_org, CASE WHEN _restart THEN 'subscription.trial_started' ELSE 'subscription.trial_extended' END,
    v_before, v_after, jsonb_build_object('days', _days));
  RETURN v_after;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_status(_org uuid, _status text, _reason text DEFAULT NULL, _effective_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_after jsonb;
BEGIN
  PERFORM private.require_platform_admin();
  IF _status NOT IN ('trial','active','past_due','suspended','canceled','expired','incomplete') THEN RAISE EXCEPTION 'GBS_INVALID_STATUS'; END IF;
  SELECT to_jsonb(s) INTO v_before FROM subscriptions s WHERE organization_id = _org;
  IF v_before IS NULL THEN RAISE EXCEPTION 'GBS_SUBSCRIPTION_NOT_FOUND'; END IF;
  PERFORM set_config('gbs.source', 'admin', true);
  IF _status = 'canceled' AND _effective_at IS NOT NULL AND _effective_at > now() THEN
    -- Cancelamento agendado: continua no status atual até a data efetiva.
    UPDATE subscriptions SET cancel_requested_at = now(), cancel_requested_by = auth.uid(),
      cancel_effective_at = _effective_at, cancel_reason = _reason, cancel_at_period_end = true, updated_by = auth.uid()
    WHERE organization_id = _org;
  ELSE
    UPDATE subscriptions SET status = _status,
      cancel_reason = CASE WHEN _status = 'canceled' THEN _reason ELSE cancel_reason END,
      canceled_at = CASE WHEN _status = 'canceled' THEN now() WHEN _status IN ('active','trial') THEN NULL ELSE canceled_at END,
      cancel_requested_at = CASE WHEN _status = 'canceled' THEN COALESCE(cancel_requested_at, now()) WHEN _status IN ('active','trial') THEN NULL ELSE cancel_requested_at END,
      cancel_requested_by = CASE WHEN _status = 'canceled' THEN COALESCE(cancel_requested_by, auth.uid()) WHEN _status IN ('active','trial') THEN NULL ELSE cancel_requested_by END,
      cancel_effective_at = CASE WHEN _status = 'canceled' THEN now() WHEN _status IN ('active','trial') THEN NULL ELSE cancel_effective_at END,
      cancel_at_period_end = CASE WHEN _status IN ('active','trial') THEN false ELSE cancel_at_period_end END,
      next_renewal_at = CASE WHEN _status = 'active' AND (next_renewal_at IS NULL OR next_renewal_at < now())
        THEN now() + CASE WHEN period = 'yearly' THEN interval '1 year' ELSE interval '1 month' END ELSE next_renewal_at END,
      notes = CASE WHEN _reason IS NOT NULL AND _status <> 'canceled' THEN _reason ELSE notes END,
      updated_by = auth.uid()
    WHERE organization_id = _org;
  END IF;
  SELECT to_jsonb(s) INTO v_after FROM subscriptions s WHERE organization_id = _org;
  PERFORM private.audit_subscription(_org, 'subscription.status_' || _status, v_before, v_after,
    jsonb_build_object('reason', _reason, 'effective_at', _effective_at));
  RETURN v_after;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_limits(_org uuid, _overrides jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_after jsonb; k text;
BEGIN
  PERFORM private.require_platform_admin();
  IF jsonb_typeof(COALESCE(_overrides,'{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'GBS_INVALID_LIMITS'; END IF;
  FOR k IN SELECT jsonb_object_keys(COALESCE(_overrides,'{}'::jsonb)) LOOP
    IF k NOT IN ('users','companies','contacts','lectures_per_month','agents','campaigns','projects','seasons','storage_mb') THEN
      RAISE EXCEPTION 'GBS_INVALID_LIMITS';
    END IF;
    IF jsonb_typeof(_overrides->k) NOT IN ('number','null') THEN RAISE EXCEPTION 'GBS_INVALID_LIMITS'; END IF;
  END LOOP;
  SELECT to_jsonb(s) INTO v_before FROM subscriptions s WHERE organization_id = _org;
  IF v_before IS NULL THEN RAISE EXCEPTION 'GBS_SUBSCRIPTION_NOT_FOUND'; END IF;
  PERFORM set_config('gbs.source', 'admin', true);
  UPDATE subscriptions SET limit_overrides = COALESCE(_overrides,'{}'::jsonb), updated_by = auth.uid() WHERE organization_id = _org;
  SELECT to_jsonb(s) INTO v_after FROM subscriptions s WHERE organization_id = _org;
  PERFORM private.audit_subscription(_org, 'subscription.limits_changed', v_before->'limit_overrides', v_after->'limit_overrides', NULL);
  RETURN v_after;
END; $$;

REVOKE ALL ON FUNCTION public.get_org_commercial_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_change_plan(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_trial(uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_limits(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_commercial_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_plan(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_trial(uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_limits(uuid, jsonb) TO authenticated;
