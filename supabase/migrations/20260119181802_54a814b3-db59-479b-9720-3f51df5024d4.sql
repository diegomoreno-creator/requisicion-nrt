-- Update RLS policies to use 'pendiente' instead of 'borrador'
-- Also update the default value for requisiciones.estado

-- Update requisiciones UPDATE policy to allow owners to update their pending items
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role" 
ON public.requisiciones 
FOR UPDATE 
USING (
  -- Owner can update their own pending items
  ((solicitado_por = auth.uid()) AND (estado = 'pendiente'::requisition_status))
  -- Superadmin can update any
  OR is_superadmin(auth.uid())
  -- Admin and comprador can update
  OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'comprador'::app_role]))
  -- Autorizador can update assigned pending items
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()))
  -- Presupuestos can update pedido_colocado
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  -- Tesoreria can update pedido_autorizado
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
);

-- Update soft delete policy for pending items
DROP POLICY IF EXISTS "Solicitadores can soft delete their draft requisitions" ON public.requisiciones;

CREATE POLICY "Solicitadores can soft delete their pending requisitions"
ON public.requisiciones
FOR UPDATE
USING (
  solicitado_por = auth.uid() 
  AND estado = 'pendiente'
  AND deleted_at IS NULL
)
WITH CHECK (
  solicitado_por = auth.uid() 
  AND deleted_at IS NOT NULL
);

-- Update partidas UPDATE policy
DROP POLICY IF EXISTS "Users can update partidas of their requisitions" ON public.requisicion_partidas;

CREATE POLICY "Users can update partidas of their requisitions"
ON public.requisicion_partidas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.requisiciones r 
    WHERE r.id = requisicion_id 
    AND r.solicitado_por = auth.uid()
    AND r.estado = 'pendiente'
  )
);

-- Update partidas DELETE policy
DROP POLICY IF EXISTS "Users can delete partidas of their requisitions" ON public.requisicion_partidas;

CREATE POLICY "Users can delete partidas of their requisitions"
ON public.requisicion_partidas FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.requisiciones r 
    WHERE r.id = requisicion_id 
    AND r.solicitado_por = auth.uid()
    AND r.estado = 'pendiente'
  )
);

-- Update reposiciones UPDATE policy
DROP POLICY IF EXISTS "Users can update their own draft reposiciones" ON public.reposiciones;

CREATE POLICY "Users can update their own pending reposiciones"
ON public.reposiciones
FOR UPDATE
USING (
  (solicitado_por = auth.uid() AND estado = 'pendiente')
  OR is_superadmin(auth.uid())
  OR get_user_role(auth.uid()) IN ('admin', 'comprador', 'autorizador')
);

-- Update reposicion_gastos UPDATE policy
DROP POLICY IF EXISTS "Users can update gastos of their draft reposiciones" ON public.reposicion_gastos;

CREATE POLICY "Users can update gastos of their pending reposiciones"
ON public.reposicion_gastos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.reposiciones r 
    WHERE r.id = reposicion_id 
    AND r.solicitado_por = auth.uid()
    AND r.estado = 'pendiente'
  )
);

-- Update reposicion_gastos DELETE policy  
DROP POLICY IF EXISTS "Users can delete gastos of their draft reposiciones" ON public.reposicion_gastos;

CREATE POLICY "Users can delete gastos of their pending reposiciones"
ON public.reposicion_gastos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.reposiciones r 
    WHERE r.id = reposicion_id 
    AND r.solicitado_por = auth.uid()
    AND r.estado = 'pendiente'
  )
);

-- Update can_view_requisicion function to handle that 'borrador' no longer exists
-- and autorizadores can now see 'pendiente' items assigned to them
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Autorizador can view requisitions assigned to them (pendiente) or their own created
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

-- Update default estado values to 'pendiente'
ALTER TABLE public.requisiciones ALTER COLUMN estado SET DEFAULT 'pendiente'::requisition_status;
ALTER TABLE public.reposiciones ALTER COLUMN estado SET DEFAULT 'pendiente';