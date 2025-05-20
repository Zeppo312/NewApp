-- Create community notifications table
CREATE TABLE IF NOT EXISTS community_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('like_post', 'like_comment', 'comment', 'reply', 'like_nested_comment', 'follow', 'message')),
  content TEXT,
  reference_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_community_notifications_user_id ON community_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_community_notifications_is_read ON community_notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_community_notifications_created_at ON community_notifications (created_at DESC);

-- Create RLS policies for notifications
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;

-- Sicheres Erstellen der Policies mit Überprüfung auf Existenz
DO $$
BEGIN
    -- Policy to allow users to see their own notifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'community_notifications' 
        AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications"
        ON community_notifications
        FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
    
    -- Policy to delete own notifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'community_notifications' 
        AND policyname = 'Users can delete own notifications'
    ) THEN
        CREATE POLICY "Users can delete own notifications"
        ON community_notifications
        FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
    
    -- Policy to allow service role to create notifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'community_notifications' 
        AND policyname = 'Service can create notifications'
    ) THEN
        CREATE POLICY "Service can create notifications"
        ON community_notifications
        FOR INSERT
        WITH CHECK (true);
    END IF;
    
    -- Policy to allow service role to update notifications
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'community_notifications' 
        AND policyname = 'Service can update notifications'
    ) THEN
        CREATE POLICY "Service can update notifications"
        ON community_notifications
        FOR UPDATE
        USING (true);
    END IF;
END
$$;

-- Add notification count function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO notification_count
  FROM community_notifications
  WHERE user_id = user_id_param AND is_read = FALSE;
  
  RETURN notification_count;
END;
$$; 