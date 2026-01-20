-- Add apuntes_compras column for Comprador notes
ALTER TABLE public.requisiciones
ADD COLUMN IF NOT EXISTS apuntes_compras TEXT;