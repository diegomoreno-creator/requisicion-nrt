ALTER TABLE public.notification_preferences 
ADD COLUMN notify_email boolean NOT NULL DEFAULT true;