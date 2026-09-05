-- Benutzerdefinierte Daily-Aktivitaeten, Phase 1: Schema und aktive Regeln.
--
-- Diese Migration ist absichtlich fail-safe:
-- * Sie setzt die Multi-Baby-Migrationen explizit voraus.
-- * Unerwartete Teilinstallationen werden nicht stillschweigend uebernommen.
-- * Regeln auf der bestehenden baby_care_entries-Tabelle werden zuerst
--   NOT VALID angelegt. Sie gelten sofort fuer neue/geaenderte Zeilen, ohne
--   in diesem Schritt den kompletten Altbestand zu scannen.
-- * Die Bestandsvalidierung und der nebenlaeufige Index folgen in separaten
--   Migrationen.

-- Bei hoher Last lieber sauber abbrechen und spaeter erneut deployen, statt
-- unbemerkt lange auf einen exklusiven DDL-Lock zu warten.
SET lock_timeout = '5s';

DO $preflight$
BEGIN
  IF to_regclass('public.baby_info') IS NULL
    OR to_regclass('public.baby_members') IS NULL
    OR to_regclass('public.baby_care_entries') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: Multi-Baby-Basistabellen fehlen.';
  END IF;

  IF to_regprocedure('public.is_baby_member(uuid)') IS NULL
    OR to_regprocedure('public.set_updated_at()') IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: benoetigte Hilfsfunktionen fehlen.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'baby_care_entries'
      AND column_name = 'baby_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: baby_care_entries.baby_id fehlt.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.baby_care_entries'::regclass
      AND conname = 'baby_care_entries_entry_type_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: erwarteter entry_type-Constraint fehlt.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.baby_care_entries
    WHERE entry_type NOT IN ('feeding', 'diaper')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: unbekannte bestehende entry_type-Werte gefunden.';
  END IF;

  IF to_regclass('public.custom_activity_types') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'baby_care_entries'
        AND column_name IN (
          'custom_activity_type_id',
          'custom_name',
          'custom_emoji',
          'custom_color',
          'custom_tracking_mode',
          'custom_quantity',
          'custom_unit'
        )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: unerwartete Teilinstallation erkannt.';
  END IF;
END;
$preflight$;

-- Stellt die Zugriffsgrundlage fuer alte Baby-Datensaetze erneut sicher.
-- Das entspricht der bestehenden owner-Semantik in baby_info und ist
-- idempotent.
INSERT INTO public.baby_members (baby_id, user_id, role)
SELECT bi.id, bi.user_id, 'owner'
FROM public.baby_info bi
WHERE bi.user_id IS NOT NULL
ON CONFLICT (baby_id, user_id) DO NOTHING;

CREATE TABLE public.custom_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40),
  emoji TEXT NOT NULL DEFAULT '⭐️'
    CHECK (emoji = btrim(emoji) AND char_length(emoji) BETWEEN 1 AND 16),
  color TEXT NOT NULL DEFAULT '#5E3DB3'
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  tracking_mode TEXT NOT NULL DEFAULT 'event'
    CHECK (tracking_mode IN ('event', 'quantity', 'duration')),
  unit TEXT
    CHECK (
      unit IS NULL
      OR (unit = btrim(unit) AND char_length(unit) BETWEEN 1 AND 20)
    ),
  default_quantity NUMERIC(12, 3)
    CHECK (
      default_quantity IS NULL
      OR default_quantity BETWEEN 0.001 AND 999999999.999
    ),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_activity_types_id_baby_id_key UNIQUE (id, baby_id),
  CONSTRAINT custom_activity_types_quantity_fields_check CHECK (
    (tracking_mode = 'quantity' AND unit IS NOT NULL)
    OR (tracking_mode <> 'quantity' AND unit IS NULL AND default_quantity IS NULL)
  )
);

CREATE INDEX custom_activity_types_baby_id_idx
  ON public.custom_activity_types(baby_id);

CREATE INDEX custom_activity_types_created_by_idx
  ON public.custom_activity_types(created_by)
  WHERE created_by IS NOT NULL;

CREATE UNIQUE INDEX custom_activity_types_active_name_unique_idx
  ON public.custom_activity_types(baby_id, lower(name))
  WHERE is_archived = FALSE;

ALTER TABLE public.custom_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom activities: select by baby member"
  ON public.custom_activity_types
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_baby_member(baby_id)));

CREATE POLICY "Custom activities: insert by baby member"
  ON public.custom_activity_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (SELECT public.is_baby_member(baby_id))
  );

CREATE POLICY "Custom activities: update by baby member"
  ON public.custom_activity_types
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_baby_member(baby_id)))
  WITH CHECK ((SELECT public.is_baby_member(baby_id)));

