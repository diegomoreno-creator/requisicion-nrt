-- Create requisition status enum
CREATE TYPE public.requisition_status AS ENUM ('borrador', 'pendiente', 'aprobado', 'rechazado', 'en_licitacion', 'completado');

-- Create requisitions table
CREATE TABLE public.requisiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  tipo_requisicion TEXT,
  unidad_negocio TEXT,
  empresa TEXT,
  fecha_autorizacion DATE,
  sucursal TEXT,
  autorizador_id UUID REFERENCES auth.users(id),
  departamento_solicitante TEXT,
  solicitado_por UUID REFERENCES auth.users(id) NOT NULL,
  presupuesto_aproximado DECIMAL(12,2),
  se_dividira_gasto BOOLEAN DEFAULT false,
  un_division_gasto TEXT,
  porcentaje_cada_un TEXT,
  datos_proveedor TEXT,
  datos_banco TEXT,
  nombre_proyecto TEXT,
  justificacion TEXT,
  estado requisition_status DEFAULT 'borrador',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requisition items (partidas) table
CREATE TABLE public.requisicion_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id UUID REFERENCES public.requisiciones(id) ON DELETE CASCADE NOT NULL,
  numero_partida INTEGER NOT NULL,
  descripcion TEXT,
  modelo_parte TEXT,
  unidad_medida TEXT,
  cantidad DECIMAL(10,2) DEFAULT 1,
  fecha_necesidad DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requisiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicion_partidas ENABLE ROW LEVEL SECURITY;

-- Function to check if user can view requisition based on role
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id UUID, _requisicion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  req_solicitante UUID;
  req_autorizador UUID;
  req_estado requisition_status;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = _user_id;
  SELECT solicitado_por, autorizador_id, estado INTO req_solicitante, req_autorizador, req_estado 
  FROM public.requisiciones WHERE id = _requisicion_id;
  
  -- Superadmin can view all
  IF user_role = 'superadmin' THEN RETURN true; END IF;
  
  -- Admin can view assigned or created
  IF user_role = 'admin' AND (req_solicitante = _user_id OR req_autorizador = _user_id) THEN RETURN true; END IF;
  
  -- Comprador can view created or approved
  IF user_role = 'comprador' AND (req_solicitante = _user_id OR req_estado = 'aprobado') THEN RETURN true; END IF;
  
  -- Solicitador can only view their own
  IF user_role = 'solicitador' AND req_solicitante = _user_id THEN RETURN true; END IF;
  
  RETURN false;
END;
$$;

-- RLS Policies for requisiciones
CREATE POLICY "Users can view requisitions based on role"
  ON public.requisiciones FOR SELECT
  USING (public.can_view_requisicion(auth.uid(), id));

CREATE POLICY "Users can create requisitions"
  ON public.requisiciones FOR INSERT
  WITH CHECK (auth.uid() = solicitado_por);

CREATE POLICY "Users can update their own draft requisitions"
  ON public.requisiciones FOR UPDATE
  USING (
    solicitado_por = auth.uid() AND estado = 'borrador'
    OR public.is_superadmin(auth.uid())
    OR (public.get_user_role(auth.uid()) IN ('admin', 'comprador'))
  );

-- RLS Policies for partidas
CREATE POLICY "Users can view partidas of viewable requisitions"
  ON public.requisicion_partidas FOR SELECT
  USING (public.can_view_requisicion(auth.uid(), requisicion_id));

CREATE POLICY "Users can insert partidas to their requisitions"
  ON public.requisicion_partidas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requisiciones r 
      WHERE r.id = requisicion_id 
      AND r.solicitado_por = auth.uid()
    )
  );

CREATE POLICY "Users can update partidas of their requisitions"
  ON public.requisicion_partidas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisiciones r 
      WHERE r.id = requisicion_id 
      AND r.solicitado_por = auth.uid()
      AND r.estado = 'borrador'
    )
  );

CREATE POLICY "Users can delete partidas of their requisitions"
  ON public.requisicion_partidas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisiciones r 
      WHERE r.id = requisicion_id 
      AND r.solicitado_por = auth.uid()
      AND r.estado = 'borrador'
    )
  );

-- Trigger for updating timestamps
CREATE TRIGGER update_requisiciones_updated_at
  BEFORE UPDATE ON public.requisiciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();