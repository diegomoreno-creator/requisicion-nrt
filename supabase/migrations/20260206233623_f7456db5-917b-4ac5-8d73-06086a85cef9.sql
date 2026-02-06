
-- Add currency column to requisiciones
ALTER TABLE public.requisiciones ADD COLUMN moneda_compra TEXT DEFAULT 'MXN';
