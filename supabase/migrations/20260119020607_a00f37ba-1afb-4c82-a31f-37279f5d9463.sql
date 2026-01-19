-- Create table for tipos de requisicion
CREATE TABLE public.catalogo_tipos_requisicion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  color_class TEXT NOT NULL DEFAULT 'bg-yellow-500',
  color_hsl TEXT NOT NULL DEFAULT '48 96% 53%',
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for unidades de negocio
CREATE TABLE public.catalogo_unidades_negocio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for empresas
CREATE TABLE public.catalogo_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for sucursales
CREATE TABLE public.catalogo_sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all catalog tables
ALTER TABLE public.catalogo_tipos_requisicion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_unidades_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_sucursales ENABLE ROW LEVEL SECURITY;

-- Everyone can read catalogs (for dropdowns)
CREATE POLICY "Anyone can read tipos requisicion" ON public.catalogo_tipos_requisicion FOR SELECT USING (true);
CREATE POLICY "Anyone can read unidades negocio" ON public.catalogo_unidades_negocio FOR SELECT USING (true);
CREATE POLICY "Anyone can read empresas" ON public.catalogo_empresas FOR SELECT USING (true);
CREATE POLICY "Anyone can read sucursales" ON public.catalogo_sucursales FOR SELECT USING (true);

-- Only superadmin can modify catalogs
CREATE POLICY "Superadmin can insert tipos requisicion" ON public.catalogo_tipos_requisicion FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update tipos requisicion" ON public.catalogo_tipos_requisicion FOR UPDATE USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete tipos requisicion" ON public.catalogo_tipos_requisicion FOR DELETE USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can insert unidades negocio" ON public.catalogo_unidades_negocio FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update unidades negocio" ON public.catalogo_unidades_negocio FOR UPDATE USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete unidades negocio" ON public.catalogo_unidades_negocio FOR DELETE USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can insert empresas" ON public.catalogo_empresas FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update empresas" ON public.catalogo_empresas FOR UPDATE USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete empresas" ON public.catalogo_empresas FOR DELETE USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can insert sucursales" ON public.catalogo_sucursales FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update sucursales" ON public.catalogo_sucursales FOR UPDATE USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete sucursales" ON public.catalogo_sucursales FOR DELETE USING (public.is_superadmin(auth.uid()));

-- Insert default data for tipos requisicion
INSERT INTO public.catalogo_tipos_requisicion (nombre, color_class, color_hsl, orden) VALUES
('Requisición general', 'bg-primary', '355 100% 67%', 1),
('Emergencia', 'bg-orange-500', '25 95% 53%', 2),
('Servicios Públicos', 'bg-yellow-500', '48 96% 53%', 3),
('Servicios Profesionales', 'bg-yellow-500', '48 96% 53%', 4),
('Servicios de Construcción', 'bg-yellow-500', '48 96% 53%', 5),
('Proyecto', 'bg-yellow-500', '48 96% 53%', 6),
('Finiquito', 'bg-yellow-500', '48 96% 53%', 7),
('Parque Vehicular', 'bg-yellow-500', '48 96% 53%', 8),
('Préstamo colaborador', 'bg-yellow-500', '48 96% 53%', 9),
('Viáticos', 'bg-yellow-500', '48 96% 53%', 10),
('Señales', 'bg-blue-500', '217 91% 60%', 11);

-- Insert default data for unidades de negocio
INSERT INTO public.catalogo_unidades_negocio (nombre, orden) VALUES
('Corporativo', 1),
('Comercial', 2),
('Industrial', 3),
('Residencial', 4);

-- Insert default data for empresas
INSERT INTO public.catalogo_empresas (nombre, orden) VALUES
('NRT México', 1),
('NRT Servicios', 2),
('NRT Comercial', 3);

-- Insert default data for sucursales
INSERT INTO public.catalogo_sucursales (nombre, orden) VALUES
('CDMX', 1),
('Monterrey', 2),
('Guadalajara', 3),
('Querétaro', 4);