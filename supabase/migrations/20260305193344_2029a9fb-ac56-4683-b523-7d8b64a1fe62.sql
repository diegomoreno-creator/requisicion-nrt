
-- Table for expense types (tipos de gasto)
CREATE TABLE public.catalogo_tipos_gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  clave text NOT NULL UNIQUE,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table for expense categories (categorías de gasto) linked to tipos
CREATE TABLE public.catalogo_categorias_gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_gasto_id uuid NOT NULL REFERENCES public.catalogo_tipos_gasto(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalogo_tipos_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_categorias_gasto ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated can read
CREATE POLICY "Authenticated users can read tipos_gasto" ON public.catalogo_tipos_gasto FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read categorias_gasto" ON public.catalogo_categorias_gasto FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS: Superadmin CRUD
CREATE POLICY "Superadmin can insert tipos_gasto" ON public.catalogo_tipos_gasto FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update tipos_gasto" ON public.catalogo_tipos_gasto FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete tipos_gasto" ON public.catalogo_tipos_gasto FOR DELETE USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can insert categorias_gasto" ON public.catalogo_categorias_gasto FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can update categorias_gasto" ON public.catalogo_categorias_gasto FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin can delete categorias_gasto" ON public.catalogo_categorias_gasto FOR DELETE USING (is_superadmin(auth.uid()));

-- Seed existing data
INSERT INTO public.catalogo_tipos_gasto (nombre, clave, orden) VALUES
  ('Administrativo', 'administrativo', 1),
  ('Operativo', 'operativo', 2),
  ('Proyecto de Inversión', 'proyecto_inversion', 3);

-- Seed categories for Administrativo
INSERT INTO public.catalogo_categorias_gasto (tipo_gasto_id, nombre, orden)
SELECT t.id, c.nombre, c.orden
FROM public.catalogo_tipos_gasto t,
(VALUES
  ('Arreglos, festejos y festividades', 1),
  ('Arrendamiento de equipo de oficina', 2),
  ('Asesorías, cursos y capacitación no técnica', 3),
  ('Papelería y consumibles', 4),
  ('Cuotas y suscripciones', 5),
  ('Gastos de oficina', 6),
  ('Impuestos y derechos', 7),
  ('Licenciamiento administrativo', 8),
  ('Servicios y renta de línea', 9),
  ('Mantenimiento y conservación', 10),
  ('Servicios y líneas de celular', 11),
  ('Pagos trámites administrativos', 12),
  ('Préstamos', 13),
  ('Productos de limpieza', 14),
  ('Renta de oficinas', 15),
  ('Seguros y pólizas', 16),
  ('Uniformes', 17),
  ('Viáticos', 18)
) AS c(nombre, orden)
WHERE t.clave = 'administrativo';

-- Seed categories for Operativo
INSERT INTO public.catalogo_categorias_gasto (tipo_gasto_id, nombre, orden)
SELECT t.id, c.nombre, c.orden
FROM public.catalogo_tipos_gasto t,
(VALUES
  ('Arrendamiento de espacio o infraestructura', 1),
  ('Capacitación técnica', 2),
  ('CFE, fuentes, postería', 3),
  ('Comisiones de operación', 4),
  ('Consultoría técnica', 5),
  ('Coubicación', 6),
  ('Desarrollo de software', 7),
  ('Equipo para la operación', 8),
  ('Equipos terminales', 9),
  ('Gastos relacionados con equipo de transporte', 10),
  ('Herramientas', 11),
  ('Licenciamiento operativo', 12),
  ('Material de instalación', 13),
  ('Operación de canal/radio', 14),
  ('Otros gastos operativos', 15),
  ('Pagos a ei!', 16),
  ('Pagos a Optifibra', 17),
  ('Publicidad', 18),
  ('Señales', 19),
  ('Servicios de internet', 20),
  ('Soporte técnico, Hosting', 21),
  ('Starlink', 22)
) AS c(nombre, orden)
WHERE t.clave = 'operativo';

-- Seed categories for Proyecto de Inversión
INSERT INTO public.catalogo_categorias_gasto (tipo_gasto_id, nombre, orden)
SELECT t.id, c.nombre, c.orden
FROM public.catalogo_tipos_gasto t,
(VALUES
  ('Celulares', 1),
  ('Construcción', 2),
  ('Equipo de cómputo', 3),
  ('Equipo de oficina', 4),
  ('Equipo de transporte', 5),
  ('Fibra óptica', 6),
  ('Infraestructura de red', 7),
  ('Licencias de software', 8),
  ('Maquinaria y equipo', 9),
  ('Mobiliario', 10),
  ('Otros activos fijos', 11)
) AS c(nombre, orden)
WHERE t.clave = 'proyecto_inversion';
