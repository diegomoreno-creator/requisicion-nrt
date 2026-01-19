-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'presupuestos';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tesoreria';

-- Add new statuses to the requisition_status enum
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'pedido_colocado';
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'pedido_autorizado';
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'pedido_pagado';