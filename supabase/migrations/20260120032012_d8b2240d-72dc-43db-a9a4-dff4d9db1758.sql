-- Drop and recreate the update policy to allow solicitador to edit rejected items and resubmit as aprobado
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role" 
ON public.requisiciones 
FOR UPDATE 
USING (
  -- Owner can update their pending OR rejected items (for resubmission)
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  -- Superadmin and admin can update anything
  OR is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  -- Comprador can update aprobado or en_licitacion items
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  -- Autorizador can update pending OR rejected items (to revert)
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  -- Presupuestos can update pedido_colocado items
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  -- Tesoreria can update pedido_autorizado items
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  -- Owner can set to pendiente, cancelado, or aprobado (for resubmission to comprador)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  -- Autorizador can approve, reject, or revert to pendiente
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status])))
  -- Comprador can set to aprobado, en_licitacion, pedido_colocado, or pendiente (for rejection)
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  -- Presupuestos can set to pedido_autorizado
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
  -- Tesoreria can set to pedido_pagado
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_pagado'::requisition_status))
);