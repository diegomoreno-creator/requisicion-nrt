-- Create catalogo_departamentos table
CREATE TABLE public.catalogo_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  empresa_id uuid REFERENCES public.catalogo_empresas(id) ON DELETE CASCADE,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalogo_departamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read departamentos"
  ON public.catalogo_departamentos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Superadmin can insert departamentos"
  ON public.catalogo_departamentos FOR INSERT
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can update departamentos"
  ON public.catalogo_departamentos FOR UPDATE
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can delete departamentos"
  ON public.catalogo_departamentos FOR DELETE
  USING (is_superadmin(auth.uid()));

-- Seed Fibranet departments
INSERT INTO public.catalogo_departamentos (nombre, empresa_id, orden) VALUES
  ('Comercial',         'e1000001-0000-0000-0000-000000000005', 1),
  ('Operaciones',       'e1000001-0000-0000-0000-000000000005', 2),
  ('Mercadotecnia',     'e1000001-0000-0000-0000-000000000005', 3),
  ('Project Manager',   'e1000001-0000-0000-0000-000000000005', 4),
  ('Planta Externa',    'e1000001-0000-0000-0000-000000000005', 5),
  ('Recursos Humanos',  'e1000001-0000-0000-0000-000000000005', 6),
  ('Administración',    'e1000001-0000-0000-0000-000000000005', 7),
  ('Dirección',         'e1000001-0000-0000-0000-000000000005', 8);