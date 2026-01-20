
-- Add column for total purchase amount before placing order
ALTER TABLE public.requisiciones 
ADD COLUMN IF NOT EXISTS monto_total_compra numeric;
