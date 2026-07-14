-- Admin policies for wiki articles
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Admins can insert wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Admins can update wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Admins can delete wiki articles" ON public.wiki_articles;

CREATE POLICY "Public can read wiki articles"
  ON public.wiki_articles
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert wiki articles"
  ON public.wiki_articles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE POLICY "Admins can update wiki articles"
  ON public.wiki_articles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete wiki articles"
  ON public.wiki_articles
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );