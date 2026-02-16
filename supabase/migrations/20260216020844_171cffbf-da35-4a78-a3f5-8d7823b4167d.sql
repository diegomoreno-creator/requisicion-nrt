-- Add default_role column to catalogo_departamentos
ALTER TABLE public.catalogo_departamentos 
ADD COLUMN default_role text NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.catalogo_departamentos.default_role IS 'Default app_role to assign to users placed in this department (e.g. solicitador, autorizador)';