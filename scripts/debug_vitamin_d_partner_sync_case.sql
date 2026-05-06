-- Diagnose für Vitamin-D-Partner-Sync
-- Nutzung:
-- 1) Diese Datei im Supabase SQL Editor ausführen
-- 2) Falls nötig unten target_user_id / target_day anpassen
-- 3) Den Mann auf seinem Gerät Vitamin D anklicken lassen
-- 4) Abschnitt 6 und 7 direkt erneut ausführen
--
-- Interpretation:
-- - Kein Datensatz in baby_daily_habit_checks nach dem Klick:
--   Entweder fehlt die Tabelle/Migration, es fehlt baby_members-Zugriff,
--   oder die App fällt lokal auf AsyncStorage zurück.
-- - Datensatz ist da, erscheint aber nicht auf dem anderen Gerät:
--   Dann ist es eher ein Client-/Realtime-/activeBabyId-Problem.

-- 0) Basisparameter
WITH params AS (
  SELECT
    'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id,
    CURRENT_DATE::date AS target_day
)
SELECT *
FROM params;

-- 1) Existiert die Remote-Tabelle überhaupt und ist sie in Realtime publiziert?
SELECT
  to_regclass('public.baby_daily_habit_checks') AS habit_table,
  to_regclass('public.baby_members') AS baby_members_table,
  to_regclass('public.account_links') AS account_links_table;

SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename = 'baby_daily_habit_checks';

-- 2) Partner-Verknüpfung des gemeldeten Accounts
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

-- 3) Partner-ID(s) der betroffenen Userin
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
WHERE al.status = 'accepted'
ORDER BY partner_name;

-- 4) Alle Babys beider Accounts
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

-- 5) Mitgliedschaften: sind wirklich beide Benutzer am selben Baby?
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

-- 5b) Kompakte Sicht: welche Babys sind NICHT von beiden Mitgliedern geteilt?
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
  COUNT(DISTINCT bm.user_id) AS visible_member_count,
  STRING_AGG(DISTINCT COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, bm.user_id::text), ', ') AS visible_members
FROM pair_babies pb
LEFT JOIN public.baby_members bm ON bm.baby_id = pb.id
LEFT JOIN public.profiles pr ON pr.id = bm.user_id
GROUP BY pb.id, pb.name
HAVING COUNT(DISTINCT bm.user_id) < 2
ORDER BY pb.name NULLS LAST, pb.id;

-- 6) Vitamin-D-Einträge der letzten 14 Tage
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
  SELECT DISTINCT bi.id, bi.name
  FROM public.baby_info bi
  JOIN pair_users pu ON pu.user_id = bi.user_id
)
SELECT
  h.id,
  h.baby_id,
  pb.name AS baby_name,
  h.habit_key,
  h.day,
  h.checked_at,
  h.checked_by,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS checked_by_name,
  owner.id AS baby_owner_user_id,
  COALESCE(owner_profile.first_name || ' ' || owner_profile.last_name, owner_profile.first_name, owner_profile.last_name, 'Unbekannt') AS baby_owner_name
FROM public.baby_daily_habit_checks h
JOIN pair_babies pb ON pb.id = h.baby_id
LEFT JOIN public.profiles pr ON pr.id = h.checked_by
LEFT JOIN public.baby_info owner ON owner.id = h.baby_id
LEFT JOIN public.profiles owner_profile ON owner_profile.id = owner.user_id
WHERE h.habit_key = 'vitamin_d'
  AND h.day >= CURRENT_DATE - INTERVAL '14 days'
ORDER BY h.day DESC, h.checked_at DESC;

-- 7) Fokus auf heute: nach dem Klick des Mannes muss hier sofort eine Row auftauchen
WITH params AS (
  SELECT
    'f2fc79b3-d271-47ae-849b-211a7560bf0c'::uuid AS target_user_id,
    CURRENT_DATE::date AS target_day
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
  SELECT DISTINCT bi.id, bi.name
  FROM public.baby_info bi
  JOIN pair_users pu ON pu.user_id = bi.user_id
)
SELECT
  h.id,
  h.baby_id,
  pb.name AS baby_name,
  h.day,
  h.checked_at,
  h.checked_by,
  COALESCE(pr.first_name || ' ' || pr.last_name, pr.first_name, pr.last_name, 'Unbekannt') AS checked_by_name
FROM public.baby_daily_habit_checks h
JOIN pair_babies pb ON pb.id = h.baby_id
LEFT JOIN public.profiles pr ON pr.id = h.checked_by
JOIN params p ON p.target_day = h.day
WHERE h.habit_key = 'vitamin_d'
ORDER BY h.checked_at DESC;

-- 8) Aggregation: Wird auf verschiedene baby_ids geschrieben?
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
  SELECT DISTINCT bi.id, bi.name
  FROM public.baby_info bi
  JOIN pair_users pu ON pu.user_id = bi.user_id
)
SELECT
  h.baby_id,
  pb.name AS baby_name,
  COUNT(*) AS vitamin_d_rows,
  COUNT(DISTINCT h.day) AS distinct_days,
  MIN(h.day) AS first_day,
  MAX(h.day) AS last_day
FROM public.baby_daily_habit_checks h
JOIN pair_babies pb ON pb.id = h.baby_id
WHERE h.habit_key = 'vitamin_d'
GROUP BY h.baby_id, pb.name
ORDER BY vitamin_d_rows DESC, pb.name;
