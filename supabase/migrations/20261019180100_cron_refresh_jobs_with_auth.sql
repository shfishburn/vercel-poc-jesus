-- Reschedule the 6-hour refresh jobs with an Authorization header.
-- suffering-index is not listed in supabase/config.toml, so JWT verification
-- is on and the bare POST from the earlier schedules is rejected with 401.
-- The anon key is read from Supabase Vault when each job runs; this file
-- never contains it. If the Vault secret is missing the migration still
-- applies, prints the one-time command, and leaves the schedules untouched.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  supabase_url text := coalesce(
    nullif(current_setting('app.settings.supabase_url', true), ''),
    'https://yuwjkhnkgvxehkzyjqlz.supabase.co'
  );
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'supabase_anon_key') then
    raise notice 'Skipping cron schedules: Vault secret supabase_anon_key is missing. Run once: select vault.create_secret(''<anon key>'', ''supabase_anon_key''); then run this migration again.';
    return;
  end if;

  -- Replace existing jobs if they already exist.
  if exists (select 1 from cron.job where jobname = 'refresh-suffering-index-6h') then
    perform cron.unschedule('refresh-suffering-index-6h');
  end if;

  if exists (select 1 from cron.job where jobname = 'refresh-ai-incidents-6h') then
    perform cron.unschedule('refresh-ai-incidents-6h');
  end if;

  -- Suffering Index refresh every 6 hours.
  perform cron.schedule(
    'refresh-suffering-index-6h',
    '0 */6 * * *',
    format(
      $request$select net.http_post(
          url := '%s/functions/v1/suffering-index',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key')
          ),
          body := '{"force":true}'::jsonb
        )$request$,
      supabase_url
    )
  );

  -- AI Incidents refresh every 6 hours.
  perform cron.schedule(
    'refresh-ai-incidents-6h',
    '0 */6 * * *',
    format(
      $request$select net.http_post(
          url := '%s/functions/v1/ai-incidents?refresh=true',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key')
          ),
          body := '{}'::jsonb
        )$request$,
      supabase_url
    )
  );
end
$$;
