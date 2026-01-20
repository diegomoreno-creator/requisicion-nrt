-- Add tipo_gasto column to requisicion_partidas table
ALTER TABLE public.requisicion_partidas
ADD COLUMN tipo_gasto text;