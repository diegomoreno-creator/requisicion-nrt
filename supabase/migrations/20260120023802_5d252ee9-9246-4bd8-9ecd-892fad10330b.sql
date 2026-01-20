-- Add a separate column for rejection justification
ALTER TABLE public.requisiciones 
ADD COLUMN justificacion_rechazo text DEFAULT NULL;