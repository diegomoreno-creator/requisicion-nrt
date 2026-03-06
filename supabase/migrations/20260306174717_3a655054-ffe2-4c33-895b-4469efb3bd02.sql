
-- Table for custody delivery records (Carta Responsiva de Resguardo)
CREATE TABLE public.entregas_resguardo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicion_id UUID NOT NULL REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  folio_orden_compra TEXT NOT NULL,
  fecha_orden_compra DATE,
  periodo_supervision TEXT,
  ubicacion TEXT DEFAULT 'Monclova, Coahuila de Zaragoza, México',
  entregado_por UUID NOT NULL,
  recibido_por_nombre TEXT NOT NULL,
  recibido_por_fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  firma_recibido_url TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for items in the delivery
CREATE TABLE public.entrega_resguardo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entrega_resguardo_id UUID NOT NULL REFERENCES public.entregas_resguardo(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 1,
  descripcion TEXT NOT NULL,
  numero_serie TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entregas_resguardo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrega_resguardo_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entregas_resguardo
CREATE POLICY "Almacen users can insert entregas_resguardo"
ON public.entregas_resguardo FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()));

CREATE POLICY "Almacen users can view entregas_resguardo"
ON public.entregas_resguardo FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()) OR can_view_requisicion(auth.uid(), requisicion_id));

CREATE POLICY "Superadmins can delete entregas_resguardo"
ON public.entregas_resguardo FOR DELETE TO authenticated
USING (is_superadmin(auth.uid()));

-- RLS Policies for entrega_resguardo_items
CREATE POLICY "Users can insert entrega_resguardo_items"
ON public.entrega_resguardo_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.entregas_resguardo er
  WHERE er.id = entrega_resguardo_items.entrega_resguardo_id
  AND (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()))
));

CREATE POLICY "Users can view entrega_resguardo_items"
ON public.entrega_resguardo_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.entregas_resguardo er
  WHERE er.id = entrega_resguardo_items.entrega_resguardo_id
  AND (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()) OR can_view_requisicion(auth.uid(), er.requisicion_id))
));

CREATE POLICY "Superadmins can delete entrega_resguardo_items"
ON public.entrega_resguardo_items FOR DELETE TO authenticated
USING (is_superadmin(auth.uid()));
