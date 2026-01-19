-- Update the can_view_requisicion function to implement stage-based visibility
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
  req_solicitante UUID;
  req_autorizador UUID;
  req_estado requisition_status;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = _user_id;
  SELECT solicitado_por, autorizador_id, estado INTO req_solicitante, req_autorizador, req_estado 
  FROM public.requisiciones WHERE id = _requisicion_id;
  
  -- Superadmin can view all
  IF user_role = 'superadmin' THEN RETURN true; END IF;
  
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
$$;

-- Update requisiciones RLS policy to include new roles for updates
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role" 
ON public.requisiciones 
FOR UPDATE 
USING (
  -- Owner can update their own drafts
  ((solicitado_por = auth.uid()) AND (estado = 'borrador'::requisition_status))
  -- Superadmin can update any
  OR is_superadmin(auth.uid())
  -- Admin/comprador can update
  OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'comprador'::app_role]))
  -- Autorizador can update assigned requisitions (for approve/reject)
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()))
  -- Presupuestos can update pedido_colocado to pedido_autorizado
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  -- Tesoreria can update pedido_autorizado to pedido_pagado
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
);