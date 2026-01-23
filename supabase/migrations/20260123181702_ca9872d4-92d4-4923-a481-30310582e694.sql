-- Fix superadmin push panel access
-- 1) Allow superadmins to read all profiles (needed to list users)
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
CREATE POLICY "Superadmins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_superadmin(auth.uid()));

-- 2) Tighten push_subscriptions visibility (remove public read) and allow superadmin management
DROP POLICY IF EXISTS "Service can read all subscriptions" ON public.push_subscriptions;

DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Superadmins can view all subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can delete any subscriptions" ON public.push_subscriptions;
CREATE POLICY "Superadmins can delete any subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (is_superadmin(auth.uid()));
