
-- Add columns for purchasing notes with edit tracking
ALTER TABLE public.requisiciones 
ADD COLUMN IF NOT EXISTS texto_compras text,
ADD COLUMN IF NOT EXISTS texto_compras_editado_por uuid,
ADD COLUMN IF NOT EXISTS texto_compras_editado_at timestamp with time zone;

-- Create a function to get editor name for the purchasing text
CREATE OR REPLACE FUNCTION public.get_profile_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;
