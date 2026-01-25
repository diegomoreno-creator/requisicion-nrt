-- Create scheduled notifications table
CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('broadcast', 'role', 'personal')),
  target_role TEXT, -- For role notifications
  target_user_id UUID, -- For personal notifications
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  recipients_count INTEGER
);

-- Enable RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything
CREATE POLICY "Superadmins can view all scheduled notifications"
  ON public.scheduled_notifications FOR SELECT
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can create scheduled notifications"
  ON public.scheduled_notifications FOR INSERT
  WITH CHECK (is_superadmin(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Superadmins can update scheduled notifications"
  ON public.scheduled_notifications FOR UPDATE
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete scheduled notifications"
  ON public.scheduled_notifications FOR DELETE
  USING (is_superadmin(auth.uid()));

-- Create index for efficient querying of pending notifications
CREATE INDEX idx_scheduled_notifications_pending 
  ON public.scheduled_notifications (scheduled_at) 
  WHERE status = 'pending';

-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;