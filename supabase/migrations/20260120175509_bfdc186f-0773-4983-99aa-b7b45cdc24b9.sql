-- Eliminar políticas existentes y recrearlas correctamente
DROP POLICY IF EXISTS "Users can delete partidas of their requisitions" ON public.requisicion_partidas;
DROP POLICY IF EXISTS "Users can update partidas of their requisitions" ON public.requisicion_partidas;

-- Recrear política de DELETE para permitir pendiente y rechazado
CREATE POLICY "Users can delete partidas of their requisitions"
ON public.requisicion_partidas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_partidas.requisicion_id
    AND r.solicitado_por = auth.uid()
    AND r.estado IN ('pendiente'::requisition_status, 'rechazado'::requisition_status)
  )
);

-- Recrear política de UPDATE para permitir pendiente y rechazado
CREATE POLICY "Users can update partidas of their requisitions"
ON public.requisicion_partidas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_partidas.requisicion_id
    AND r.solicitado_por = auth.uid()
    AND r.estado IN ('pendiente'::requisition_status, 'rechazado'::requisition_status)
  )
);