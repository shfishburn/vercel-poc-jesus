-- public.enforce_rate_limit is SECURITY DEFINER and was only ever granted to
-- service_role, but PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default, so the anon and authenticated roles could still call it.
-- Revoke the default and re-assert the single intended grant. Idempotent.

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, text, integer, integer)
  TO service_role;
