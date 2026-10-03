CREATE OR REPLACE FUNCTION private.validate_account_closing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_year int; v_seq int; v_last int; v_prev text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE a.id = NEW.agent_id AND a.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'agent does not belong to this organization' USING ERRCODE = '42501';
  END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT closing_number INTO v_prev FROM public.account_closings
     WHERE id = NEW.supersedes_id AND organization_id = NEW.organization_id;
    IF v_prev IS NULL OR v_prev <> NEW.closing_number THEN
      RAISE EXCEPTION 'reissue must keep the original closing number' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.closing_number !~ '^GG-\d{4}-AG-\d{4,}$' THEN
    RAISE EXCEPTION 'invalid closing number format' USING ERRCODE = '22023';
  END IF;
  v_year := substring(NEW.closing_number from '^GG-(\d{4})-')::int;
  v_seq  := (regexp_replace(NEW.closing_number, '^.*-', ''))::int;
  SELECT last_seq INTO v_last FROM private.closing_number_counters
   WHERE organization_id = NEW.organization_id AND year = v_year;
  IF v_last IS NULL OR v_seq < 1 OR v_seq > v_last THEN
    RAISE EXCEPTION 'closing number was not reserved for this organization' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_account_closing() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_validate_account_closing BEFORE INSERT ON public.account_closings
FOR EACH ROW EXECUTE FUNCTION private.validate_account_closing();