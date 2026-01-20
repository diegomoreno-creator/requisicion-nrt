-- Add categoria_gasto column to requisicion_partidas table
ALTER TABLE public.requisicion_partidas
ADD COLUMN categoria_gasto text;