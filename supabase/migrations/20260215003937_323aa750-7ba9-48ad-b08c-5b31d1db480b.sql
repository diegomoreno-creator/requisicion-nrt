
-- Add empresa_id to profiles (nullable, no default = no empresa assigned)
ALTER TABLE public.profiles ADD COLUMN empresa_id uuid REFERENCES public.catalogo_empresas(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_profiles_empresa_id ON public.profiles(empresa_id);
