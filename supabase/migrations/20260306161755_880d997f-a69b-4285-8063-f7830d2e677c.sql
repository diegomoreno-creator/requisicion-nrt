
-- Create storage bucket for almacen files
INSERT INTO storage.buckets (id, name, public) VALUES ('almacen_archivos', 'almacen_archivos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for almacen_archivos bucket
CREATE POLICY "Almacen users can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'almacen_archivos' AND (has_role(auth.uid(), 'almacen') OR is_superadmin(auth.uid())));

CREATE POLICY "Anyone can view almacen files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'almacen_archivos');

CREATE POLICY "Superadmins can delete almacen files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'almacen_archivos' AND is_superadmin(auth.uid()));

-- Add RLS policy for almacen users to update requisiciones to en_almacen
CREATE POLICY "Almacen users can update requisiciones to en_almacen" ON public.requisiciones
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'almacen') AND estado = 'pedido_pagado')
  WITH CHECK (has_role(auth.uid(), 'almacen') AND estado = 'en_almacen');
