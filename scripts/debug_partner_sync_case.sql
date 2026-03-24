-- Diagnose für Partner-Sync-Probleme bei Baby-/Care-Einträgen
-- Nutzung:
-- 1) Diese Datei im Supabase SQL Editor ausführen
-- 2) Falls nötig unten die target_user_id anpassen
-- 3) Ergebnisse Abschnitt für Abschnitt prüfen

-- Gemeldeter Account
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
)
SELECT target_user_id
FROM params;

-- 1) Bestehende Partner-Verknüpfungen
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
)
SELECT
  al.id AS account_link_id,
  al.status,
  al.relationship_type,
  al.creator_id,
  creator.first_name AS creator_first_name,
  creator.last_name AS creator_last_name,
  al.invited_id,
  invited.first_name AS invited_first_name,
  invited.last_name AS invited_last_name,
  al.created_at,
  al.accepted_at
FROM public.account_links al
LEFT JOIN public.profiles creator ON creator.id = al.creator_id
LEFT JOIN public.profiles invited ON invited.id = al.invited_id
JOIN params p
  ON p.target_user_id = al.creator_id
  OR p.target_user_id = al.invited_id
ORDER BY al.created_at DESC;

-- 2) Partner-ID(s) zur Ziel-User-ID
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
)
SELECT DISTINCT
  CASE
    WHEN al.creator_id = p.target_user_id THEN al.invited_id
    ELSE al.creator_id
  END AS partner_user_id,
  CASE
    WHEN al.creator_id = p.target_user_id
      THEN COALESCE(invited.first_name || ' ' || invited.last_name, invited.first_name, invited.last_name, 'Unbekannt')
    ELSE COALESCE(creator.first_name || ' ' || creator.last_name, creator.first_name, creator.last_name, 'Unbekannt')
  END AS partner_name,
  al.status,
  al.relationship_type
FROM public.account_links al
LEFT JOIN public.profiles creator ON creator.id = al.creator_id
LEFT JOIN public.profiles invited ON invited.id = al.invited_id
JOIN params p
  ON p.target_user_id = al.creator_id
  OR p.target_user_id = al.invited_id
WHERE al.status = 'accepted';

-- 3) Alle Baby-Profile beider Accounts
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  bi.id AS baby_id,
  bi.user_id AS owner_user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS owner_name,
  bi.name AS baby_name,
  bi.birth_date,
  bi.created_at
FROM public.baby_info bi
LEFT JOIN public.profiles pr ON pr.id = bi.user_id
JOIN pair_users pu ON pu.user_id = bi.user_id
ORDER BY bi.created_at ASC;

-- 4) Mitgliedschaften an Baby-Profilen
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
),
pair_babies AS (
  SELECT bi.id
  FROM public.baby_info bi
  JOIN pair_users pu ON pu.user_id = bi.user_id
)
SELECT
  bm.baby_id,
  bi.name AS baby_name,
  bi.user_id AS baby_owner_user_id,
  bm.user_id AS member_user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS member_name,
  bm.role,
  bm.created_at
FROM public.baby_members bm
JOIN pair_babies pb ON pb.id = bm.baby_id
LEFT JOIN public.baby_info bi ON bi.id = bm.baby_id
LEFT JOIN public.profiles pr ON pr.id = bm.user_id
ORDER BY bm.baby_id, bm.created_at;

-- 5) Sichtbarkeitstest für baby_care_entries der letzten 30 Tage
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  bce.id,
  bce.user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS entry_owner_name,
  bce.baby_id,
  bi.name AS baby_name,
  bi.user_id AS baby_owner_user_id,
  bce.entry_type,
  bce.feeding_type,
  bce.diaper_type,
  bce.start_time,
  bce.end_time,
  bce.created_at
FROM public.baby_care_entries bce
LEFT JOIN public.baby_info bi ON bi.id = bce.baby_id
LEFT JOIN public.profiles pr ON pr.id = bce.user_id
JOIN pair_users pu ON pu.user_id = bce.user_id
WHERE bce.start_time >= now() - interval '30 days'
ORDER BY bce.start_time DESC;

-- 6) Aggregation: landen Einträge auf unterschiedlichen baby_ids?
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  bce.user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS entry_owner_name,
  bce.baby_id,
  bi.name AS baby_name,
  COUNT(*) AS entry_count
