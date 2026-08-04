-- Store generated translations separately from the German source data.
CREATE TABLE IF NOT EXISTS public.baby_name_translations (
  baby_name_id UUID NOT NULL REFERENCES public.baby_names(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  meaning TEXT,
  origin TEXT,
  source_meaning TEXT,
  source_origin TEXT,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (baby_name_id, locale)
);

COMMENT ON TABLE public.baby_name_translations IS
  'Cached English and Spanish translations of the German baby_names source fields.';
COMMENT ON COLUMN public.baby_name_translations.source_meaning IS
  'German meaning used to generate this translation; used to ignore stale translations.';
COMMENT ON COLUMN public.baby_name_translations.source_origin IS
  'German origin used to generate this translation; used to ignore stale translations.';

CREATE INDEX IF NOT EXISTS baby_name_translations_locale_baby_name_idx
  ON public.baby_name_translations(locale, baby_name_id);

ALTER TABLE public.baby_name_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Baby name translations are readable" ON public.baby_name_translations;
CREATE POLICY "Baby name translations are readable"
  ON public.baby_name_translations
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can insert baby name translations" ON public.baby_name_translations;
CREATE POLICY "Admins can insert baby name translations"
  ON public.baby_name_translations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can update baby name translations" ON public.baby_name_translations;
CREATE POLICY "Admins can update baby name translations"
  ON public.baby_name_translations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can delete baby name translations" ON public.baby_name_translations;
CREATE POLICY "Admins can delete baby name translations"
  ON public.baby_name_translations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

GRANT SELECT ON public.baby_name_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.baby_name_translations TO authenticated;

-- Keep filtering, localized search, and pagination on the database so the app
-- never has to load all 5,000 names just to search translated fields.
CREATE OR REPLACE FUNCTION public.search_localized_baby_names(
  p_locale TEXT DEFAULT 'de',
  p_gender TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_letter TEXT DEFAULT NULL,
  p_favorite_names TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 40,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  meaning TEXT,
  origin TEXT,
  gender TEXT
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    baby_names.id,
    baby_names.name,
    CASE
      WHEN p_locale IN ('en', 'es') THEN COALESCE(translations.meaning, baby_names.meaning)
      ELSE baby_names.meaning
    END AS meaning,
    CASE
      WHEN p_locale IN ('en', 'es') THEN COALESCE(translations.origin, baby_names.origin)
      ELSE baby_names.origin
    END AS origin,
    baby_names.gender
  FROM public.baby_names
  LEFT JOIN public.baby_name_translations AS translations
    ON translations.baby_name_id = baby_names.id
   AND translations.locale = p_locale
   AND translations.source_meaning IS NOT DISTINCT FROM baby_names.meaning
   AND translations.source_origin IS NOT DISTINCT FROM baby_names.origin
  WHERE (p_gender IS NULL OR baby_names.gender = p_gender)
    AND (p_favorite_names IS NULL OR baby_names.name = ANY(p_favorite_names))
    AND (
      NULLIF(BTRIM(p_search), '') IS NULL
      OR baby_names.name ILIKE '%' || BTRIM(p_search) || '%'
      OR CASE
        WHEN p_locale IN ('en', 'es') THEN COALESCE(translations.meaning, baby_names.meaning, '')
        ELSE COALESCE(baby_names.meaning, '')
      END ILIKE '%' || BTRIM(p_search) || '%'
      OR CASE
        WHEN p_locale IN ('en', 'es') THEN COALESCE(translations.origin, baby_names.origin, '')
        ELSE COALESCE(baby_names.origin, '')
      END ILIKE '%' || BTRIM(p_search) || '%'
    )
    AND (
      NULLIF(BTRIM(p_letter), '') IS NULL
      OR baby_names.name ILIKE BTRIM(p_letter) || '%'
    )
  ORDER BY baby_names.name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.search_localized_baby_names(
  TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_localized_baby_names(
  TEXT, TEXT, TEXT, TEXT, TEXT[], INTEGER, INTEGER
) TO anon, authenticated;
