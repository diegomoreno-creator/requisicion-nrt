-- Agregar columnas para el rechazo de presupuestos
ALTER TABLE public.requisiciones
ADD COLUMN justificacion_rechazo_presupuestos TEXT,
ADD COLUMN rechazado_por_presupuestos_id UUID,
ADD COLUMN rechazado_por_presupuestos_nombre TEXT,
ADD COLUMN rechazado_por_presupuestos_rol TEXT,
ADD COLUMN fecha_rechazo_presupuestos TIMESTAMP WITH TIME ZONE;