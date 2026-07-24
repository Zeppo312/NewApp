-- ============================================================
-- Lottis Fürsorge — Tabellen für den KI-Berater
-- (siehe docs/KI_BERATER_KONZEPT.md, Abschnitt 7)
--
-- Einspielen: Supabase Dashboard → SQL Editor → einfügen → Run.
-- Das Skript ist idempotent (mehrfaches Ausführen ist harmlos).
-- ============================================================

-- ------------------------------------------------------------
-- 1) advisor_messages — ein Hinweis pro Nutzer/Baby/Tag
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advisor_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id       UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  local_date    DATE NOT NULL,                    -- Tag in Gerätezeitzone des Nutzers
  rule_id       TEXT NOT NULL,                    -- z. B. 'hot_low_feeding', 'all_good'
  title         TEXT NOT NULL,
  headline      TEXT,                             -- fette Kernaussage der Hauptkarte
  body          TEXT NOT NULL,
  emoji         TEXT,
  tone          TEXT NOT NULL DEFAULT 'neutral',  -- positive | neutral | gentle
  category      TEXT NOT NULL,                    -- weather | sleep | feeding | motivation
  priority      INT  NOT NULL DEFAULT 3,          -- 1 = höchste (Kombi-Regeln)
  facts         JSONB,                            -- Audit: welche Daten führten zum Hinweis
  source        TEXT NOT NULL DEFAULT 'rules',    -- rules | ai | template_fallback
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  acted_at      TIMESTAMPTZ,                      -- „Erledigt"-Haken im Feed
  dismissed_at  TIMESTAMPTZ,
  -- genau 1 Hinweis pro Nutzer/Baby/Tag (Basis für den App-Upsert):
  CONSTRAINT advisor_messages_daily_unique UNIQUE (user_id, baby_id, local_date)
);

-- Verlaufabfragen: neueste Hinweise eines Nutzers zuerst
CREATE INDEX IF NOT EXISTS advisor_messages_user_date_idx
  ON public.advisor_messages (user_id, local_date DESC);

ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisor_messages_select_own" ON public.advisor_messages;
CREATE POLICY "advisor_messages_select_own" ON public.advisor_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "advisor_messages_insert_own" ON public.advisor_messages;
CREATE POLICY "advisor_messages_insert_own" ON public.advisor_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "advisor_messages_update_own" ON public.advisor_messages;
CREATE POLICY "advisor_messages_update_own" ON public.advisor_messages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "advisor_messages_delete_own" ON public.advisor_messages;
CREATE POLICY "advisor_messages_delete_own" ON public.advisor_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) advisor_settings — Einstellungen pro Nutzer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advisor_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  frequency          TEXT    NOT NULL DEFAULT 'daily',  -- daily | critical_only | off
  themes             TEXT[]  NOT NULL DEFAULT '{weather,sleep,feeding,motivation}',
  quiet_hours_start  INT     NOT NULL DEFAULT 21,       -- kein Push nach 21 Uhr …
  quiet_hours_end    INT     NOT NULL DEFAULT 7,        -- … und vor 7 Uhr (lokale Zeit)
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advisor_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisor_settings_select_own" ON public.advisor_settings;
CREATE POLICY "advisor_settings_select_own" ON public.advisor_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "advisor_settings_insert_own" ON public.advisor_settings;
CREATE POLICY "advisor_settings_insert_own" ON public.advisor_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "advisor_settings_update_own" ON public.advisor_settings;
CREATE POLICY "advisor_settings_update_own" ON public.advisor_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) Erweiterungen für die Edge Functions (advisor-generate /
--    advisor-daily). Idempotent — kann jederzeit erneut laufen.
-- ------------------------------------------------------------

-- Push-Tracking pro Hinweis (gesetzt von advisor-daily):
ALTER TABLE public.advisor_messages
  ADD COLUMN IF NOT EXISTS pushed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_status TEXT;  -- sent | no_token | quiet_hours | skipped | error

-- Cooldown-Abfragen: „Kam Regel X in den letzten 72 h schon vor?"
CREATE INDEX IF NOT EXISTS advisor_messages_cooldown_idx
  ON public.advisor_messages (user_id, baby_id, rule_id, local_date DESC);

-- Kontext für den täglichen Server-Job:
--   timezone  → lokale Uhrzeit (Versand ~8 Uhr, stille Zeiten)
--   latitude/longitude → Wetterabruf serverseitig (grob, optional)
--   ai_enabled → KI-Formulierung an/aus (Template-Fallback bleibt)
ALTER TABLE public.advisor_settings
  ADD COLUMN IF NOT EXISTS timezone            TEXT NOT NULL DEFAULT 'Europe/Berlin',
  ADD COLUMN IF NOT EXISTS latitude            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_enabled          BOOLEAN NOT NULL DEFAULT TRUE;

-- Explizites Push-Opt-in (Default AUS) — advisor-daily pusht nur bei TRUE:
ALTER TABLE public.advisor_settings
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT FALSE;
