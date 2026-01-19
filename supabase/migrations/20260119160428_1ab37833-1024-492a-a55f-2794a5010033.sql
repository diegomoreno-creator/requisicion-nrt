-- Enable realtime for requisiciones and reposiciones tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisiciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reposiciones;