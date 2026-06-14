
-- =========================================================
-- GBS — Arquitetura base multi-tenant
-- =========================================================

-- ---------- ENUMS ----------
CREATE TYPE public.org_role AS ENUM ('owner','admin','member','viewer');

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  avatar_url    text,
  email         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles self read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- ORGANIZATIONS + MEMBERSHIP
-- =========================================================
CREATE TABLE public.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              public.org_role NOT NULL DEFAULT 'member',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id),
  archived_at       timestamptz,
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_members_updated BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid() AND archived_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _role public.org_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid()
      AND role = _role AND archived_at IS NULL
  );
$$;

-- Organizations policies
CREATE POLICY "orgs members read" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "orgs owners update" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_org_role(id,'owner') OR public.has_org_role(id,'admin'));
CREATE POLICY "orgs creator insert" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Members policies
CREATE POLICY "members read own org" ON public.organization_members
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id) OR user_id = auth.uid());
CREATE POLICY "members admin manage" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id,'owner') OR public.has_org_role(organization_id,'admin'))
  WITH CHECK (public.has_org_role(organization_id,'owner') OR public.has_org_role(organization_id,'admin'));

-- =========================================================
-- Generic helper macro pattern (we write each table explicitly)
-- Standard columns: id, organization_id, created_at, updated_at,
-- created_by, updated_by, archived_at
-- Standard policy: any org member can read/write.
-- =========================================================

-- ---------- SEASONS ----------
CREATE TABLE public.seasons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  starts_on       date,
  ends_on         date,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- CAMPAIGNS ----------
CREATE TABLE public.campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id       uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  name            text NOT NULL,
  channel         text,
  starts_on       date,
  ends_on         date,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- PROJECTS ----------
CREATE TABLE public.projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  status          text,
  starts_on       date,
  ends_on         date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- COMPANIES ----------
CREATE TABLE public.companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name      text NOT NULL,
  trade_name      text,
  document        text,
  website         text,
  segment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- CONTACTS ----------
CREATE TABLE public.contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  role            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- LEADS ----------
CREATE TABLE public.leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id       uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  source          text,
  status          text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- OPPORTUNITIES ----------
CREATE TABLE public.opportunities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title           text NOT NULL,
  stage           text,
  amount          numeric(14,2),
  currency        text DEFAULT 'BRL',
  expected_close  date,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- LECTURES ----------
CREATE TABLE public.lectures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id       uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title           text NOT NULL,
  scheduled_at    timestamptz,
  location        text,
  status          text,
  audience_size   integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- LECTURE_TOPICS ----------
CREATE TABLE public.lecture_topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lecture_id      uuid REFERENCES public.lectures(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  position        integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- ACCOUNTS ----------
CREATE TABLE public.accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  kind            text,
  currency        text DEFAULT 'BRL',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- FINANCIAL_MOVEMENTS ----------
CREATE TABLE public.financial_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id      uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  season_id       uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  direction       text,                  -- 'in' | 'out'
  category        text,
  description     text,
  amount          numeric(14,2),
  currency        text DEFAULT 'BRL',
  occurs_on       date,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- STOCK_ITEMS ----------
CREATE TABLE public.stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku             text,
  name            text NOT NULL,
  unit            text,
  category        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- INVENTORY_BATCHES ----------
CREATE TABLE public.inventory_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stock_item_id   uuid REFERENCES public.stock_items(id) ON DELETE CASCADE,
  code            text,
  quantity        numeric(14,3),
  received_on     date,
  expires_on      date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- STOCK_MOVEMENTS ----------
CREATE TABLE public.stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stock_item_id   uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  batch_id        uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  direction       text,                  -- 'in' | 'out'
  quantity        numeric(14,3),
  reason          text,
  occurs_on       date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- AGENTS ----------
CREATE TABLE public.agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- ADVANCES ----------
CREATE TABLE public.advances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  amount          numeric(14,2),
  currency        text DEFAULT 'BRL',
  granted_on      date,
  status          text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- ATTACHMENTS (polimórfico) ----------
CREATE TABLE public.attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  storage_path    text NOT NULL,
  file_name       text,
  mime_type       text,
  size_bytes      bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- NOTES (polimórfico) ----------
CREATE TABLE public.notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type     text,
  entity_id       uuid,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- TAGS ----------
CREATE TABLE public.tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz,
  UNIQUE (organization_id, name)
);

-- ---------- TAGGINGS (vínculo polimórfico tag <-> entidade) ----------
CREATE TABLE public.taggings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tag_id          uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz,
  UNIQUE (tag_id, entity_type, entity_id)
);

-- ---------- TIMELINE_EVENTS ----------
CREATE TABLE public.timeline_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type     text,
  entity_id       uuid,
  kind            text,
  title           text,
  body            text,
  occurs_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- DECISIONS ----------
CREATE TABLE public.decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  context         text,
  decision        text,
  consequences    text,
  decided_on      date,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- HISTORY_EVENTS ----------
CREATE TABLE public.history_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  happened_on     date,
  category        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- ROADMAP_PROJECTS ----------
CREATE TABLE public.roadmap_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  summary         text,
  status          text,
  priority        integer,
  target_quarter  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  archived_at     timestamptz
);

-- ---------- AUDIT_LOG ----------
CREATE TABLE public.audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES auth.users(id),
  entity_type     text NOT NULL,
  entity_id       uuid,
  action          text NOT NULL,
  diff            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Grants, RLS, triggers, policies for all entity tables
-- =========================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'seasons','campaigns','projects','companies','contacts',
    'leads','opportunities','lectures','lecture_topics',
    'accounts','financial_movements','stock_items',
    'inventory_batches','stock_movements','agents','advances',
    'attachments','notes','tags','taggings','timeline_events',
    'decisions','history_events','roadmap_projects'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))',
      t || '_member_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id))',
      t || '_member_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))',
      t || '_member_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_org_role(organization_id,''owner'') OR public.has_org_role(organization_id,''admin''))',
      t || '_admin_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      'trg_' || t || '_updated', t);
  END LOOP;
END $$;

-- Audit log: read by org members; writes from app/server only
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read members" ON public.audit_log
  FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_org_member(organization_id));
CREATE POLICY "audit insert members" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_org_member(organization_id));

-- =========================================================
-- Helpful indexes
-- =========================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'seasons','campaigns','projects','companies','contacts',
    'leads','opportunities','lectures','lecture_topics',
    'accounts','financial_movements','stock_items',
    'inventory_batches','stock_movements','agents','advances',
    'attachments','notes','tags','taggings','timeline_events',
    'decisions','history_events','roadmap_projects','organization_members'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)', 'idx_' || t || '_org', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON public.notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_taggings_entity ON public.taggings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entity ON public.timeline_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.organization_members(user_id);
