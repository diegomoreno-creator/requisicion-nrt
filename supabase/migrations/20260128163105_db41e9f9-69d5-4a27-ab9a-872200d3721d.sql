-- Add new roles for Contabilidad module
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contabilidad_gastos';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contabilidad_ingresos';