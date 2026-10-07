GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.assert_can_create(uuid, text, text, text), private.audit_subscription(uuid, text, jsonb, jsonb, jsonb),
  private.effective_subscription_status(uuid), private.enforce_commercial_insert(), private.has_feature(uuid, text),
  private.log_subscription_change(), private.org_limit(uuid, text), private.org_usage(uuid, text),
  private.require_platform_admin(), private.subscription_allows_write(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.require_platform_admin(), private.subscription_allows_write(uuid) TO authenticated;