-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create requisitions" ON public.requisiciones;

-- Create a new PERMISSIVE policy for INSERT
CREATE POLICY "Users can create requisitions" 
ON public.requisiciones 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = solicitado_por);