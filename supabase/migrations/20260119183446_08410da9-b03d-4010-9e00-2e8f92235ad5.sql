-- Drop the existing policy and recreate with proper WITH CHECK clause
DROP POLICY IF EXISTS "Users can update requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role"
ON public.requisiciones
FOR UPDATE
USING (
  -- Solicitador can update their own pending requisitions
  ((solicitado_por = auth.uid()) AND (estado = 'pendiente'))
  -- Superadmin can update any
  OR is_superadmin(auth.uid())
  -- Admin can update any
  OR (get_user_role(auth.uid()) = 'admin')
  -- Comprador can update approved or in licitacion
  OR ((get_user_role(auth.uid()) = 'comprador') AND (estado IN ('aprobado', 'en_licitacion')))
  -- Autorizador can update requisitions assigned to them that are pending
  OR ((get_user_role(auth.uid()) = 'autorizador') AND (autorizador_id = auth.uid()) AND (estado = 'pendiente'))
  -- Presupuestos can update requisitions in pedido_colocado status
  OR ((get_user_role(auth.uid()) = 'presupuestos') AND (estado = 'pedido_colocado'))
  -- Tesoreria can update requisitions in pedido_autorizado status
  OR ((get_user_role(auth.uid()) = 'tesoreria') AND (estado = 'pedido_autorizado'))
)
WITH CHECK (
  -- Superadmin can do anything
  is_superadmin(auth.uid())
  -- Admin can do anything
  OR (get_user_role(auth.uid()) = 'admin')
  -- Solicitador can update their own pending requisitions (keeps them pending or cancels)
  OR ((solicitado_por = auth.uid()) AND (estado IN ('pendiente', 'cancelado')))
  -- Autorizador can approve/reject assigned requisitions
  OR ((get_user_role(auth.uid()) = 'autorizador') AND (autorizador_id = auth.uid()) AND (estado IN ('aprobado', 'rechazado', 'pendiente')))
  -- Comprador can move to licitacion or pedido_colocado
  OR ((get_user_role(auth.uid()) = 'comprador') AND (estado IN ('aprobado', 'en_licitacion', 'pedido_colocado')))
  -- Presupuestos can authorize pedido (move to pedido_autorizado)
  OR ((get_user_role(auth.uid()) = 'presupuestos') AND (estado = 'pedido_autorizado'))
  -- Tesoreria can mark as paid
  OR ((get_user_role(auth.uid()) = 'tesoreria') AND (estado = 'pedido_pagado'))
);