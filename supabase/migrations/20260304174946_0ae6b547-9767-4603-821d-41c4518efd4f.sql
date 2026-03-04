
-- Fix requisicion_partidas DELETE policy: add pendiente_revision
DROP POLICY IF EXISTS "Users can delete partidas of their requisitions" ON public.requisicion_partidas;
CREATE POLICY "Users can delete partidas of their requisitions"
ON public.requisicion_partidas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_partidas.requisicion_id
      AND r.solicitado_por = auth.uid()
      AND r.estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status])
  )
);

-- Fix requisicion_partidas UPDATE policy: add pendiente_revision
DROP POLICY IF EXISTS "Users can update partidas of their requisitions" ON public.requisicion_partidas;
CREATE POLICY "Users can update partidas of their requisitions"
ON public.requisicion_partidas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_partidas.requisicion_id
      AND r.solicitado_por = auth.uid()
      AND r.estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status])
  )
);

-- Fix requisicion_archivos DELETE policy: add pendiente_revision
DROP POLICY IF EXISTS "Users can delete their own pending requisition files" ON public.requisicion_archivos;
CREATE POLICY "Users can delete their own pending requisition files"
ON public.requisicion_archivos
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_archivos.requisicion_id
      AND r.solicitado_por = auth.uid()
      AND r.estado = ANY (ARRAY['pendiente'::requisition_status, 'rechazado'::requisition_status, 'pendiente_revision'::requisition_status])
  )
);
