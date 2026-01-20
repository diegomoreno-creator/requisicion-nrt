-- Update the can_view_requisicion function to allow comprador to see rejected requisitions
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _requisicion RECORD;
BEGIN
  -- Get user's role
  SELECT role INTO _role FROM user_roles WHERE user_id = _user_id;
  
  -- Get requisicion details
  SELECT * INTO _requisicion FROM requisiciones WHERE id = _requisicion_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Superadmin can see everything
  IF is_superadmin(_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Admin can see assigned or created requisitions
  IF _role = 'admin' THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
  
  -- Autorizador can see assigned or created requisitions
  IF _role = 'autorizador' THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
  
  -- Comprador can see:
  -- 1. Their own created requisitions
  -- 2. Approved requisitions
  -- 3. En licitacion requisitions
  -- 4. Requisitions with justificacion_rechazo (rejected by them)
  IF _role = 'comprador' THEN
    RETURN _requisicion.solicitado_por = _user_id 
      OR _requisicion.estado IN ('aprobado', 'en_licitacion', 'pedido_colocado', 'pedido_autorizado', 'pedido_pagado')
      OR _requisicion.justificacion_rechazo IS NOT NULL;
  END IF;
  
  -- Presupuestos can only see items at pedido_colocado stage
  IF _role = 'presupuestos' THEN
    RETURN _requisicion.estado = 'pedido_colocado' OR _requisicion.solicitado_por = _user_id;
  END IF;
  
  -- Tesoreria can only see items at pedido_autorizado stage
  IF _role = 'tesoreria' THEN
    RETURN _requisicion.estado = 'pedido_autorizado' OR _requisicion.solicitado_por = _user_id;
  END IF;
  
  -- Solicitador can see their own requisitions
  IF _role = 'solicitador' THEN
    RETURN _requisicion.solicitado_por = _user_id;
  END IF;
  
  RETURN FALSE;
END;
$$;