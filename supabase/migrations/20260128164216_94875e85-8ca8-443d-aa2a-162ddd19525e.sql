-- Create table for contabilidad gastos entries
CREATE TABLE public.contabilidad_gastos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- User and context
  usuario_id UUID NOT NULL,
  sucursal TEXT NOT NULL,
  mes_operacion TEXT NOT NULL,
  nota TEXT,
  
  -- Provider info
  tipo_proveedor TEXT,
  rfc TEXT,
  nombre_proveedor TEXT,
  numero_cheque TEXT,
  
  -- Financial amounts
  importe_exento NUMERIC DEFAULT 0,
  importe_16 NUMERIC DEFAULT 0,
  iva_acred_16 NUMERIC DEFAULT 0,
  importe_8 NUMERIC DEFAULT 0,
  iva_acred_8 NUMERIC DEFAULT 0,
  sueldo NUMERIC DEFAULT 0,
  ispt NUMERIC DEFAULT 0,
  isr_ret_hono NUMERIC DEFAULT 0,
  isr_ret_arre NUMERIC DEFAULT 0,
  isr_ret_resico NUMERIC DEFAULT 0,
  iva_ret NUMERIC DEFAULT 0,
  iva_ret_extra NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.contabilidad_gastos ENABLE ROW LEVEL SECURITY;

-- Policy: Users with contabilidad_gastos role can view all entries
CREATE POLICY "Contabilidad gastos users can view entries"
ON public.contabilidad_gastos
FOR SELECT
USING (
  has_role(auth.uid(), 'contabilidad_gastos') OR 
  has_role(auth.uid(), 'superadmin')
);

-- Policy: Users with contabilidad_gastos role can insert their own entries
CREATE POLICY "Contabilidad gastos users can insert entries"
ON public.contabilidad_gastos
FOR INSERT
WITH CHECK (
  auth.uid() = usuario_id AND 
  (has_role(auth.uid(), 'contabilidad_gastos') OR has_role(auth.uid(), 'superadmin'))
);

-- Policy: Users can update their own entries
CREATE POLICY "Users can update their own gastos entries"
ON public.contabilidad_gastos
FOR UPDATE
USING (
  auth.uid() = usuario_id AND 
  (has_role(auth.uid(), 'contabilidad_gastos') OR has_role(auth.uid(), 'superadmin'))
);

-- Policy: Superadmins can delete entries
CREATE POLICY "Superadmins can delete gastos entries"
ON public.contabilidad_gastos
FOR DELETE
USING (has_role(auth.uid(), 'superadmin'));

-- Create trigger for updated_at
CREATE TRIGGER update_contabilidad_gastos_updated_at
BEFORE UPDATE ON public.contabilidad_gastos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();