
-- Create user_permissions table for granular feature access control
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Superadmins can manage all permissions
CREATE POLICY "Superadmins can view all permissions"
ON public.user_permissions FOR SELECT
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert permissions"
ON public.user_permissions FOR INSERT
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete permissions"
ON public.user_permissions FOR DELETE
USING (is_superadmin(auth.uid()));

-- Users can view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions(permission);

-- Security definer function to check permissions without recursion
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission = _permission
  )
$$;
