-- Add soft delete column to requisiciones
ALTER TABLE public.requisiciones 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries on non-deleted items
CREATE INDEX idx_requisiciones_deleted_at ON public.requisiciones (deleted_at);

-- Update the can_view_requisicion function to exclude deleted requisitions (except for superadmin)
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  req_solicitante UUID;
  req_autorizador UUID;
  req_estado requisition_status;
  req_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = _user_id;
  SELECT solicitado_por, autorizador_id, estado, deleted_at INTO req_solicitante, req_autorizador, req_estado, req_deleted_at 
  FROM public.requisiciones WHERE id = _requisicion_id;
  
  -- Superadmin can view all including deleted
  IF user_role = 'superadmin' THEN RETURN true; END IF;
  
  -- Other roles cannot view deleted requisitions
  IF req_deleted_at IS NOT NULL THEN RETURN false; END IF;
  
  -- Admin can view assigned or created
  IF user_role = 'admin' AND (req_solicitante = _user_id OR req_autorizador = _user_id) THEN RETURN true; END IF;
  
  -- Autorizador can view requisitions assigned to them (only pendiente) or their own created
  IF user_role = 'autorizador' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_autorizador = _user_id AND req_estado = 'pendiente' THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Comprador can view their own OR requisitions in 'aprobado' or 'en_licitacion' status
  IF user_role = 'comprador' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado IN ('aprobado', 'en_licitacion') THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Presupuestos can only view requisitions in 'pedido_colocado' status
  IF user_role = 'presupuestos' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado = 'pedido_colocado' THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Tesoreria can only view requisitions in 'pedido_autorizado' status
  IF user_role = 'tesoreria' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado = 'pedido_autorizado' THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Solicitador can only view their own
  IF user_role = 'solicitador' AND req_solicitante = _user_id THEN RETURN true; END IF;
  
  RETURN false;
END;
$function$;

-- Add policy for solicitadores to soft-delete their own draft requisitions
CREATE POLICY "Solicitadores can soft delete their draft requisitions"
ON public.requisiciones
FOR UPDATE
USING (
  solicitado_por = auth.uid() 
  AND estado = 'borrador'
  AND deleted_at IS NULL
)
WITH CHECK (
  solicitado_por = auth.uid()
  AND deleted_at IS NOT NULL
);