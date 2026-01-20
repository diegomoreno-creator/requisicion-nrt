-- Add column for bidding notes (apuntes de licitación)
ALTER TABLE public.requisiciones 
ADD COLUMN IF NOT EXISTS apuntes_licitacion text;