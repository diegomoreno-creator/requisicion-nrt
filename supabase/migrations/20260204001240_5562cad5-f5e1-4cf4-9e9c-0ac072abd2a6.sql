-- Add sucursal column to requisicion_partidas table
ALTER TABLE public.requisicion_partidas 
ADD COLUMN sucursal text;

-- Add comment for documentation
COMMENT ON COLUMN public.requisicion_partidas.sucursal IS 'Sucursal donde se requiere esta partida';