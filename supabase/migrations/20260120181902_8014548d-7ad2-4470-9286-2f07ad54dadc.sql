-- Update RLS policy to allow autorizador to keep pedido_colocado when clearing presupuestos rejection

DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role" 
ON public.requisiciones 
FOR UPDATE 
USING (
  -- Owner can update their own pending or rejected items
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  -- Superadmin and admin can update anything
  OR is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  -- Comprador can update approved or en_licitacion items
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  -- Autorizador can update pending items assigned to them OR items with presupuestos rejection where they are the assigned autorizador
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = 'pedido_colocado'::requisition_status) AND (justificacion_rechazo_presupuestos IS NOT NULL))
  -- Presupuestos can update pedido_colocado items
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = 'pedido_colocado'::requisition_status))
  -- Tesoreria can update pedido_autorizado items
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  is_superadmin(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin'::app_role)
  -- Owner transitions
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  -- Autorizador transitions (including keeping pedido_colocado when clearing presupuestos rejection)
  OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status])))
  -- Comprador transitions
  OR ((get_user_role(auth.uid()) = 'comprador'::app_role) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  -- Presupuestos transitions
  OR ((get_user_role(auth.uid()) = 'presupuestos'::app_role) AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  -- Tesoreria transitions
  OR ((get_user_role(auth.uid()) = 'tesoreria'::app_role) AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);