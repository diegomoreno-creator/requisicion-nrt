
-- Table to track multiple authorizers per requisition (for "Compra de vehículo" type)
CREATE TABLE public.requisicion_autorizadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id uuid NOT NULL REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  autorizador_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  justificacion_rechazo text,
  fecha_accion timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requisicion_id, autorizador_id)
);

-- Enable RLS
ALTER TABLE public.requisicion_autorizadores ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone who can view the requisicion can view its authorizers
CREATE POLICY "Users can view autorizadores of viewable requisitions"
  ON public.requisicion_autorizadores FOR SELECT
  USING (can_view_requisicion(auth.uid(), requisicion_id));

-- RLS: Authenticated users can insert (will be done at creation time by solicitador)
CREATE POLICY "Users can insert autorizadores for their requisitions"
  ON public.requisicion_autorizadores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requisiciones r
      WHERE r.id = requisicion_autorizadores.requisicion_id
        AND r.solicitado_por = auth.uid()
    )
  );

-- RLS: Authorizers can update their own row (to approve/reject)
CREATE POLICY "Autorizadores can update their own approval"
  ON public.requisicion_autorizadores FOR UPDATE
  USING (autorizador_id = auth.uid() OR is_superadmin(auth.uid()) OR has_role(auth.uid(), 'admin'));

-- RLS: Solicitador can delete when editing their requisition
CREATE POLICY "Users can delete autorizadores of their pending requisitions"
  ON public.requisicion_autorizadores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisiciones r
      WHERE r.id = requisicion_autorizadores.requisicion_id
        AND r.solicitado_por = auth.uid()
        AND r.estado IN ('pendiente', 'pendiente_revision', 'rechazado')
    )
    OR is_superadmin(auth.uid())
  );

-- Superadmin full delete
CREATE POLICY "Superadmin can delete autorizadores"
  ON public.requisicion_autorizadores FOR DELETE
  USING (is_superadmin(auth.uid()));

-- Update can_view_requisicion to include multi-authorizer visibility
CREATE OR REPLACE FUNCTION public.can_view_requisicion(_user_id uuid, _requisicion_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _requisicion RECORD;
BEGIN
  SELECT * INTO _requisicion FROM requisiciones WHERE id = _requisicion_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF is_superadmin(_user_id) THEN RETURN TRUE; END IF;
  IF _requisicion.deleted_at IS NOT NULL THEN RETURN FALSE; END IF;
  IF has_role(_user_id, 'admin') THEN
    RETURN _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id;
  END IF;
  -- Multi-authorizer: check if user is one of the assigned authorizers
  IF has_role(_user_id, 'autorizador') AND EXISTS (
    SELECT 1 FROM requisicion_autorizadores ra
    WHERE ra.requisicion_id = _requisicion_id AND ra.autorizador_id = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'revision') AND (
    _requisicion.revisor_id = _user_id OR _requisicion.solicitado_por = _user_id OR _requisicion.revisado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'autorizador') AND (
    _requisicion.autorizador_id = _user_id OR _requisicion.solicitado_por = _user_id OR _requisicion.autorizado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'comprador') AND (
    _requisicion.solicitado_por = _user_id 
    OR _requisicion.estado IN ('aprobado', 'en_licitacion', 'pedido_colocado', 'pedido_autorizado', 'pedido_pagado')
    OR _requisicion.justificacion_rechazo IS NOT NULL
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'presupuestos') AND (
    _requisicion.estado = 'pedido_colocado' OR _requisicion.solicitado_por = _user_id
    OR _requisicion.rechazado_por_presupuestos_id = _user_id OR _requisicion.pedido_autorizado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'tesoreria') AND (
    _requisicion.estado = 'pedido_autorizado' OR _requisicion.solicitado_por = _user_id OR _requisicion.pagado_por = _user_id
  ) THEN RETURN TRUE; END IF;
  IF has_role(_user_id, 'solicitador') AND _requisicion.solicitado_por = _user_id THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$function$;

-- Also need to update RLS on requisiciones to allow multi-authorizer updates
-- Autorizadores assigned via requisicion_autorizadores should be able to update
CREATE POLICY "Multi-autorizadores can update requisiciones"
  ON public.requisiciones FOR UPDATE
  USING (
    has_role(auth.uid(), 'autorizador') AND
    estado = 'pendiente' AND
    EXISTS (
      SELECT 1 FROM public.requisicion_autorizadores ra
      WHERE ra.requisicion_id = requisiciones.id
        AND ra.autorizador_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'autorizador') AND
    estado IN ('pendiente', 'aprobado', 'rechazado')
  );

-- Add realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisicion_autorizadores;