CREATE POLICY "Custom activities: delete by baby member"
  ON public.custom_activity_types
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_baby_member(baby_id)));

CREATE TRIGGER trg_custom_activity_types_updated_at
BEFORE UPDATE ON public.custom_activity_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Neue Tabellen werden nicht in allen Supabase-Projekten automatisch fuer
-- die Data API freigegeben. RLS bleibt die zeilenbezogene Schutzschicht.
REVOKE ALL ON public.custom_activity_types FROM anon;
GRANT SELECT, INSERT, DELETE ON public.custom_activity_types TO authenticated;
GRANT UPDATE (
  name,
  emoji,
  color,
  tracking_mode,
  unit,
  default_quantity,
  is_archived
) ON public.custom_activity_types TO authenticated;
GRANT ALL ON public.custom_activity_types TO service_role;

ALTER TABLE public.baby_care_entries
  ADD COLUMN custom_activity_type_id UUID,
  ADD COLUMN custom_name TEXT,
  ADD COLUMN custom_emoji TEXT,
  ADD COLUMN custom_color TEXT,
  ADD COLUMN custom_tracking_mode TEXT,
  ADD COLUMN custom_quantity NUMERIC(12, 3),
  ADD COLUMN custom_unit TEXT;

ALTER TABLE public.baby_care_entries
  DROP CONSTRAINT baby_care_entries_entry_type_check;

-- NOT VALID ueberspringt hier den Scan des Altbestands. Alle Constraints
-- gelten trotzdem sofort fuer neue und geaenderte Datensaetze.
ALTER TABLE public.baby_care_entries
  ADD CONSTRAINT baby_care_entries_custom_activity_baby_fkey
    FOREIGN KEY (custom_activity_type_id, baby_id)
    REFERENCES public.custom_activity_types(id, baby_id)
    ON DELETE SET NULL (custom_activity_type_id)
    NOT VALID,
  ADD CONSTRAINT baby_care_entries_entry_type_check
    CHECK (entry_type IN ('feeding', 'diaper', 'custom'))
    NOT VALID,
  ADD CONSTRAINT baby_care_entries_custom_tracking_mode_check
    CHECK (
      custom_tracking_mode IS NULL
      OR custom_tracking_mode IN ('event', 'quantity', 'duration')
    )
    NOT VALID,
  ADD CONSTRAINT baby_care_entries_custom_quantity_check
    CHECK (
      custom_quantity IS NULL
      OR custom_quantity BETWEEN 0.001 AND 999999999.999
    )
    NOT VALID,
  ADD CONSTRAINT baby_care_entries_custom_snapshot_values_check
    CHECK (
      (custom_name IS NULL OR (
        custom_name = btrim(custom_name)
        AND char_length(custom_name) BETWEEN 1 AND 40
      ))
      AND (custom_emoji IS NULL OR (
        custom_emoji = btrim(custom_emoji)
        AND char_length(custom_emoji) BETWEEN 1 AND 16
      ))
      AND (custom_color IS NULL OR custom_color ~ '^#[0-9A-Fa-f]{6}$')
      AND (custom_unit IS NULL OR (
        custom_unit = btrim(custom_unit)
        AND char_length(custom_unit) BETWEEN 1 AND 20
      ))
    )
    NOT VALID,
  ADD CONSTRAINT baby_care_entries_custom_payload_check
    CHECK (
      (
        entry_type <> 'custom'
        AND custom_activity_type_id IS NULL
        AND custom_name IS NULL
        AND custom_emoji IS NULL
        AND custom_color IS NULL
        AND custom_tracking_mode IS NULL
        AND custom_quantity IS NULL
        AND custom_unit IS NULL
      )
      OR (
        entry_type = 'custom'
        AND baby_id IS NOT NULL
        AND custom_name IS NOT NULL
        AND custom_emoji IS NOT NULL
        AND custom_color IS NOT NULL
        AND custom_tracking_mode IS NOT NULL
        AND (
          (
            custom_tracking_mode = 'quantity'
            AND custom_quantity IS NOT NULL
            AND custom_unit IS NOT NULL
          )
          OR (
            custom_tracking_mode <> 'quantity'
            AND custom_quantity IS NULL
            AND custom_unit IS NULL
          )
        )
      )
    )
    NOT VALID;

COMMENT ON TABLE public.custom_activity_types IS
  'Babybezogene Vorlagen fuer benutzerdefinierte Schnellaktionen im Daily-Tracker.';
COMMENT ON COLUMN public.baby_care_entries.custom_name IS
  'Snapshot des Namens, damit historische Eintraege bei Vorlagenaenderungen stabil bleiben.';

RESET lock_timeout;
