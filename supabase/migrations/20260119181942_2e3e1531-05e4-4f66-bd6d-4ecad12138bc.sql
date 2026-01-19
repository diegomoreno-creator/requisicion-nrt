-- Add 'cancelado' to requisition_status enum
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'cancelado';