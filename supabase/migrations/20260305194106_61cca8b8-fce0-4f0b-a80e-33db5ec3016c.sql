
-- Fix requisiciones that are in 'pendiente' but have justificacion_rechazo and were previously authorized
-- These should be in 'rechazado' so the solicitante can edit and resubmit
UPDATE requisiciones
SET estado = 'rechazado'
WHERE estado = 'pendiente'
  AND deleted_at IS NULL
  AND justificacion_rechazo IS NOT NULL
  AND autorizado_por IS NOT NULL;
