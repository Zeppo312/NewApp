-- Ensure the community notification type constraint supports direct messages.
-- This keeps older app versions that still write `type = 'message'`
-- to community_notifications from crashing on the DB constraint.
ALTER TABLE public.community_notifications
  DROP CONSTRAINT IF EXISTS community_notifications_type_check;

ALTER TABLE public.community_notifications
  ADD CONSTRAINT community_notifications_type_check
  CHECK (
    type IN (
      'like_post',
      'like_comment',
      'comment',
      'reply',
      'like_nested_comment',
      'follow',
      'message'
    )
  );
