-- Allow superadmins to permanently delete requisiciones
CREATE POLICY "Superadmins can permanently delete requisiciones"
ON public.requisiciones
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Allow superadmins to permanently delete reposiciones
CREATE POLICY "Superadmins can permanently delete reposiciones"
ON public.reposiciones
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Allow cascade delete of requisicion_partidas when requisicion is deleted
CREATE POLICY "Superadmins can delete partidas for deletion"
ON public.requisicion_partidas
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Allow cascade delete of reposicion_gastos when reposicion is deleted  
CREATE POLICY "Superadmins can delete gastos for deletion"
ON public.reposicion_gastos
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Allow cascade delete of requisicion_texto_compras_historial
CREATE POLICY "Superadmins can delete historial for deletion"
ON public.requisicion_texto_compras_historial
FOR DELETE
USING (is_superadmin(auth.uid()));