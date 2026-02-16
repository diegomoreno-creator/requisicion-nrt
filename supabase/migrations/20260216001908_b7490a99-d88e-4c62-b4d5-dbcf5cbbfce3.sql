
-- Step 1: Add new enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'revision';
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'pendiente_revision' BEFORE 'pendiente';
