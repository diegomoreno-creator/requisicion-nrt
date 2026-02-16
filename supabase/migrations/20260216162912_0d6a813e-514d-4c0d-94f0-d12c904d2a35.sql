
DROP FUNCTION public.get_autorizadores();

CREATE OR REPLACE FUNCTION public.get_autorizadores()
RETURNS TABLE(user_id uuid, email text, full_name text, empresa_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.email, p.full_name, p.empresa_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.role = 'autorizador'
  ORDER BY p.full_name, p.email;
$$;
