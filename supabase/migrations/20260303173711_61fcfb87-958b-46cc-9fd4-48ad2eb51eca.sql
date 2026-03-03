
-- Table to store which users are forced authorizers for high-budget requisitions
CREATE TABLE public.autorizadores_presupuesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.autorizadores_presupuesto ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (needed to build the multi-auth flow)
CREATE POLICY "Authenticated users can read autorizadores_presupuesto"
ON public.autorizadores_presupuesto
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only superadmins can manage
CREATE POLICY "Superadmins can insert autorizadores_presupuesto"
ON public.autorizadores_presupuesto
FOR INSERT
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update autorizadores_presupuesto"
ON public.autorizadores_presupuesto
FOR UPDATE
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete autorizadores_presupuesto"
ON public.autorizadores_presupuesto
FOR DELETE
USING (is_superadmin(auth.uid()));

-- Seed with the current forced authorizers
INSERT INTO public.autorizadores_presupuesto (user_id, orden, created_by)
VALUES 
  ('f27c379d-47e5-4e6b-9046-a79d84f79f2b', 1, 'f27c379d-47e5-4e6b-9046-a79d84f79f2b'),
  ('d894fca9-4bcc-49f5-a011-7bdef16cb872', 2, 'd894fca9-4bcc-49f5-a011-7bdef16cb872');
