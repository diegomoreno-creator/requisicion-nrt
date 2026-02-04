-- Update can_view_requisicion to exclude soft-deleted items for non-superadmins
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requisicion RECORD;
BEGIN
  -- Get requisicion details
  SELECT * INTO _requisicion FROM requisiciones WHERE id = _requisicion_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Superadmin can see everything (including deleted)
  IF is_superadmin(_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Non-superadmins cannot see soft-deleted items
  IF _requisicion.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin can see assigned or created requisitions
  IF has_role(_user_id, 'admin') THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
  
  -- Autorizador can see:
  -- 1. Their assigned requisitions (pending)
  -- 2. Their own created requisitions
  -- 3. Requisitions they authorized (autorizado_por = user_id) - at any stage
  IF has_role(_user_id, 'autorizador') AND (
    _requisicion.autorizador_id = _user_id 
    OR _requisicion.solicitado_por = _user_id
    OR _requisicion.autorizado_por = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Comprador can see:
  -- 1. Their own created requisitions
  -- 2. Approved requisitions
  -- 3. En licitacion requisitions
  -- 4. Requisitions with justificacion_rechazo (rejected by them)
  IF has_role(_user_id, 'comprador') AND (
    _requisicion.solicitado_por = _user_id 
    OR _requisicion.estado IN ('aprobado', 'en_licitacion', 'pedido_colocado', 'pedido_autorizado', 'pedido_pagado')
    OR _requisicion.justificacion_rechazo IS NOT NULL
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Presupuestos can see items at pedido_colocado stage, their own, or ones they rejected/authorized
  IF has_role(_user_id, 'presupuestos') AND (
    _requisicion.estado = 'pedido_colocado' 
    OR _requisicion.solicitado_por = _user_id
    OR _requisicion.rechazado_por_presupuestos_id = _user_id
    OR _requisicion.pedido_autorizado_por = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Tesoreria can see items at pedido_autorizado stage, their own, or ones they paid
  IF has_role(_user_id, 'tesoreria') AND (
    _requisicion.estado = 'pedido_autorizado' 
    OR _requisicion.solicitado_por = _user_id
    OR _requisicion.pagado_por = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Solicitador can see their own requisitions
  IF has_role(_user_id, 'solicitador') AND _requisicion.solicitado_por = _user_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;