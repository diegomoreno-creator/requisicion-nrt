-- Create suggestions table
CREATE TABLE public.sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  contenido TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'terminada')),
  justificacion_rechazo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

-- Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.sugerencias
FOR SELECT
USING (auth.uid() = user_id);

-- Superadmins can view all suggestions
CREATE POLICY "Superadmins can view all suggestions"
ON public.sugerencias
FOR SELECT
USING (is_superadmin(auth.uid()));

-- Users can create their own suggestions
CREATE POLICY "Users can create suggestions"
ON public.sugerencias
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Superadmins can update any suggestion
CREATE POLICY "Superadmins can update suggestions"
ON public.sugerencias
FOR UPDATE
USING (is_superadmin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_sugerencias_updated_at
BEFORE UPDATE ON public.sugerencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();