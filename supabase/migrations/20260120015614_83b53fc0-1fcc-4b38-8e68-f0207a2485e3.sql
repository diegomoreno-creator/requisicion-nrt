-- Add asunto column to requisiciones table
ALTER TABLE public.requisiciones
ADD COLUMN asunto text;