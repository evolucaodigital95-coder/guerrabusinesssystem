
-- Strategy module: seasons / campaigns / projects extensions + snapshots

ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_campaign_id ON public.projects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_projects_season_id ON public.projects(season_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_season_id ON public.campaigns(season_id);

-- Snapshots ao encerrar temporada (histórico imutável)
CREATE TABLE IF NOT EXISTS public.season_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  expenses numeric(14,2) NOT NULL DEFAULT 0,
  profit numeric(14,2) NOT NULL DEFAULT 0,
  lectures_count integer NOT NULL DEFAULT 0,
  companies_count integer NOT NULL DEFAULT 0,
  agents_count integer NOT NULL DEFAULT 0,
  stock_movements_count integer NOT NULL DEFAULT 0,
  people_impacted integer NOT NULL DEFAULT 0,
  payload jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  archived_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_snapshots TO authenticated;
GRANT ALL ON public.season_snapshots TO service_role;

ALTER TABLE public.season_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "season_snapshots org read"
  ON public.season_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY "season_snapshots org insert"
  ON public.season_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "season_snapshots org update"
  ON public.season_snapshots FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "season_snapshots org delete"
  ON public.season_snapshots FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

CREATE INDEX IF NOT EXISTS idx_season_snapshots_season ON public.season_snapshots(season_id);
CREATE INDEX IF NOT EXISTS idx_season_snapshots_org ON public.season_snapshots(organization_id);

CREATE TRIGGER set_updated_at_season_snapshots
  BEFORE UPDATE ON public.season_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria para Temporadas / Campanhas / Projetos / Snapshots
CREATE TRIGGER audit_seasons
  AFTER INSERT OR UPDATE OR DELETE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_season_snapshots
  AFTER INSERT OR UPDATE OR DELETE ON public.season_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
