-- Add columns to track who processed each phase of the workflow
ALTER TABLE public.requisiciones 
ADD COLUMN IF NOT EXISTS autorizado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_autorizacion_real timestamp with time zone,
ADD COLUMN IF NOT EXISTS licitado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_licitacion timestamp with time zone,
ADD COLUMN IF NOT EXISTS pedido_colocado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_pedido_colocado timestamp with time zone,
ADD COLUMN IF NOT EXISTS pedido_autorizado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_pedido_autorizado timestamp with time zone,
ADD COLUMN IF NOT EXISTS pagado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_pago timestamp with time zone;

-- Add similar tracking columns to reposiciones
ALTER TABLE public.reposiciones
ADD COLUMN IF NOT EXISTS autorizado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_autorizacion timestamp with time zone,
ADD COLUMN IF NOT EXISTS pagado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_pago timestamp with time zone;

-- Update the RLS SELECT policy to allow users to see requisitions they have processed
DROP POLICY IF EXISTS "Users can view requisitions based on role" ON public.requisiciones;

CREATE POLICY "Users can view requisitions based on role" 
ON public.requisiciones 
FOR SELECT 
USING (
  can_view_requisicion(auth.uid(), id)
  OR autorizado_por = auth.uid()
  OR licitado_por = auth.uid()
  OR pedido_colocado_por = auth.uid()
  OR pedido_autorizado_por = auth.uid()
  OR pagado_por = auth.uid()
);

-- Update the RLS SELECT policy for reposiciones to include processed items
DROP POLICY IF EXISTS "Users can view their own reposiciones" ON public.reposiciones;

CREATE POLICY "Users can view their own reposiciones" 
ON public.reposiciones 
FOR SELECT 
USING (
  (solicitado_por = auth.uid()) 
  OR (autorizador_id = auth.uid()) 
  OR is_superadmin(auth.uid()) 
  OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'comprador'::app_role]))
  OR autorizado_por = auth.uid()
  OR pagado_por = auth.uid()
);