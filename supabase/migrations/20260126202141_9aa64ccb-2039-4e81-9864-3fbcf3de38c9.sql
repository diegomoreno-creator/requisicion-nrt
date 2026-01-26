
-- Drop the existing UPDATE policy for reposiciones
DROP POLICY IF EXISTS "Users can update their own pending reposiciones" ON public.reposiciones;

-- Create a new UPDATE policy with proper WITH CHECK clause
CREATE POLICY "Users can update their own pending reposiciones"
ON public.reposiciones
FOR UPDATE
USING (
  -- Who can initiate an update
  (solicitado_por = auth.uid() AND estado = 'pendiente')
  OR is_superadmin(auth.uid())
  OR get_user_role(auth.uid()) IN ('admin', 'comprador', 'autorizador')
)
WITH CHECK (
  -- What states are valid after update
  is_superadmin(auth.uid())
  OR get_user_role(auth.uid()) = 'admin'
  -- Solicitador can only cancel their pending items
  OR (solicitado_por = auth.uid() AND estado IN ('pendiente', 'cancelado'))
  -- Autorizador can approve, reject, or revert to pending
  OR (get_user_role(auth.uid()) = 'autorizador' AND estado IN ('aprobado', 'rechazado', 'pendiente', 'pagado'))
  -- Comprador can update approved items
  OR (get_user_role(auth.uid()) = 'comprador' AND estado IN ('aprobado', 'pagado', 'pendiente'))
);
