ALTER TABLE public.wiki_articles
ADD COLUMN IF NOT EXISTS cover_image_url text;
