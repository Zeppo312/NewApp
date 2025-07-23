-- Tabelle für Likes von verschachtelten Kommentaren
CREATE TABLE IF NOT EXISTS public.community_nested_comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nested_comment_id UUID NOT NULL REFERENCES public.community_nested_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Berechtigungen für die Tabelle
ALTER TABLE public.community_nested_comment_likes ENABLE ROW LEVEL SECURITY;

-- Richtlinien für RLS
CREATE POLICY "Jeder kann Likes für verschachtelte Kommentare lesen"
  ON public.community_nested_comment_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Nur angemeldete Benutzer können verschachtelte Kommentare liken"
  ON public.community_nested_comment_likes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Nur der Besitzer kann seinen Like entfernen"
  ON public.community_nested_comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Eindeutiger Index, um mehrfaches Liken zu verhindern
CREATE UNIQUE INDEX community_nested_comment_likes_unique
  ON public.community_nested_comment_likes(nested_comment_id, user_id);

-- Indizes für bessere Performance
CREATE INDEX community_nested_comment_likes_nested_comment_id_idx
  ON public.community_nested_comment_likes(nested_comment_id);
CREATE INDEX community_nested_comment_likes_user_id_idx
  ON public.community_nested_comment_likes(user_id); 