-- ============================================================================
-- RPCs for group chat: summaries list + total unread count
-- Used by the Notifications/Messages tab and the unread badge hook
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. get_my_group_chat_summaries()
--    Returns one row per group the user is a member of that has at least one
--    message, ordered by latest message. Includes unread count per group.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_group_chat_summaries()
RETURNS TABLE(
  group_id UUID,
  group_name TEXT,
  group_visibility TEXT,
  latest_message_content TEXT,
  latest_message_sender_id UUID,
  latest_message_created_at TIMESTAMPTZ,
  unread_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    g.visibility::text AS group_visibility,
    latest_msg.content AS latest_message_content,
    latest_msg.sender_id AS latest_message_sender_id,
    latest_msg.created_at AS latest_message_created_at,
    COALESCE((
      SELECT count(*)::integer
      FROM community_group_messages msg
      WHERE msg.group_id = g.id
        AND msg.sender_id <> auth.uid()
        AND msg.created_at > COALESCE(
          (
            SELECT r.last_read_at
            FROM community_group_chat_reads r
            WHERE r.group_id = g.id
              AND r.user_id = auth.uid()
          ),
          '1970-01-01'::timestamptz
        )
    ), 0) AS unread_count
  FROM community_groups g
  INNER JOIN community_group_members m
    ON m.group_id = g.id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.sender_id, msg.created_at
    FROM community_group_messages msg
    WHERE msg.group_id = g.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) latest_msg ON true
  WHERE latest_msg.content IS NOT NULL
  ORDER BY latest_msg.created_at DESC;
$$;

-- --------------------------------------------------------------------------
-- 2. get_total_group_chat_unread_count()
--    Returns a single integer: total unread messages across all groups.
--    Lightweight – designed for badge polling.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_total_group_chat_unread_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(sub.cnt), 0)::integer
  FROM (
    SELECT (
      SELECT count(*)::integer
      FROM community_group_messages msg
      WHERE msg.group_id = m.group_id
        AND msg.sender_id <> auth.uid()
        AND msg.created_at > COALESCE(
          (
            SELECT r.last_read_at
            FROM community_group_chat_reads r
            WHERE r.group_id = m.group_id
              AND r.user_id = auth.uid()
          ),
          '1970-01-01'::timestamptz
        )
    ) AS cnt
    FROM community_group_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
  ) sub;
$$;
