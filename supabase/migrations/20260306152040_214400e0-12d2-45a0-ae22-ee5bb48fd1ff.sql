
-- Update RLS USING policy for tesoreria to also allow updating when estado is pedido_pagado (for credit payment)
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role"
ON public.requisiciones
FOR UPDATE
TO authenticated
USING (
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status])))
  OR is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = 'pendiente_revision'::requisition_status))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = 'pedido_colocado'::requisition_status) AND (justificacion_rechazo_presupuestos IS NOT NULL))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'pendiente_revision'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  OR (has_role(auth.uid(), 'revision'::app_role) AND (revisor_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente_revision'::requisition_status, 'pendiente'::requisition_status, 'rechazado'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status])))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);
