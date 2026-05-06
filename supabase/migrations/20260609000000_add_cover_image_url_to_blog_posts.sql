-- Stelle sicher, dass blog_posts eine cover_image_url Spalte besitzt
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.blog_posts.cover_image_url IS 'Optionales Cover-Bild für Blogposts';
