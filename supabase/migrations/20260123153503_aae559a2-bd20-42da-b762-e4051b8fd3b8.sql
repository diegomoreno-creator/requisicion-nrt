-- Update trigger function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.notify_tramite_estado_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  webhook_url TEXT;
  payload JSONB;
  should_notify BOOLEAN := FALSE;
BEGIN
  -- For INSERT: notify if estado is 'pendiente' (new tramite)
  IF TG_OP = 'INSERT' AND NEW.estado = 'pendiente' THEN
    should_notify := TRUE;
  END IF;
  
  -- For UPDATE: only trigger on estado change
  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    should_notify := TRUE;
  END IF;
  
  IF should_notify THEN
    -- Build the webhook URL
    webhook_url := 'https://nooeffvybuqwujdmhsvy.supabase.co/functions/v1/notify-tramite-change';
    
    -- Build the payload
    payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
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

-- Recreate trigger for requisiciones to include INSERT
DROP TRIGGER IF EXISTS on_requisicion_estado_change ON public.requisiciones;
CREATE TRIGGER on_requisicion_estado_change
  AFTER INSERT OR UPDATE ON public.requisiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();

-- Recreate trigger for reposiciones to include INSERT
DROP TRIGGER IF EXISTS on_reposicion_estado_change ON public.reposiciones;
CREATE TRIGGER on_reposicion_estado_change
  AFTER INSERT OR UPDATE ON public.reposiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tramite_estado_change();