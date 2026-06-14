
-- COMPANIES extra fields
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS employees_count integer,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- CONTACTS extra fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS notes text;

-- LEADS extra fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS interest text;

-- OPPORTUNITIES extra fields
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS probability integer,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Helpful indexes for CRM
CREATE INDEX IF NOT EXISTS idx_companies_org_stage ON public.companies(organization_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_companies_org_favorite ON public.companies(organization_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_company ON public.opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);

-- Auto-create org + owner membership for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, created_by, updated_by)
  VALUES (_name || ' — Workspace', NEW.id, NEW.id)
  RETURNING id INTO _org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, created_by, updated_by)
  VALUES (_org_id, NEW.id, 'owner', NEW.id, NEW.id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
