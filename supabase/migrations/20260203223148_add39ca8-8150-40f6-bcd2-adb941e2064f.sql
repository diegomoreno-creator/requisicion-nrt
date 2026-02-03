-- Add justificacion_rechazo column to reposiciones table
ALTER TABLE public.reposiciones 
ADD COLUMN IF NOT EXISTS justificacion_rechazo TEXT;