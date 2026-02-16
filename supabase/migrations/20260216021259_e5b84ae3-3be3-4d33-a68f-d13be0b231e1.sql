
-- Helper function: get user's empresa_id from profile
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Allow admins with gestionar_catalogos permission to manage unidades_negocio of their company
CREATE POLICY "Admin can insert unidades of their empresa"
ON public.catalogo_unidades_negocio
FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can update unidades of their empresa"
ON public.catalogo_unidades_negocio
FOR UPDATE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can delete unidades of their empresa"
ON public.catalogo_unidades_negocio
FOR DELETE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

-- Allow admins with gestionar_catalogos permission to manage departamentos of their company
CREATE POLICY "Admin can insert departamentos of their empresa"
ON public.catalogo_departamentos
FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can update departamentos of their empresa"
ON public.catalogo_departamentos
FOR UPDATE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);

CREATE POLICY "Admin can delete departamentos of their empresa"
ON public.catalogo_departamentos
FOR DELETE
USING (
  has_permission(auth.uid(), 'gestionar_catalogos') 
  AND empresa_id = get_user_empresa_id(auth.uid())
);
