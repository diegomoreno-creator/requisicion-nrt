-- Add apuntes_presupuesto column to requisiciones table
ALTER TABLE public.requisiciones 
ADD COLUMN apuntes_presupuesto text;