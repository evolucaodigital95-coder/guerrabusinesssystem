-- Auto-timeline: registra evento de criação em timeline_events para entidades principais

CREATE OR REPLACE FUNCTION public.auto_timeline_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text;
  v_title text;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'companies'            THEN 'company'
    WHEN 'contacts'             THEN 'contact'
    WHEN 'lectures'             THEN 'lecture'
    WHEN 'agents'               THEN 'agent'
    WHEN 'seasons'              THEN 'season'
    WHEN 'campaigns'            THEN 'campaign'
    WHEN 'projects'             THEN 'project'
    WHEN 'financial_movements'  THEN 'financial_movement'
    WHEN 'stock_items'          THEN 'stock_item'
    ELSE TG_TABLE_NAME
  END;

  v_title := CASE TG_TABLE_NAME
    WHEN 'companies'            THEN 'Empresa criada'
    WHEN 'contacts'             THEN 'Contato adicionado'
    WHEN 'lectures'             THEN 'Palestra criada'
    WHEN 'agents'               THEN 'Agendista cadastrado'
    WHEN 'seasons'              THEN 'Temporada criada'
    WHEN 'campaigns'            THEN 'Campanha criada'
    WHEN 'projects'             THEN 'Projeto criado'
    WHEN 'financial_movements'  THEN 'Lançamento criado'
    WHEN 'stock_items'          THEN 'Item de estoque criado'
    ELSE 'Registro criado'
  END;

  INSERT INTO public.timeline_events (
    organization_id, entity_type, entity_id, kind, title,
    occurs_at, created_by, updated_by
  ) VALUES (
    NEW.organization_id, v_entity_type, NEW.id, 'system', v_title,
    now(), auth.uid(), auth.uid()
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_timeline_event() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auto_timeline_event() TO authenticated, service_role;

-- Triggers AFTER INSERT em cada entidade
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'companies','contacts','lectures','agents',
    'seasons','campaigns','projects',
    'financial_movements','stock_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_timeline ON public.%I;
       CREATE TRIGGER trg_auto_timeline
         AFTER INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auto_timeline_event();',
      t, t
    );
  END LOOP;
END $$;