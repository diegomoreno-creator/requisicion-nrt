
-- Create proveedores catalog table
CREATE TABLE public.catalogo_proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  rfc text NULL,
  empresa_id uuid NULL REFERENCES public.catalogo_empresas(id),
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalogo_proveedores ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users
CREATE POLICY "Authenticated users can read proveedores"
ON public.catalogo_proveedores FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Superadmin full access
CREATE POLICY "Superadmin can insert proveedores"
ON public.catalogo_proveedores FOR INSERT
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can update proveedores"
ON public.catalogo_proveedores FOR UPDATE
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can delete proveedores"
ON public.catalogo_proveedores FOR DELETE
USING (is_superadmin(auth.uid()));

-- Admin scoped to their empresa
CREATE POLICY "Admin can insert proveedores of their empresa"
ON public.catalogo_proveedores FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'gestionar_catalogos')
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can update proveedores of their empresa"
ON public.catalogo_proveedores FOR UPDATE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos')
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can delete proveedores of their empresa"
ON public.catalogo_proveedores FOR DELETE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos')
  AND empresa_id = get_user_empresa_id(auth.uid())
);
