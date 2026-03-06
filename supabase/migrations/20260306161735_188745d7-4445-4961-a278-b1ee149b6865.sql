
-- Add en_almacen to requisition_status enum
ALTER TYPE public.requisition_status ADD VALUE IF NOT EXISTS 'en_almacen' AFTER 'pedido_pagado';

-- Create entradas_almacen table (warehouse material entries)
CREATE TABLE public.entradas_almacen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id UUID NOT NULL REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT now(),
  recibido_por UUID NOT NULL,
  ubicacion_almacen TEXT,
  numero_remision TEXT,
  numero_guia TEXT,
  condicion_material TEXT DEFAULT 'bueno',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create entrada_almacen_partidas (per-partida quantities for partial deliveries)
CREATE TABLE public.entrada_almacen_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_almacen_id UUID NOT NULL REFERENCES public.entradas_almacen(id) ON DELETE CASCADE,
  partida_id UUID NOT NULL REFERENCES public.requisicion_partidas(id) ON DELETE CASCADE,
  cantidad_recibida NUMERIC NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create entrada_almacen_archivos (evidence photos)
CREATE TABLE public.entrada_almacen_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_almacen_id UUID NOT NULL REFERENCES public.entradas_almacen(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entradas_almacen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrada_almacen_partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrada_almacen_archivos ENABLE ROW LEVEL SECURITY;

-- RLS for entradas_almacen
CREATE POLICY "Almacen users can insert entries" ON public.entradas_almacen
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recibido_por AND (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid())));

CREATE POLICY "Almacen users can view entries" ON public.entradas_almacen
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()) OR can_view_requisicion(auth.uid(), requisicion_id));

CREATE POLICY "Almacen users can update their entries" ON public.entradas_almacen
  FOR UPDATE TO authenticated
  USING (recibido_por = auth.uid() AND (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid())));

CREATE POLICY "Superadmins can delete entries" ON public.entradas_almacen
  FOR DELETE TO authenticated
  USING (is_superadmin(auth.uid()));

-- RLS for entrada_almacen_partidas
CREATE POLICY "Users can insert partida entries" ON public.entrada_almacen_partidas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.entradas_almacen ea WHERE ea.id = entrada_almacen_id AND ea.recibido_por = auth.uid()
  ));

CREATE POLICY "Users can view partida entries" ON public.entrada_almacen_partidas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entradas_almacen ea WHERE ea.id = entrada_almacen_id AND (
      has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()) OR can_view_requisicion(auth.uid(), ea.requisicion_id)
    )
  ));

CREATE POLICY "Superadmins can delete partida entries" ON public.entrada_almacen_partidas
  FOR DELETE TO authenticated
  USING (is_superadmin(auth.uid()));

-- RLS for entrada_almacen_archivos
CREATE POLICY "Users can insert archivo entries" ON public.entrada_almacen_archivos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view archivo entries" ON public.entrada_almacen_archivos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entradas_almacen ea WHERE ea.id = entrada_almacen_id AND (
      has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid()) OR can_view_requisicion(auth.uid(), ea.requisicion_id)
    )
  ));

CREATE POLICY "Superadmins can delete archivo entries" ON public.entrada_almacen_archivos
  FOR DELETE TO authenticated
  USING (is_superadmin(auth.uid()));

-- Updated_at trigger for entradas_almacen
CREATE TRIGGER update_entradas_almacen_updated_at
  BEFORE UPDATE ON public.entradas_almacen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add fecha_almacen column to requisiciones for timeline
ALTER TABLE public.requisiciones ADD COLUMN IF NOT EXISTS fecha_almacen TIMESTAMPTZ;
ALTER TABLE public.requisiciones ADD COLUMN IF NOT EXISTS almacen_recibido_por UUID;

-- Enable realtime for entradas_almacen
ALTER PUBLICATION supabase_realtime ADD TABLE public.entradas_almacen;
