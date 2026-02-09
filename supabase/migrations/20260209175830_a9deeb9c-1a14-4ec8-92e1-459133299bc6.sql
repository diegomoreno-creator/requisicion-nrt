
-- Drop and recreate the update policy to allow autorizadores to update requisiciones in 'aprobado' and 'en_licitacion' states
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON requisiciones;

CREATE POLICY "Users can update requisitions based on role"
ON requisiciones FOR UPDATE
USING (
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  OR is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = 'pedido_colocado'::requisition_status) AND (justificacion_rechazo_presupuestos IS NOT NULL))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status])))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);
