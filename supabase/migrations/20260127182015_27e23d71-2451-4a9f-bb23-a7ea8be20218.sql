-- Fix RLS policy for reposiciones to allow authorizers to properly approve
-- The issue is the WITH CHECK clause doesn't account for the autorizado_por field being set

DROP POLICY IF EXISTS "Users can update their own pending reposiciones" ON reposiciones;

CREATE POLICY "Users can update reposiciones based on role" ON reposiciones
FOR UPDATE
USING (
  -- Owner can update their own pending reposiciones
  ((solicitado_por = auth.uid()) AND (estado = 'pendiente'))
  -- Superadmin can update anything
  OR is_superadmin(auth.uid())
  -- Admin can update anything
  OR (get_user_role(auth.uid()) = 'admin')
  -- Comprador can update
  OR (get_user_role(auth.uid()) = 'comprador')
  -- Autorizador assigned to this reposicion can update
  OR ((get_user_role(auth.uid()) = 'autorizador') AND (autorizador_id = auth.uid()))
)
WITH CHECK (
  -- Superadmin can set any state
  is_superadmin(auth.uid())
  -- Admin can set any state
  OR (get_user_role(auth.uid()) = 'admin')
  -- Owner can set to pendiente or cancelado
  OR ((solicitado_por = auth.uid()) AND (estado IN ('pendiente', 'cancelado')))
  -- Autorizador can approve (aprobado), reject (rechazado), or revert to pendiente
  OR ((get_user_role(auth.uid()) = 'autorizador') AND (autorizador_id = auth.uid()) AND (estado IN ('aprobado', 'rechazado', 'pendiente')))
  -- Comprador can mark as pagado
  OR ((get_user_role(auth.uid()) = 'comprador') AND (estado IN ('aprobado', 'pagado', 'pendiente')))
);