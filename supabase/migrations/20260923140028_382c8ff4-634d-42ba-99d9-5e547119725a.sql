REVOKE ALL ON FUNCTION private.can_write(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_org_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_write(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_active(uuid) TO authenticated, service_role;