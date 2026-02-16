
-- Add revision_habilitada to catalogo_empresas
ALTER TABLE public.catalogo_empresas ADD COLUMN IF NOT EXISTS revision_habilitada boolean NOT NULL DEFAULT false;

-- Add revision columns to requisiciones
ALTER TABLE public.requisiciones 
  ADD COLUMN IF NOT EXISTS revisor_id uuid,
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS fecha_revision timestamp with time zone,
  ADD COLUMN IF NOT EXISTS justificacion_devolucion_revision text;

-- Add revision columns to reposiciones
ALTER TABLE public.reposiciones 
  ADD COLUMN IF NOT EXISTS revisor_id uuid,
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS fecha_revision timestamp with time zone,
  ADD COLUMN IF NOT EXISTS justificacion_devolucion_revision text;

-- Update can_view_requisicion to include revision role
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _requisicion RECORD;
BEGIN
  SELECT * INTO _requisicion FROM requisiciones WHERE id = _requisicion_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF is_superadmin(_user_id) THEN RETURN TRUE; END IF;
  IF _requisicion.deleted_at IS NOT NULL THEN RETURN FALSE; END IF;
  IF has_role(_user_id, 'admin') THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
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

-- Update RLS for requisiciones UPDATE
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;
CREATE POLICY "Users can update requisitions based on role"
ON public.requisiciones FOR UPDATE
USING (
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status])))
  OR is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = 'pendiente_revision'::requisition_status))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = 'pedido_colocado'::requisition_status) AND (justificacion_rechazo_presupuestos IS NOT NULL))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'pendiente_revision'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente_revision'::requisition_status, 'pendiente'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status])))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);

-- Update SELECT policy
DROP POLICY IF EXISTS "Users can view requisitions based on role" ON public.requisiciones;
CREATE POLICY "Users can view requisitions based on role"
ON public.requisiciones FOR SELECT
USING (
  can_view_requisicion(auth.uid(), id)
  OR (autorizado_por = auth.uid())
  OR (licitado_por = auth.uid())
  OR (pedido_colocado_por = auth.uid())
  OR (pedido_autorizado_por = auth.uid())
  OR (pagado_por = auth.uid())
  OR (revisado_por = auth.uid())
);

-- Update reposiciones SELECT
DROP POLICY IF EXISTS "Users can view their own reposiciones" ON public.reposiciones;
CREATE POLICY "Users can view their own reposiciones"
ON public.reposiciones FOR SELECT
USING (
  (solicitado_por = auth.uid()) OR (autorizador_id = auth.uid()) OR (revisor_id = auth.uid())
  OR is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'comprador'::app_role]))
  OR (autorizado_por = auth.uid()) OR (pagado_por = auth.uid()) OR (revisado_por = auth.uid())
);

-- Update reposiciones UPDATE
DROP POLICY IF EXISTS "Users can update reposiciones based on role" ON public.reposiciones;
CREATE POLICY "Users can update reposiciones based on role"
ON public.reposiciones FOR UPDATE
USING (
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::text, 'pendiente_revision'::text])))
  OR is_superadmin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comprador'::app_role)
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = 'pendiente_revision'::text))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()))
)
WITH CHECK (
  is_superadmin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::text, 'pendiente_revision'::text, 'cancelado'::text])))
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente_revision'::text, 'pendiente'::text])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::text, 'rechazado'::text, 'pendiente'::text])))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::text, 'pagado'::text, 'pendiente'::text])))
);

-- Update soft-delete policy
DROP POLICY IF EXISTS "Solicitadores can soft delete their pending requisitions" ON public.requisiciones;
CREATE POLICY "Solicitadores can soft delete their pending requisitions"
ON public.requisiciones FOR UPDATE
USING (
  (solicitado_por = auth.uid()) 
  AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'pendiente_revision'::requisition_status])) 
  AND (deleted_at IS NULL)
)
WITH CHECK (
  (solicitado_por = auth.uid()) AND (deleted_at IS NOT NULL)
);
