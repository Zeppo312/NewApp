-- Tabelle für verschachtelte Kommentare (Antworten auf Kommentare)
CREATE TABLE IF NOT EXISTS public.community_nested_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_comment_id UUID NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Berechtigungen für die Tabelle
ALTER TABLE public.community_nested_comments ENABLE ROW LEVEL SECURITY;

-- Richtlinien für RLS
CREATE POLICY "Jeder kann verschachtelte Kommentare lesen"
  ON public.community_nested_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Nur angemeldete Benutzer können verschachtelte Kommentare erstellen"
  ON public.community_nested_comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Nur der Besitzer kann verschachtelte Kommentare löschen"
  ON public.community_nested_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indizes für bessere Performance
CREATE INDEX community_nested_comments_parent_comment_id_idx ON public.community_nested_comments(parent_comment_id);
CREATE INDEX community_nested_comments_user_id_idx ON public.community_nested_comments(user_id); 