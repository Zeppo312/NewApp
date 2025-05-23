-- Update notification count function to include direct messages
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_count INTEGER;
  message_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Count unread community notifications
  SELECT COUNT(*)
  INTO notification_count
  FROM community_notifications
  WHERE user_id = user_id_param AND is_read = FALSE;
  
  -- Count unread direct messages
  SELECT COUNT(*)
  INTO message_count
  FROM direct_messages
  WHERE receiver_id = user_id_param AND is_read = FALSE;
  
  -- Return total count
  total_count := COALESCE(notification_count, 0) + COALESCE(message_count, 0);
  
  RETURN total_count;
END;
$$; 