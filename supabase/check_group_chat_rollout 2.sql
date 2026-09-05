DROP TABLE IF EXISTS pg_temp.group_chat_rollout_checks;

CREATE TEMP TABLE group_chat_rollout_checks AS
WITH checks AS (
  SELECT
    '20260329010000_create_community_groups.sql' AS source_migration,
    'public.community_groups table' AS item,
    to_regclass('public.community_groups') IS NOT NULL AS ok,
    'Basis fuer Gruppen' AS details

  UNION ALL
  SELECT
    '20260329010000_create_community_groups.sql',
    'public.community_group_members table',
    to_regclass('public.community_group_members') IS NOT NULL,
    'Mitgliedschaften fuer Gruppen'

  UNION ALL
  SELECT
    '20260330094500_add_community_identity_mode_to_user_settings.sql',
    'user_settings.community_identity_mode column',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_settings'
        AND column_name = 'community_identity_mode'
    ),
    'Community-Identitaetswahl gespeichert'

  UNION ALL
  SELECT
    '20260330113000_add_community_use_avatar_to_user_settings.sql',
    'user_settings.community_use_avatar column',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_settings'
        AND column_name = 'community_use_avatar'
    ),
    'Community-Profilbild-Freigabe gespeichert'

  UNION ALL
  SELECT
    '20260330115000_require_confirmed_community_identity_for_group_invites.sql',
    'public.search_group_invite_profiles(uuid,text) function',
    to_regprocedure('public.search_group_invite_profiles(uuid,text)') IS NOT NULL,
    'Suche fuer Gruppeneinladungen'

  UNION ALL
  SELECT
    '20260401000000_create_group_chat.sql',
    'public.community_group_messages table',
    to_regclass('public.community_group_messages') IS NOT NULL,
    'Gruppenchat-Nachrichten'

  UNION ALL
  SELECT
    '20260401000000_create_group_chat.sql',
    'public.community_group_chat_reads table',
    to_regclass('public.community_group_chat_reads') IS NOT NULL,
    'Read-Tracking fuer Gruppenchats'

  UNION ALL
  SELECT
    '20260401000000_create_group_chat.sql',
    'public.get_group_chat_unread_count(uuid) function',
    to_regprocedure('public.get_group_chat_unread_count(uuid)') IS NOT NULL,
    'Unread-Count pro Gruppe'

  UNION ALL
  SELECT
    '20260401000000_create_group_chat.sql',
    'group_chat_reads_update policy membership check',
    EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_group_chat_reads'
        AND policyname = 'group_chat_reads_update'
        AND qual ILIKE '%is_active_group_member%'
        AND with_check ILIKE '%is_active_group_member%'
    ),
    'Read-Tracking darf nur aktive Mitglieder aktualisieren'

  UNION ALL
  SELECT
    '20260401000000_create_group_chat.sql',
    'supabase_realtime publication includes community_group_messages',
    EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_messages'
    ),
    'Realtime fuer neue Gruppennachrichten'

  UNION ALL
  SELECT
    '20260401010000_add_group_member_profiles_rpc.sql',
    'public.get_group_member_profiles(uuid) function',
    to_regprocedure('public.get_group_member_profiles(uuid)') IS NOT NULL,
    'Sichere Profildaten fuer Gruppen/Chat'

  UNION ALL
  SELECT
    '20260401020000_add_group_chat_summaries_rpc.sql',
    'public.get_my_group_chat_summaries() function',
    to_regprocedure('public.get_my_group_chat_summaries()') IS NOT NULL,
    'Liste der Gruppenchats fuer Nachrichten-Tab'

  UNION ALL
  SELECT
    '20260401020000_add_group_chat_summaries_rpc.sql',
    'public.get_total_group_chat_unread_count() function',
    to_regprocedure('public.get_total_group_chat_unread_count()') IS NOT NULL,
    'Gesamtzahl ungelesener Gruppennachrichten'

  UNION ALL
  SELECT
    '20260401030000_add_group_chat_notification_webhook.sql',
    'public.send_group_message_notification_webhook() function',
    to_regprocedure('public.send_group_message_notification_webhook()') IS NOT NULL,
    'Webhook fuer Gruppenchat-Push'

  UNION ALL
  SELECT
    '20260401030000_add_group_chat_notification_webhook.sql',
    'trigger_send_group_message_notification_webhook trigger',
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger
      JOIN pg_class rel
        ON rel.oid = trigger.tgrelid
      JOIN pg_namespace nsp
        ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'community_group_messages'
        AND trigger.tgname = 'trigger_send_group_message_notification_webhook'
        AND NOT trigger.tgisinternal
    ),
    'Push-Trigger auf neue Gruppennachrichten'

  UNION ALL
  SELECT
    '20260401040000_enable_realtime_for_group_chat_reads.sql',
    'supabase_realtime publication includes community_group_chat_reads',
    EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_chat_reads'
    ),
    'Realtime fuer sofortiges Badge-Reset nach Lesen'
)
SELECT
  source_migration,
  item,
  ok,
  details
FROM checks;

SELECT
  source_migration,
  item,
  CASE WHEN ok THEN 'OK' ELSE 'MISSING' END AS status,
  details
FROM group_chat_rollout_checks
ORDER BY
  CASE WHEN ok THEN 1 ELSE 0 END,
  source_migration,
  item;

SELECT
  COALESCE(
    string_agg(source_migration || ' -> ' || item, E'\n' ORDER BY source_migration, item),
    'Alles Wichtige fuer Gruppen + Gruppenchats ist in der DB vorhanden.'
  ) AS missing_db_steps
FROM (
  SELECT source_migration, item
  FROM group_chat_rollout_checks
  WHERE NOT ok
) missing;

SELECT
  'MANUAL_CHECK' AS status,
  'Edge Function "send-group-message-notification" und die Secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_MESSAGE_WEBHOOK_SECRET muessen ausserhalb von SQL deployed/gesetzt werden.' AS note;
