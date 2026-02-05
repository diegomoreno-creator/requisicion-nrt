
-- Table to track folio sequences
CREATE TABLE public.folio_sequences (
  id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.folio_sequences ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read
CREATE POLICY "Authenticated users can read sequences"
ON public.folio_sequences FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert initial sequences
INSERT INTO public.folio_sequences (id, prefix, current_value) VALUES
  ('requisiciones', 'REQ-', 0),
  ('reposiciones', 'REP-', 0);

-- Initialize based on existing data
DO $$
DECLARE
  max_req INTEGER := 0;
  max_rep INTEGER := 0;
  num_val INTEGER;
  r RECORD;
BEGIN
  -- Count existing requisiciones to set starting point
  SELECT COUNT(*) INTO max_req FROM public.requisiciones;
  
  -- Count existing reposiciones
  SELECT COUNT(*) INTO max_rep FROM public.reposiciones;
  
  UPDATE public.folio_sequences SET current_value = max_req WHERE id = 'requisiciones';
  UPDATE public.folio_sequences SET current_value = max_rep WHERE id = 'reposiciones';
END $$;

-- Function to get next folio atomically
CREATE OR REPLACE FUNCTION public.get_next_folio(sequence_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_value INTEGER;
  folio_prefix TEXT;
BEGIN
  UPDATE public.folio_sequences
  SET current_value = current_value + 1
  WHERE id = sequence_type
  RETURNING current_value, prefix INTO next_value, folio_prefix;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sequence type % not found', sequence_type;
  END IF;

  RETURN folio_prefix || LPAD(next_value::TEXT, 5, '0');
END;
$$;
