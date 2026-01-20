-- Update the can_view_requisicion function to allow Presupuestos and Tesorería to see requisitions they have processed
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
  req_autorizado_por UUID;
  req_pedido_autorizado_por UUID;
  req_pagado_por UUID;
  req_estado requisition_status;
  req_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = _user_id;
  SELECT solicitado_por, autorizador_id, autorizado_por, pedido_autorizado_por, pagado_por, estado, deleted_at 
  INTO req_solicitante, req_autorizador, req_autorizado_por, req_pedido_autorizado_por, req_pagado_por, req_estado, req_deleted_at 
  FROM public.requisiciones WHERE id = _requisicion_id;
  
  -- Superadmin can view all including deleted
  IF user_role = 'superadmin' THEN RETURN true; END IF;
  
  -- Other roles cannot view deleted requisitions
  IF req_deleted_at IS NOT NULL THEN RETURN false; END IF;
  
  -- Admin can view assigned or created
  IF user_role = 'admin' AND (req_solicitante = _user_id OR req_autorizador = _user_id) THEN RETURN true; END IF;
  
  -- Autorizador can view:
  -- 1. Requisitions they created
  -- 2. Requisitions assigned to them when pending
  -- 3. Requisitions they have already authorized (autorizado_por = user_id)
  IF user_role = 'autorizador' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_autorizador = _user_id AND req_estado = 'pendiente' THEN RETURN true; END IF;
    IF req_autorizado_por = _user_id THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Comprador can view their own OR requisitions in 'aprobado' or 'en_licitacion' status
  IF user_role = 'comprador' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado IN ('aprobado', 'en_licitacion') THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Presupuestos can view:
  -- 1. Requisitions they created
  -- 2. Requisitions in 'pedido_colocado' status (pending their action)
  -- 3. Requisitions they have already authorized (pedido_autorizado_por = user_id)
  IF user_role = 'presupuestos' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado = 'pedido_colocado' THEN RETURN true; END IF;
    IF req_pedido_autorizado_por = _user_id THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Tesoreria can view:
  -- 1. Requisitions they created
  -- 2. Requisitions in 'pedido_autorizado' status (pending their action)
  -- 3. Requisitions they have already paid (pagado_por = user_id)
  IF user_role = 'tesoreria' THEN
    IF req_solicitante = _user_id THEN RETURN true; END IF;
    IF req_estado = 'pedido_autorizado' THEN RETURN true; END IF;
    IF req_pagado_por = _user_id THEN RETURN true; END IF;
    RETURN false;
  END IF;
  
  -- Solicitador can only view their own
  IF user_role = 'solicitador' AND req_solicitante = _user_id THEN RETURN true; END IF;
  
  RETURN false;
END;
$function$;