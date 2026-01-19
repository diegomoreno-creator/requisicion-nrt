-- Drop unique constraint on nombre if it exists
ALTER TABLE public.catalogo_unidades_negocio DROP CONSTRAINT IF EXISTS catalogo_unidades_negocio_nombre_key;