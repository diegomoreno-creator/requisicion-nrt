-- Create storage bucket for requisition attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('requisicion_archivos', 'requisicion_archivos', true)
ON CONFLICT (id) DO NOTHING;

-- Create table to track uploaded files
CREATE TABLE public.requisicion_archivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicion_id UUID REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requisicion_archivos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for requisicion_archivos table
CREATE POLICY "Users can insert their own files"
ON public.requisicion_archivos
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view files of viewable requisitions"
ON public.requisicion_archivos
FOR SELECT
USING (can_view_requisicion(auth.uid(), requisicion_id));

CREATE POLICY "Users can delete their own pending requisition files"
ON public.requisicion_archivos
FOR DELETE
USING (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM requisiciones r
    WHERE r.id = requisicion_id
    AND r.solicitado_por = auth.uid()
    AND r.estado IN ('pendiente', 'rechazado')
  )
);

CREATE POLICY "Superadmins can delete any files"
ON public.requisicion_archivos
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Storage policies for requisicion_archivos bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'requisicion_archivos');

CREATE POLICY "Anyone can view requisicion files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'requisicion_archivos');

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'requisicion_archivos' AND auth.uid()::text = (storage.foldername(name))[1]);