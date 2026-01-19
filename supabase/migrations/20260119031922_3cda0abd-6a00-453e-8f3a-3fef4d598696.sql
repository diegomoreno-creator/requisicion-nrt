-- Drop and recreate the UPDATE policy for requisiciones to include autorizador
DROP POLICY IF EXISTS "Users can update their own draft requisitions" ON public.requisiciones;

CREATE POLICY "Users can update requisitions based on role"
  ON public.requisiciones FOR UPDATE
  USING (
    -- Owner can update their own drafts
    ((solicitado_por = auth.uid()) AND (estado = 'borrador'::requisition_status))
    -- Superadmin can update any
    OR is_superadmin(auth.uid())
    -- Admin, comprador can update any
    OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'comprador'::app_role]))
    -- Autorizador can update requisitions assigned to them (to approve/reject)
    OR ((get_user_role(auth.uid()) = 'autorizador'::app_role) AND (autorizador_id = auth.uid()))
  );