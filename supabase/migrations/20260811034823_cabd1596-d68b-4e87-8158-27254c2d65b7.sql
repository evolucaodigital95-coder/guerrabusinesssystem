-- 1) ORGANIZATION SETTINGS
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- perfil
  legal_name text,
  trade_name text,
  owner_name text,
  phone text,
  email text,
  city text,
  state text,
  website text,
  description text,
  operation_type text,
  -- identidade
  logo_url text,
  display_name text,
  primary_color text,
  secondary_color text,
  brand_image_url text,
  -- financeiro
  payment_methods jsonb NOT NULL DEFAULT '["pix","dinheiro","credito","debito","transferencia"]'::jsonb,
  default_card_fee_percent numeric NOT NULL DEFAULT 0,
  max_installments integer NOT NULL DEFAULT 12,
  speaker_share numeric NOT NULL DEFAULT 50,
  agent_share numeric NOT NULL DEFAULT 50,
  tithe_percent numeric NOT NULL DEFAULT 10,
  finance_notes text,
  -- operacional
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_settings_member_read ON public.organization_settings
  FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY org_settings_write_insert ON public.organization_settings
  FOR INSERT TO authenticated WITH CHECK (private.can_write(organization_id));
CREATE POLICY org_settings_write_update ON public.organization_settings
  FOR UPDATE TO authenticated USING (private.can_write(organization_id)) WITH CHECK (private.can_write(organization_id));
CREATE POLICY org_settings_admin_delete ON public.organization_settings
  FOR DELETE TO authenticated USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));

CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) ORGANIZATION ONBOARDING
CREATE TABLE public.organization_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  current_step integer NOT NULL DEFAULT 1,
  total_steps integer NOT NULL DEFAULT 6,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress_percent integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_onboarding TO authenticated;
GRANT ALL ON public.organization_onboarding TO service_role;
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_onboarding_member_read ON public.organization_onboarding
  FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY org_onboarding_write_insert ON public.organization_onboarding
  FOR INSERT TO authenticated WITH CHECK (private.can_write(organization_id));
CREATE POLICY org_onboarding_write_update ON public.organization_onboarding
  FOR UPDATE TO authenticated USING (private.can_write(organization_id)) WITH CHECK (private.can_write(organization_id));
CREATE POLICY org_onboarding_admin_delete ON public.organization_onboarding
  FOR DELETE TO authenticated USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));

CREATE TRIGGER trg_org_onboarding_updated BEFORE UPDATE ON public.organization_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) ORGANIZATION INVITES
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz,
  UNIQUE (organization_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_member_read ON public.organization_invites
  FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY org_invites_admin_insert ON public.organization_invites
  FOR INSERT TO authenticated WITH CHECK (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));
CREATE POLICY org_invites_admin_update ON public.organization_invites
  FOR UPDATE TO authenticated
  USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role))
  WITH CHECK (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));
CREATE POLICY org_invites_admin_delete ON public.organization_invites
  FOR DELETE TO authenticated USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));

CREATE TRIGGER trg_org_invites_updated BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);

-- 4) Organizações já existentes: marcar onboarding como concluído (não reexecutar para o Grupo Guerra)
INSERT INTO public.organization_onboarding (organization_id, status, current_step, progress_percent, started_at, completed_at, completed_steps)
SELECT o.id, 'completed', 6, 100, o.created_at, now(), '["empresa","identidade","produtos","financeiro","equipe","operacional"]'::jsonb
FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- Registro de configuração vazio para organizações existentes (sem alterar dados operacionais)
INSERT INTO public.organization_settings (organization_id, display_name, legal_name)
SELECT o.id, o.name, o.name FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- 5) Novas organizações nascem com onboarding pendente + settings
CREATE OR REPLACE FUNCTION public.bootstrap_organization_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_onboarding (organization_id, status, current_step, progress_percent, started_at, created_by, updated_by)
  VALUES (NEW.id, 'pending', 1, 0, now(), NEW.created_by, NEW.created_by)
  ON CONFLICT (organization_id) DO NOTHING;

  INSERT INTO public.organization_settings (organization_id, display_name, legal_name, created_by, updated_by)
  VALUES (NEW.id, NEW.name, NEW.name, NEW.created_by, NEW.created_by)
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_org_setup
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_organization_setup();