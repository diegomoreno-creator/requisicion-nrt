
-- Drop and recreate the multi-autorizadores update policy to remove rechazado->pendiente transition
DROP POLICY IF EXISTS "Multi-autorizadores can update requisiciones" ON requisiciones;

CREATE POLICY "Multi-autorizadores can update requisiciones"
ON requisiciones FOR UPDATE
USING (
  has_role(auth.uid(), 'autorizador'::app_role) 
  AND estado = 'pendiente'::requisition_status 
  AND EXISTS (
    SELECT 1 FROM requisicion_autorizadores ra
    WHERE ra.requisicion_id = requisiciones.id AND ra.autorizador_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'autorizador'::app_role) 
  AND estado IN ('pendiente'::requisition_status, 'aprobado'::requisition_status, 'rechazado'::requisition_status)
);

-- Update the main update policy to remove autorizador ability to transition from rechazado to pendiente
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON requisiciones;

CREATE POLICY "Users can update requisitions based on role"
ON requisiciones FOR UPDATE
USING (
  (solicitado_por = auth.uid() AND estado IN ('pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status))
  OR is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'revision'::app_role) AND revisor_id = auth.uid() AND estado = 'pendiente_revision'::requisition_status)
  OR (has_role(auth.uid(), 'comprador'::app_role) AND estado IN ('aprobado'::requisition_status, 'en_licitacion'::requisition_status))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND autorizador_id = auth.uid() AND estado IN ('pendiente'::requisition_status, 'aprobado'::requisition_status, 'en_licitacion'::requisition_status))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND autorizador_id = auth.uid() AND estado = 'pedido_colocado'::requisition_status AND justificacion_rechazo_presupuestos IS NOT NULL)
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND estado = 'pedido_colocado'::requisition_status)
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND estado = 'pedido_autorizado'::requisition_status)
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (solicitado_por = auth.uid() AND estado IN ('pendiente'::requisition_status, 'pendiente_revision'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status))
  OR (has_role(auth.uid(), 'revision'::app_role) AND revisor_id = auth.uid() AND estado IN ('pendiente_revision'::requisition_status, 'pendiente'::requisition_status, 'rechazado'::requisition_status))
  OR (has_role(auth.uid(), 'autorizador'::app_role) AND autorizador_id = auth.uid() AND estado IN ('aprobado'::requisition_status, 'rechazado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status))
  OR (has_role(auth.uid(), 'comprador'::app_role) AND estado IN ('aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status))
  OR (has_role(auth.uid(), 'presupuestos'::app_role) AND estado IN ('pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status))
  OR (has_role(auth.uid(), 'tesoreria'::app_role) AND estado IN ('pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status))
);
