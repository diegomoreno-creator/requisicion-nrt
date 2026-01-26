-- Create storage bucket for reposicion files
INSERT INTO storage.buckets (id, name, public)
VALUES ('reposicion_archivos', 'reposicion_archivos', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for reposicion file metadata
CREATE TABLE IF NOT EXISTS public.reposicion_archivos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reposicion_id uuid REFERENCES public.reposiciones(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reposicion_archivos ENABLE ROW LEVEL SECURITY;

-- Storage policies for reposicion_archivos bucket
CREATE POLICY "Users can upload reposicion files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reposicion_archivos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can read reposicion files"
ON storage.objects FOR SELECT
USING (bucket_id = 'reposicion_archivos');

CREATE POLICY "Users can delete their own reposicion files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reposicion_archivos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Table RLS policies
CREATE POLICY "Users can insert their own files"
ON public.reposicion_archivos FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view files of viewable reposiciones"
ON public.reposicion_archivos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reposiciones r
    WHERE r.id = reposicion_archivos.reposicion_id
    AND (
      r.solicitado_por = auth.uid()
      OR r.autorizador_id = auth.uid()
      OR is_superadmin(auth.uid())
      OR get_user_role(auth.uid()) IN ('admin', 'comprador')
    )
  )
);

CREATE POLICY "Users can delete their own pending reposicion files"
ON public.reposicion_archivos FOR DELETE
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM reposiciones r
    WHERE r.id = reposicion_archivos.reposicion_id
    AND r.solicitado_por = auth.uid()
    AND r.estado IN ('pendiente', 'rechazado')
  )
);

CREATE POLICY "Superadmins can delete any reposicion files"
ON public.reposicion_archivos FOR DELETE
USING (is_superadmin(auth.uid()));