-- Tabelle für Wiki-Kategorien
CREATE TABLE wiki_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Wiki-Artikel
CREATE TABLE wiki_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES wiki_categories(id) ON DELETE CASCADE,
  teaser TEXT NOT NULL,
  reading_time TEXT NOT NULL,
  content JSONB, -- Für strukturierten Inhalt (coreStatements und sections)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Benutzer-Favoriten
CREATE TABLE wiki_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES wiki_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Fügen Sie Row-Level-Security (RLS) für die Tabellen hinzu
ALTER TABLE wiki_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_favorites ENABLE ROW LEVEL SECURITY;

-- Erstellen Sie Richtlinien für den Zugriff auf die Tabellen
-- Jeder kann Kategorien und Artikel lesen
CREATE POLICY "Jeder kann Kategorien lesen" ON wiki_categories
  FOR SELECT USING (true);

CREATE POLICY "Jeder kann Artikel lesen" ON wiki_articles
  FOR SELECT USING (true);

-- Nur authentifizierte Benutzer können ihre eigenen Favoriten verwalten
CREATE POLICY "Benutzer können ihre eigenen Favoriten lesen" ON wiki_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können ihre eigenen Favoriten erstellen" ON wiki_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können ihre eigenen Favoriten löschen" ON wiki_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Beispieldaten für Kategorien
INSERT INTO wiki_categories (name, icon) VALUES
  ('Stillen & Ernährung', 'drop.fill'),
  ('Schlaf & Tagesrhythmus', 'moon.stars.fill'),
  ('Gesundheit & Pflege', 'heart.fill'),
  ('Entwicklung & Meilensteine', 'chart.bar.fill'),
  ('Mama & Papa', 'person.2.fill');

-- Beispieldaten für Artikel
-- Wir müssen zuerst die IDs der Kategorien abrufen
DO $$
DECLARE
  stillen_id UUID;
  schlaf_id UUID;
  gesundheit_id UUID;
  entwicklung_id UUID;
  mama_papa_id UUID;
