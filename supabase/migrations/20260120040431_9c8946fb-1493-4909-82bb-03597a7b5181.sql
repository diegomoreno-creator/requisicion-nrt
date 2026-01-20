
-- Create table for texto compras history
CREATE TABLE public.requisicion_texto_compras_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id uuid NOT NULL REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  texto text NOT NULL,
  editado_por uuid NOT NULL,
  editado_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requisicion_texto_compras_historial ENABLE ROW LEVEL SECURITY;

-- RLS policies - same visibility as requisiciones
CREATE POLICY "Users can view historial of viewable requisitions"
ON public.requisicion_texto_compras_historial
FOR SELECT
USING (can_view_requisicion(auth.uid(), requisicion_id));

CREATE POLICY "Authenticated users can insert historial"
ON public.requisicion_texto_compras_historial
FOR INSERT
WITH CHECK (auth.uid() = editado_por);

-- Index for faster queries
CREATE INDEX idx_texto_compras_historial_requisicion ON public.requisicion_texto_compras_historial(requisicion_id);
