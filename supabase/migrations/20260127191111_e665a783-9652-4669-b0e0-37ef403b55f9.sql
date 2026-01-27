-- Fix RLS policies to use has_role() instead of get_user_role()
-- This allows users with multiple roles (e.g., solicitador + autorizador) to work correctly

-- Fix reposiciones policy
DROP POLICY IF EXISTS "Users can update reposiciones based on role" ON reposiciones;

CREATE POLICY "Users can update reposiciones based on role" ON reposiciones
FOR UPDATE
USING (
  -- Owner can update their own pending reposiciones
  ((solicitado_por = auth.uid()) AND (estado = 'pendiente'))
  -- Superadmin can update anything
  OR is_superadmin(auth.uid())
  -- Admin can update anything
  OR has_role(auth.uid(), 'admin')
  -- Comprador can update
  OR has_role(auth.uid(), 'comprador')
  -- Autorizador assigned to this reposicion can update
  OR (has_role(auth.uid(), 'autorizador') AND (autorizador_id = auth.uid()))
)
WITH CHECK (
  -- Superadmin can set any state
  is_superadmin(auth.uid())
  -- Admin can set any state
  OR has_role(auth.uid(), 'admin')
  -- Owner can set to pendiente or cancelado
  OR ((solicitado_por = auth.uid()) AND (estado IN ('pendiente', 'cancelado')))
  -- Autorizador can approve (aprobado), reject (rechazado), or revert to pendiente
  OR (has_role(auth.uid(), 'autorizador') AND (autorizador_id = auth.uid()) AND (estado IN ('aprobado', 'rechazado', 'pendiente')))
  -- Comprador can mark as pagado
  OR (has_role(auth.uid(), 'comprador') AND (estado IN ('aprobado', 'pagado', 'pendiente')))
);

-- Fix requisiciones policy
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON requisiciones;

CREATE POLICY "Users can update requisitions based on role" ON requisiciones
FOR UPDATE
USING (
  -- Owner can update their own pending or rejected requisitions
  ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  -- Superadmin can update anything
  OR is_superadmin(auth.uid())
  -- Admin can update anything
  OR has_role(auth.uid(), 'admin')
  -- Comprador can update approved or en_licitacion
  OR (has_role(auth.uid(), 'comprador') AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status])))
  -- Autorizador assigned can update pending or rejected
  OR (has_role(auth.uid(), 'autorizador') AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status])))
  -- Autorizador can handle budget rejections
  OR (has_role(auth.uid(), 'autorizador') AND (autorizador_id = auth.uid()) AND (estado = 'pedido_colocado'::requisition_status) AND (justificacion_rechazo_presupuestos IS NOT NULL))
  -- Presupuestos can update pedido_colocado
  OR (has_role(auth.uid(), 'presupuestos') AND (estado = 'pedido_colocado'::requisition_status))
  -- Tesoreria can update pedido_autorizado
  OR (has_role(auth.uid(), 'tesoreria') AND (estado = 'pedido_autorizado'::requisition_status))
)
WITH CHECK (
  -- Superadmin can set any state
  is_superadmin(auth.uid())
  -- Admin can set any state
  OR has_role(auth.uid(), 'admin')
  -- Owner can set to pendiente, cancelado, or aprobado (resubmit)
  OR ((solicitado_por = auth.uid()) AND (estado = ANY (ARRAY['pendiente'::requisition_status, 'cancelado'::requisition_status, 'aprobado'::requisition_status])))
  -- Autorizador can approve, reject, revert, or forward
  OR (has_role(auth.uid(), 'autorizador') AND (autorizador_id = auth.uid()) AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'rechazado'::requisition_status, 'pendiente'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status])))
  -- Comprador can set various workflow states
  OR (has_role(auth.uid(), 'comprador') AND (estado = ANY (ARRAY['aprobado'::requisition_status, 'en_licitacion'::requisition_status, 'pedido_colocado'::requisition_status, 'pendiente'::requisition_status])))
  -- Presupuestos can authorize or reject
  OR (has_role(auth.uid(), 'presupuestos') AND (estado = ANY (ARRAY['pedido_colocado'::requisition_status, 'pedido_autorizado'::requisition_status])))
  -- Tesoreria can mark as paid
  OR (has_role(auth.uid(), 'tesoreria') AND (estado = ANY (ARRAY['pedido_autorizado'::requisition_status, 'pedido_pagado'::requisition_status])))
);