-- Add apuntes_tesoreria column to requisiciones table
ALTER TABLE public.requisiciones 
ADD COLUMN apuntes_tesoreria text;

-- Update RLS policy to allow tesoreria to update while in pedido_autorizado (for apuntes)
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role"
ON public.requisiciones
FOR UPDATE
USING (
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  OR is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);