-- Add empresa_id to unidades_negocio to create the relationship
ALTER TABLE public.catalogo_unidades_negocio 
ADD COLUMN empresa_id uuid REFERENCES public.catalogo_empresas(id) ON DELETE CASCADE;