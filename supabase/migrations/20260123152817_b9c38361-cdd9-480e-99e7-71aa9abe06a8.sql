-- Enable the pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.notify_tramite_estado_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Create trigger for requisiciones table
DROP TRIGGER IF EXISTS on_requisicion_estado_change ON public.requisiciones;
CREATE TRIGGER on_requisicion_estado_change
  AFTER UPDATE ON public.requisiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();

-- Create trigger for reposiciones table
DROP TRIGGER IF EXISTS on_reposicion_estado_change ON public.reposiciones;
CREATE TRIGGER on_reposicion_estado_change
  AFTER UPDATE ON public.reposiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();