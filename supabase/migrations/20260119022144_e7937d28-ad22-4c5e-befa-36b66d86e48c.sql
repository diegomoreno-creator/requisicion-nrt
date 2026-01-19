-- Add 'autorizador' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'autorizador';

-- Remove unique constraint on user_id if exists to allow multiple roles per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;