BEGIN
  SELECT id INTO stillen_id FROM wiki_categories WHERE name = 'Stillen & Ernährung' LIMIT 1;
  SELECT id INTO schlaf_id FROM wiki_categories WHERE name = 'Schlaf & Tagesrhythmus' LIMIT 1;
  SELECT id INTO gesundheit_id FROM wiki_categories WHERE name = 'Gesundheit & Pflege' LIMIT 1;
  SELECT id INTO entwicklung_id FROM wiki_categories WHERE name = 'Entwicklung & Meilensteine' LIMIT 1;
  SELECT id INTO mama_papa_id FROM wiki_categories WHERE name = 'Mama & Papa' LIMIT 1;

  -- Artikel für "Stillen & Ernährung"
  INSERT INTO wiki_articles (title, category_id, teaser, reading_time, content) VALUES
  ('Stillen für Anfängerinnen', stillen_id, 'Die wichtigsten Grundlagen zum erfolgreichen Stillen deines Babys.', '5 Min', 
   '{
     "coreStatements": [
       "Stillen ist die natürlichste Form der Ernährung für dein Baby",
       "Die richtige Anlegetechnik ist entscheidend für erfolgreiches Stillen",
       "Bei Problemen kann eine Stillberaterin helfen"
     ],
     "sections": [
       {
         "title": "Die richtige Anlegetechnik",
         "content": "Achte darauf, dass dein Baby den Mund weit öffnet und möglichst viel vom Warzenhof erfasst. Die Nase und das Kinn deines Babys sollten die Brust berühren."
       },
       {
         "title": "Stillpositionen",
         "content": "Es gibt verschiedene Stillpositionen wie die Wiegehaltung, die Rückengriffhaltung oder die Seitenlage. Probiere verschiedene Positionen aus, um herauszufinden, welche für dich und dein Baby am bequemsten ist."
       }
     ]
   }'::jsonb),
  ('Beikost einführen', stillen_id, 'Der richtige Zeitpunkt und die besten ersten Lebensmittel.', '8 Min', 
   '{
     "coreStatements": [
       "Beikost sollte frühestens ab dem 5. Monat eingeführt werden",
       "Beginne mit einzelnen, pürrierten Lebensmitteln",
       "Beobachte dein Baby auf Unverträglichkeiten"
     ],
     "sections": [
       {
         "title": "Der richtige Zeitpunkt",
         "content": "Die meisten Babys sind zwischen dem 5. und 6. Monat bereit für Beikost. Achte auf Anzeichen wie Interesse am Essen der Eltern, gute Kopfkontrolle und das Verschwinden des Zungenstreckreflex."
       },
       {
         "title": "Die ersten Lebensmittel",
         "content": "Gut geeignet sind Gemüsesorten wie Karotte, Pastinake oder Kürbis. Püriere sie weich und verdünne sie anfangs mit etwas Muttermilch oder Wasser."
       }
     ]
   }'::jsonb);

  -- Artikel für "Schlaf & Tagesrhythmus"
  INSERT INTO wiki_articles (title, category_id, teaser, reading_time, content) VALUES
  ('Schlafrhythmus im ersten Monat', schlaf_id, 'So findest du einen sanften Rhythmus für dein Neugeborenes.', '4 Min', 
   '{
     "coreStatements": [
       "Neugeborene haben noch keinen Tag-Nacht-Rhythmus",
       "Ein Baby schläft 14-17 Stunden täglich, aber in kurzen Phasen",
       "Regelmäßige Abläufe helfen, einen Rhythmus zu entwickeln"
     ],
     "sections": [
       {
         "title": "Schlafphasen verstehen",
         "content": "Neugeborene durchlaufen kürzere Schlafzyklen als Erwachsene und wachen daher häufiger auf. Das ist völlig normal und dient dem Überleben."
       },
       {
         "title": "Tag-Nacht-Rhythmus fördern",
         "content": "Tagsüber normal im Haushalt agieren, nachts gedämpftes Licht und ruhige Stimme verwenden. So lernt dein Baby mit der Zeit den Unterschied zwischen Tag und Nacht."
       }
     ]
   }'::jsonb);

  -- Artikel für "Gesundheit & Pflege"
  INSERT INTO wiki_articles (title, category_id, teaser, reading_time, content) VALUES
  ('Nabelschnurpflege', gesundheit_id, 'So pflegst du den Nabelschnurrest richtig, bis er abfällt.', '3 Min', 
   '{
     "coreStatements": [
       "Der Nabelschnurrest fällt normalerweise innerhalb von 5-15 Tagen ab",
       "Halte den Nabelbereich sauber und trocken",
       "Bei Rötungen, Schwellungen oder Geruch einen Arzt aufsuchen"
     ],
     "sections": [
       {
         "title": "Tägliche Pflege",
         "content": "Reinige den Nabelbereich täglich mit klarem Wasser und einem sauberen Wattestäbchen. Trockne ihn anschließend vorsichtig ab."
       },
       {
         "title": "Windeln anlegen",
         "content": "Falte die Windel unter dem Nabel um, damit der Nabelschnurrest frei liegt und gut trocknen kann."
       }
     ]
   }'::jsonb);

  -- Artikel für "Entwicklung & Meilensteine"
  INSERT INTO wiki_articles (title, category_id, teaser, reading_time, content) VALUES
  ('Die ersten Meilensteine', entwicklung_id, 'Diese Entwicklungsschritte erwarten dich in den ersten drei Monaten.', '6 Min', 
   '{
     "coreStatements": [
       "Jedes Baby entwickelt sich in seinem eigenen Tempo",
       "Die ersten Meilensteine umfassen Kopfheben, Lächeln und Greifen",
       "Regelmäßige Interaktion fördert die Entwicklung"
     ],
     "sections": [
       {
         "title": "1. Monat",
         "content": "Dein Baby kann seinen Kopf kurz anheben, wenn es auf dem Bauch liegt, und beginnt, Gesichter zu fokussieren."
       },
       {
         "title": "2. Monat",
         "content": "Das erste soziale Lächeln erscheint, und dein Baby beginnt, auf Geräusche zu reagieren und den Kopf zur Geräuschquelle zu drehen."
       },
       {
         "title": "3. Monat",
         "content": "Dein Baby kann den Kopf stabiler halten, beginnt nach Objekten zu greifen und gibt erste Gurr-Laute von sich."
       }
     ]
   }'::jsonb);

  -- Artikel für "Mama & Papa"
  INSERT INTO wiki_articles (title, category_id, teaser, reading_time, content) VALUES
  ('Wochenbett überstehen', mama_papa_id, 'Tipps für die herausfordernde Zeit nach der Geburt.', '7 Min', 
   '{
     "coreStatements": [
       "Das Wochenbett dauert etwa 6-8 Wochen",
       "Ruhe und Erholung sind in dieser Zeit besonders wichtig",
       "Nimm Hilfe an und setze Prioritäten"
     ],
     "sections": [
       {
         "title": "Körperliche Erholung",
         "content": "Dein Körper braucht Zeit, um sich von der Geburt zu erholen. Achte auf ausreichend Ruhe, gesunde Ernährung und trinke viel Wasser."
       },
       {
         "title": "Emotionale Achterbahn",
         "content": "Stimmungsschwankungen sind normal. Der Babyblues tritt bei vielen Frauen am 3.-5. Tag nach der Geburt auf und klingt meist nach einigen Tagen wieder ab."
       },
       {
         "title": "Hilfe organisieren",
         "content": "Nimm Unterstützung von Partner, Familie und Freunden an. Organisiere im Vorfeld Hilfe für Haushalt, Einkäufe und Mahlzeiten."
       }
     ]
   }'::jsonb),
  ('Baby-Blues und postpartale Depression', mama_papa_id, 'Unterschiede erkennen und Hilfe finden.', '5 Min', 
   '{
     "coreStatements": [
       "Der Baby-Blues ist vorübergehend, eine postpartale Depression nicht",
       "Etwa 10-15% aller Mütter entwickeln eine postpartale Depression",
       "Professionelle Hilfe ist wichtig und wirksam"
     ],
     "sections": [
       {
         "title": "Baby-Blues vs. postpartale Depression",
         "content": "Der Baby-Blues dauert wenige Tage und äußert sich in Stimmungsschwankungen und Weinerlichkeit. Eine postpartale Depression hält länger an, ist intensiver und beeinträchtigt den Alltag."
       },
       {
         "title": "Anzeichen einer postpartalen Depression",
         "content": "Anhaltende Traurigkeit, Erschöpfung, Schlafprobleme, Appetitlosigkeit, Gefühle der Überforderung, Schuldgefühle und Gedanken, sich selbst oder dem Baby zu schaden."
       },
       {
         "title": "Hilfe finden",
         "content": "Sprich mit deinem Arzt, deiner Hebamme oder suche direkt psychologische Hilfe. Selbsthilfegruppen und Beratungsstellen können ebenfalls unterstützen."
       }
     ]
   }'::jsonb);
END $$;
