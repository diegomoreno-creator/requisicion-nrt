
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _requisicion RECORD;
BEGIN
  SELECT * INTO _requisicion FROM requisiciones WHERE id = _requisicion_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF is_superadmin(_user_id) THEN RETURN TRUE; END IF;
  IF _requisicion.deleted_at IS NOT NULL THEN RETURN FALSE; END IF;
  -- Almacen users can see all requisiciones marked as pedido de almacen
  IF has_role(_user_id, 'almacen') AND _requisicion.es_pedido_almacen = true THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'admin') THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
  IF has_role(_user_id, 'autorizador') AND EXISTS (
    SELECT 1 FROM requisicion_autorizadores ra
    WHERE ra.requisicion_id = _requisicion_id AND ra.autorizador_id = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'revision') AND (
    _requisicion.revisor_id = _user_id OR _requisicion.solicitado_por = _user_id OR _requisicion.revisado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'autorizador') AND (
    _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id OR _requisicion.autorizado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'comprador') AND (
    _requisicion.solicitado_por = _user_id 
    OR _requisicion.estado IN ('aprobado', 'en_licitacion', 'pedido_colocado', 'pedido_autorizado', 'pedido_pagado')
    OR _requisicion.justificacion_rechazo IS NOT NULL
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'presupuestos') AND (
    _requisicion.estado = 'pedido_colocado' OR _requisicion.solicitado_por = _user_id
    OR _requisicion.rechazado_por_presupuestos_id = _user_id OR _requisicion.pedido_autorizado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'tesoreria') AND (
    _requisicion.estado = 'pedido_autorizado' OR _requisicion.solicitado_por = _user_id OR _requisicion.pagado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'solicitador') AND _requisicion.solicitado_por = _user_id THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;
