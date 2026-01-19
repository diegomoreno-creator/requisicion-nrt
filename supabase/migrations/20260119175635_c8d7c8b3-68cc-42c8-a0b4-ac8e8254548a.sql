-- Fix catalog tables: require authentication for SELECT (not public access)
-- Drop existing public SELECT policies and create authenticated-only policies

-- catalogo_empresas
DROP POLICY IF EXISTS "Anyone can read empresas" ON public.catalogo_empresas;
CREATE POLICY "Authenticated users can read empresas" 
ON public.catalogo_empresas FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- catalogo_sucursales
DROP POLICY IF EXISTS "Anyone can read sucursales" ON public.catalogo_sucursales;
CREATE POLICY "Authenticated users can read sucursales" 
ON public.catalogo_sucursales FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- catalogo_tipos_requisicion
DROP POLICY IF EXISTS "Anyone can read tipos" ON public.catalogo_tipos_requisicion;
CREATE POLICY "Authenticated users can read tipos" 
ON public.catalogo_tipos_requisicion FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- catalogo_unidades_negocio
DROP POLICY IF EXISTS "Anyone can read unidades" ON public.catalogo_unidades_negocio;
CREATE POLICY "Authenticated users can read unidades" 
ON public.catalogo_unidades_negocio FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);