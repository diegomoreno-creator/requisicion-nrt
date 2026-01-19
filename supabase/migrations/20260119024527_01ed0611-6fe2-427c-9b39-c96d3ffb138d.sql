-- Create table for reposiciones (expense reimbursements)
CREATE TABLE public.reposiciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
  solicitado_por UUID NOT NULL,
  gastos_semana NUMERIC DEFAULT 0,
  autorizador_id UUID,
  monto_total NUMERIC DEFAULT 0,
  tipo_reposicion TEXT NOT NULL DEFAULT 'gastos_semanales', -- 'gastos_semanales' or 'colaborador'
  banco TEXT,
  cuenta_clabe TEXT,
  reponer_a TEXT,
  justificacion TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for gastos (line items in reposicion)
CREATE TABLE public.reposicion_gastos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reposicion_id UUID NOT NULL REFERENCES public.reposiciones(id) ON DELETE CASCADE,
  unidad_negocio_id UUID,
  empresa_id UUID,
  descripcion TEXT,
  departamento TEXT,
  proveedor_negocio TEXT,
  fecha_gasto DATE,
  factura_no TEXT,
  importe NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reposiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposicion_gastos ENABLE ROW LEVEL SECURITY;

-- Policies for reposiciones
CREATE POLICY "Users can create their own reposiciones"
ON public.reposiciones
FOR INSERT
WITH CHECK (auth.uid() = solicitado_por);

CREATE POLICY "Users can view their own reposiciones"
ON public.reposiciones
FOR SELECT
USING (
  solicitado_por = auth.uid() 
  OR autorizador_id = auth.uid()
  OR is_superadmin(auth.uid())
  OR get_user_role(auth.uid()) IN ('admin', 'comprador')
);

CREATE POLICY "Users can update their own draft reposiciones"
ON public.reposiciones
FOR UPDATE
USING (
  (solicitado_por = auth.uid() AND estado = 'borrador')
  OR is_superadmin(auth.uid())
  OR get_user_role(auth.uid()) IN ('admin', 'comprador', 'autorizador')
);

-- Policies for reposicion_gastos
CREATE POLICY "Users can insert gastos to their reposiciones"
ON public.reposicion_gastos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reposiciones r
    WHERE r.id = reposicion_gastos.reposicion_id AND r.solicitado_por = auth.uid()
  )
);

CREATE POLICY "Users can view gastos of viewable reposiciones"
ON public.reposicion_gastos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reposiciones r
    WHERE r.id = reposicion_gastos.reposicion_id
    AND (
      r.solicitado_por = auth.uid()
      OR r.autorizador_id = auth.uid()
      OR is_superadmin(auth.uid())
      OR get_user_role(auth.uid()) IN ('admin', 'comprador')
    )
  )
);

CREATE POLICY "Users can update gastos of their draft reposiciones"
ON public.reposicion_gastos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.reposiciones r
    WHERE r.id = reposicion_gastos.reposicion_id 
    AND r.solicitado_por = auth.uid() 
    AND r.estado = 'borrador'
  )
);

CREATE POLICY "Users can delete gastos of their draft reposiciones"
ON public.reposicion_gastos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.reposiciones r
    WHERE r.id = reposicion_gastos.reposicion_id 
    AND r.solicitado_por = auth.uid() 
    AND r.estado = 'borrador'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_reposiciones_updated_at
BEFORE UPDATE ON public.reposiciones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();