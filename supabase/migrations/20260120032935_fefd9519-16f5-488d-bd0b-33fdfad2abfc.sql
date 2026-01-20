-- Create a security definer function to get requester info for requisitions/reposiciones
CREATE OR REPLACE FUNCTION public.get_solicitante_info(_user_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.email, p.full_name
  FROM public.profiles p
  WHERE p.user_id = _user_id;
$$;