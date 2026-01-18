-- Enable pg_cron extension (if not already enabled)
-- Note: This needs to be run by Supabase support or via dashboard for hosted projects
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION invoke_send_notifications()
RETURNS void AS $$
DECLARE
  result TEXT;
BEGIN
  -- Call the Edge Function using pg_net
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )::TEXT INTO result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION invoke_send_notifications() TO service_role;

-- Note: The actual cron schedule must be set up in Supabase Dashboard:
-- Go to Database > Extensions > pg_cron
-- Or use SQL Editor with:
-- SELECT cron.schedule('send-notifications', '*/5 * * * *', 'SELECT invoke_send_notifications()');

-- Alternative: Use Supabase Dashboard Scheduled Functions (recommended)
-- This is the preferred method and doesn't require pg_cron

COMMENT ON FUNCTION invoke_send_notifications IS 'Invokes the send-notifications Edge Function. Schedule via Supabase Dashboard cron.';
