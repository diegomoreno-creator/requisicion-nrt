-- Drop the existing update policy and create a new one that allows comprador to reject (set to pendiente)
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role" 
ON public.requisiciones 
FOR UPDATE 
USING (
  ((solicitado_por = auth.uid()) AND (estado = 'pendiente'::requisition_status)) 
  OR is_superadmin(auth.uid()) 
  OR (get_user_role(auth.uid()) = 'admin'::app_role) 
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status]))) 
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = 'pendiente'::requisition_status)) 
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status)) 
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid()) 
  OR (get_user_role(auth.uid()) = 'admin'::app_role) 
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status]))) 
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status]))) 
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status]))) 
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_autorizado'::requisition_status)) 
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_pagado'::requisition_status))
);