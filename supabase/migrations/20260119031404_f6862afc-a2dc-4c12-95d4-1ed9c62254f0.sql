-- Update can_view_requisicion function to include autorizador role
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
  
  -- Autorizador can view requisitions assigned to them
  IF user_role = 'autorizador' AND req_autorizador = _user_id THEN RETURN true; END IF;
  
  -- Comprador can view created or approved
  IF user_role = 'comprador' AND (req_solicitante = _user_id OR req_estado = 'aprobado') THEN RETURN true; END IF;
  
  -- Solicitador can only view their own
  IF user_role = 'solicitador' AND req_solicitante = _user_id THEN RETURN true; END IF;
  
  -- Autorizador can also view their own created requisitions
  IF user_role = 'autorizador' AND req_solicitante = _user_id THEN RETURN true; END IF;
  
  RETURN false;
END;
$$;