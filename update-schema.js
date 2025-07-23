// update-schema.js - SQL direkt auf Supabase ausführen
const { createClient } = require('@supabase/supabase-js');

// Umgebungsvariablen laden - müssen manuell gesetzt werden
const SUPABASE_URL = 'DEINE_SUPABASE_URL'; // z.B. 'https://abcdefgh.supabase.co'
const SUPABASE_SERVICE_KEY = 'DEIN_SERVICE_KEY'; // Service-Rolle Key (nicht anon key!)

// SQL für die Table Creation
const SQL = `
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
CREATE INDEX IF NOT EXISTS community_nested_comments_parent_comment_id_idx ON public.community_nested_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS community_nested_comments_user_id_idx ON public.community_nested_comments(user_id);
`;

async function main() {
  // Validieren der Umgebungsvariablen
  if (SUPABASE_URL === 'DEINE_SUPABASE_URL' || SUPABASE_SERVICE_KEY === 'DEIN_SERVICE_KEY') {
    console.error('Fehler: Du musst SUPABASE_URL und SUPABASE_SERVICE_KEY im Script ändern!');
    process.exit(1);
  }

  // Supabase Client mit Admin-Rechten erstellen
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('Führe SQL aus...');
    
    // SQL direkt ausführen
    const { data, error } = await supabase.rpc('pgtle_install', { 
      schema_name: 'public',
      query: SQL
    });
    
    if (error) {
      throw error;
    }
    
    console.log('Die Tabelle community_nested_comments wurde erfolgreich erstellt!');
    console.log('Ergebnis:', data);
  } catch (error) {
    console.error('Fehler bei der Ausführung von SQL:', error);
    
    // Alternative Methode mit SQL via REST API
    try {
      console.log('Versuche alternative Methode mit REST API...');
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          query: SQL
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
      }
      
      console.log('Die Tabelle community_nested_comments wurde erfolgreich erstellt!');
    } catch (restError) {
      console.error('Fehler bei der REST-API-Methode:', restError);
      process.exit(1);
    }
  }
}

main(); 