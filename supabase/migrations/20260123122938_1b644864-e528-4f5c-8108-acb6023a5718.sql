-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to notify tramite changes via edge function
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
    
    -- Make async HTTP POST to the edge function
    PERFORM extensions.http_post(
      url := webhook_url,
      body := payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      )::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for requisiciones
DROP TRIGGER IF EXISTS on_requisicion_estado_change ON public.requisiciones;
CREATE TRIGGER on_requisicion_estado_change
  AFTER UPDATE ON public.requisiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();

-- Create trigger for reposiciones  
DROP TRIGGER IF EXISTS on_reposicion_estado_change ON public.reposiciones;
CREATE TRIGGER on_reposicion_estado_change
  AFTER UPDATE ON public.reposiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();