FROM public.baby_care_entries bce
LEFT JOIN public.baby_info bi ON bi.id = bce.baby_id
LEFT JOIN public.profiles pr ON pr.id = bce.user_id
JOIN pair_users pu ON pu.user_id = bce.user_id
WHERE bce.start_time >= now() - interval '30 days'
GROUP BY bce.user_id, pr.first_name, pr.last_name, bce.baby_id, bi.name
ORDER BY entry_owner_name, entry_count DESC;

-- 7) Alte Tabellen prüfen: baby_daily / feeding_events
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  'baby_daily' AS source_table,
  bd.user_id,
  bd.baby_id,
  bd.entry_type::text AS detail_type,
  bd.entry_date AS event_time,
  bd.created_at
FROM public.baby_daily bd
JOIN pair_users pu ON pu.user_id = bd.user_id
WHERE bd.created_at >= now() - interval '30 days'

UNION ALL

SELECT
  'feeding_events' AS source_table,
  fe.user_id,
  fe.baby_id,
  fe.type::text AS detail_type,
  fe.start_time AS event_time,
  fe.created_at
FROM public.feeding_events fe
JOIN pair_users pu ON pu.user_id = fe.user_id
WHERE fe.created_at >= now() - interval '30 days'

ORDER BY created_at DESC;

-- 8) Sichtbarkeitstest für sleep_entries der letzten 30 Tage
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  se.id,
  se.user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS entry_owner_name,
  se.partner_id,
  COALESCE(partner.first_name || ' ' || partner.last_name, partner.first_name, partner.last_name, 'Unbekannt') AS partner_name,
  se.shared_with_user_id,
  se.baby_id,
  bi.name AS baby_name,
  bi.user_id AS baby_owner_user_id,
  se.start_time,
  se.end_time,
  se.duration_minutes,
  se.created_at
FROM public.sleep_entries se
LEFT JOIN public.baby_info bi ON bi.id = se.baby_id
LEFT JOIN public.profiles pr ON pr.id = se.user_id
LEFT JOIN public.profiles partner ON partner.id = se.partner_id
JOIN pair_users pu ON pu.user_id = se.user_id
WHERE se.start_time >= now() - interval '30 days'
ORDER BY se.start_time DESC;

-- 9) Aggregation: landen Schlafeinträge auf unterschiedlichen baby_ids / Partnern?
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
)
SELECT
  se.user_id,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS entry_owner_name,
  se.partner_id,
  se.baby_id,
  bi.name AS baby_name,
  COUNT(*) AS entry_count
FROM public.sleep_entries se
LEFT JOIN public.baby_info bi ON bi.id = se.baby_id
LEFT JOIN public.profiles pr ON pr.id = se.user_id
JOIN pair_users pu ON pu.user_id = se.user_id
WHERE se.start_time >= now() - interval '30 days'
GROUP BY se.user_id, pr.first_name, pr.last_name, se.partner_id, se.baby_id, bi.name
ORDER BY entry_owner_name, entry_count DESC;

-- 10) Plausibilitätscheck: Für jedes Baby beide Accounts Mitglied?
WITH params AS (
  SELECT 'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id
),
linked_users AS (
  SELECT DISTINCT
    CASE
      WHEN al.creator_id = p.target_user_id THEN al.invited_id
      ELSE al.creator_id
    END AS user_id
  FROM public.account_links al
  JOIN params p
    ON p.target_user_id = al.creator_id
    OR p.target_user_id = al.invited_id
  WHERE al.status = 'accepted'
),
pair_users AS (
  SELECT target_user_id AS user_id FROM params
  UNION
  SELECT user_id FROM linked_users
),
pair_babies AS (
  SELECT bi.id, bi.name
  FROM public.baby_info bi
  JOIN pair_users pu ON pu.user_id = bi.user_id
)
SELECT
  pb.id AS baby_id,
  pb.name AS baby_name,
  COUNT(DISTINCT bm.user_id) AS member_count,
  ARRAY_AGG(DISTINCT bm.user_id) AS member_user_ids
FROM pair_babies pb
LEFT JOIN public.baby_members bm ON bm.baby_id = pb.id
GROUP BY pb.id, pb.name
ORDER BY pb.name NULLS LAST, pb.id;
