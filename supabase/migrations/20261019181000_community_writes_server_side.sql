-- Community writes move behind the `community` edge function (service role).
-- Deploy that function before applying this migration.

-- 1) Drop the anon/authenticated INSERT policies. Writes now come only from the service role.
DROP POLICY IF EXISTS "Allow anonymous inserts to prayer wall" ON public.prayer_wall;
DROP POLICY IF EXISTS "Allow anonymous inserts to prayer wall reactions" ON public.prayer_wall_reactions;
DROP POLICY IF EXISTS "Allow anonymous inserts to global prayer voices" ON public.global_prayer_voices;
DROP POLICY IF EXISTS "Allow anonymous inserts to safety_signals" ON public.safety_signals;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.analytics_events;

-- 2) The wall shows approved entries from the last 24 hours only.
DROP POLICY IF EXISTS "Public can read approved prayer wall" ON public.prayer_wall;
CREATE POLICY "Public can read approved prayer wall"
  ON public.prayer_wall
  FOR SELECT
  USING (approved = true AND created_at > now() - interval '24 hours');

-- 3) The SECURITY DEFINER RPCs are callable by the service role only.
REVOKE EXECUTE ON FUNCTION public.increment_prayer_reaction(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_prayer_reaction(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_prayer_voice(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_prayer_voice(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_session_votes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_votes(text) TO service_role;

-- 4) Purge wall entries older than 24 hours every hour (reactions cascade).
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-prayer-wall-24h') then
    perform cron.unschedule('purge-prayer-wall-24h');
  end if;

  perform cron.schedule(
    'purge-prayer-wall-24h',
    '0 * * * *',
    $job$DELETE FROM public.prayer_wall WHERE created_at < now() - interval '24 hours'$job$
  );
end
$$;
