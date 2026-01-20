-- Add unique constraint to prevent duplicate partidas for the same requisicion and numero_partida
ALTER TABLE public.requisicion_partidas
ADD CONSTRAINT unique_requisicion_partida UNIQUE (requisicion_id, numero_partida);