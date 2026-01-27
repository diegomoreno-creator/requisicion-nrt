-- Remove public (unauthenticated) access policies from catalog tables
-- Keep only the authenticated user policies

-- Drop public access policies
DROP POLICY IF EXISTS "Anyone can read tipos requisicion" ON catalogo_tipos_requisicion;
DROP POLICY IF EXISTS "Anyone can read unidades negocio" ON catalogo_unidades_negocio;

-- Add authenticated-only policies for empresas and sucursales if they don't exist
-- (catalogo_tipos_requisicion and catalogo_unidades_negocio already have "Authenticated users can read" policies)

-- Verify catalogo_empresas has authenticated policy (it already does per the schema)
-- Verify catalogo_sucursales has authenticated policy (it already does per the schema)