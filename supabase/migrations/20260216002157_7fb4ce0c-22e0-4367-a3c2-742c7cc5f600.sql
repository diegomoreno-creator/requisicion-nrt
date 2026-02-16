
-- Create function to get users with 'revision' role (similar to get_autorizadores)
CREATE OR REPLACE FUNCTION public.get_revisores()
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.user_id, p.email, p.full_name
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.role = 'revision'
  ORDER BY p.full_name, p.email;
$$;
