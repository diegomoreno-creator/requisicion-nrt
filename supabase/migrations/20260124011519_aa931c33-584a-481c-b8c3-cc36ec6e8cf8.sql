-- Add costo_estimado column to requisicion_partidas table
ALTER TABLE public.requisicion_partidas 
ADD COLUMN IF NOT EXISTS costo_estimado NUMERIC(12, 2) NULL;