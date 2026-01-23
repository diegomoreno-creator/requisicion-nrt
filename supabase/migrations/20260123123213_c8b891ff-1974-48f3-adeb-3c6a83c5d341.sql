-- Fix the trigger function to use correct pg_net syntax
CREATE OR REPLACE FUNCTION public.notify_tramite_estado_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- Only trigger on estado change
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Build the webhook URL
    webhook_url := 'https://nooeffvybuqwujdmhsvy.supabase.co/functions/v1/notify-tramite-change';
    
    -- Build the payload
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
    
    -- Make async HTTP POST using net.http_post
    PERFORM net.http_post(
      url := webhook_url,
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$;