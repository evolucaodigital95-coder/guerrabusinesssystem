CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_diff jsonb; v_org uuid; v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
    v_action := 'organization.status_changed'; v_org := NEW.id; v_id := NEW.id;
    v_diff := jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', to_jsonb(NEW)->'status_reason', 'name', NEW.name);
  ELSE
    IF TG_OP = 'INSERT' THEN
      v_action := 'member.added'; v_org := NEW.organization_id; v_id := NEW.id;
      v_diff := jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role, 'status', NEW.status);
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'member.removed'; v_org := OLD.organization_id; v_id := OLD.id;
      v_diff := jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role, 'status', OLD.status);
    ELSE
      IF OLD.role IS NOT DISTINCT FROM NEW.role AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
      v_action := CASE WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'member.role_changed' ELSE 'member.status_changed' END;
      v_org := NEW.organization_id; v_id := NEW.id;
      v_diff := jsonb_build_object('user_id', NEW.user_id, 'role', jsonb_build_object('from', OLD.role, 'to', NEW.role), 'status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
  END IF;
  INSERT INTO public.platform_audit_log(actor_id, action, entity_type, entity_id, organization_id, diff)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_id, v_org, v_diff);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_admin_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_audit_admin_org AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE TRIGGER trg_audit_admin_members AFTER INSERT OR UPDATE OR DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();