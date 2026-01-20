
-- Add column to store the estado when the comment was made
ALTER TABLE public.requisicion_texto_compras_historial 
ADD COLUMN IF NOT EXISTS estado_al_comentar text;

-- Create function to get user role as text
CREATE OR REPLACE FUNCTION public.get_user_role_text(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;
