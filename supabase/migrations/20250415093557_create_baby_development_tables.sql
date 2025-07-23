-- Tabelle für Entwicklungsphasen
CREATE TABLE IF NOT EXISTS baby_development_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  age_range TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Meilensteine
CREATE TABLE IF NOT EXISTS baby_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID NOT NULL REFERENCES baby_development_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für den Fortschritt des Babys bei Meilensteinen
CREATE TABLE IF NOT EXISTS baby_milestone_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES baby_milestones(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completion_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, milestone_id)
);

-- Tabelle für die aktuelle Phase des Babys
CREATE TABLE IF NOT EXISTS baby_current_phase (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES baby_development_phases(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Standarddaten für Entwicklungsphasen
INSERT INTO baby_development_phases (phase_number, title, description, age_range)
VALUES 
(1, 'Neugeborenenzeit', 'Die ersten Wochen mit deinem Baby', '0–3 Monate'),
(2, 'Greifen & Lächeln', 'Dein Baby entdeckt seine Hände und lächelt', '4–6 Monate'),
(3, 'Sitzen & Krabbeln', 'Dein Baby wird mobiler', '7–9 Monate'),
(4, 'Stehen & Sprechen', 'Die ersten Schritte und Worte', '10–12 Monate'),
(5, 'Laufen & Entdecken', 'Dein Baby erkundet die Welt', '13–18 Monate'),
(6, 'Sprechen & Verstehen', 'Die Sprachentwicklung nimmt Fahrt auf', '19–24 Monate');

-- Standarddaten für Meilensteine
-- Phase 1: Neugeborenenzeit (0-3 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 1), 'Hebt den Kopf', 'Kann den Kopf kurz anheben, wenn es auf dem Bauch liegt', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 1), 'Fixiert Gesichter', 'Kann Gesichter fokussieren und verfolgen', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 1), 'Erstes Lächeln', 'Zeigt ein erstes soziales Lächeln', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 1), 'Reagiert auf Geräusche', 'Dreht den Kopf in Richtung von Geräuschen', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 1), 'Macht Gurr-Laute', 'Beginnt mit ersten Lautäußerungen', 5);

-- Phase 2: Greifen & Lächeln (4-6 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 2), 'Lächelt aktiv zurück', 'Lächelt als Reaktion auf dein Lächeln', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 2), 'Greift gezielt nach Gegenständen', 'Kann Spielzeug greifen und halten', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 2), 'Verfolgt bewegliche Objekte', 'Kann Objekten mit den Augen folgen', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 2), 'Reagiert auf Geräusche', 'Dreht den Kopf zu Geräuschquellen', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 2), 'Brabbelt', 'Macht erste Sprachversuche durch Brabbeln', 5);

-- Phase 3: Sitzen & Krabbeln (7-9 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 3), 'Sitzt ohne Unterstützung', 'Kann für längere Zeit alleine sitzen', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 3), 'Krabbelt oder robbt', 'Bewegt sich selbstständig fort', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 3), 'Greift mit Daumen und Zeigefinger', 'Entwickelt den Pinzettengriff', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 3), 'Reagiert auf seinen Namen', 'Dreht sich um, wenn es seinen Namen hört', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 3), 'Spielt Guck-Guck-Spiele', 'Versteht einfache Spiele wie Verstecken', 5);

-- Phase 4: Stehen & Sprechen (10-12 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 4), 'Steht mit Unterstützung', 'Kann sich hochziehen und festhalten', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 4), 'Macht erste Schritte', 'Geht an der Hand oder mit Unterstützung', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 4), 'Spricht erste Worte', 'Sagt "Mama", "Papa" oder andere einfache Worte', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 4), 'Versteht einfache Anweisungen', 'Reagiert auf "Nein" oder "Komm her"', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 4), 'Zeigt auf Dinge', 'Kommuniziert durch Zeigen', 5);

-- Phase 5: Laufen & Entdecken (13-18 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 5), 'Läuft alleine', 'Kann selbstständig gehen', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 5), 'Klettert auf Möbel', 'Erkundet die Umgebung durch Klettern', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 5), 'Spricht 5-10 Worte', 'Erweitert seinen Wortschatz', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 5), 'Stapelt Gegenstände', 'Kann Blöcke oder andere Objekte stapeln', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 5), 'Hilft beim Anziehen', 'Streckt Arme und Beine beim Anziehen aus', 5);

-- Phase 6: Sprechen & Verstehen (19-24 Monate)
INSERT INTO baby_milestones (phase_id, title, description, position)
VALUES 
((SELECT id FROM baby_development_phases WHERE phase_number = 6), 'Spricht kurze Sätze', 'Verbindet zwei oder mehr Worte', 1),
((SELECT id FROM baby_development_phases WHERE phase_number = 6), 'Folgt komplexeren Anweisungen', 'Versteht mehrteilige Aufforderungen', 2),
((SELECT id FROM baby_development_phases WHERE phase_number = 6), 'Zeigt Körperteile', 'Kann auf Nase, Augen etc. zeigen', 3),
((SELECT id FROM baby_development_phases WHERE phase_number = 6), 'Malt mit Stiften', 'Kann kritzeln und einfache Striche ziehen', 4),
((SELECT id FROM baby_development_phases WHERE phase_number = 6), 'Spielt Rollenspiele', 'Imitiert Alltagshandlungen im Spiel', 5);

-- Row Level Security für baby_milestone_progress
ALTER TABLE baby_milestone_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own milestone progress" ON baby_milestone_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own milestone progress" ON baby_milestone_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own milestone progress" ON baby_milestone_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own milestone progress" ON baby_milestone_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Row Level Security für baby_current_phase
ALTER TABLE baby_current_phase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own current phase" ON baby_current_phase
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own current phase" ON baby_current_phase
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own current phase" ON baby_current_phase
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own current phase" ON baby_current_phase
  FOR DELETE USING (auth.uid() = user_id);

-- Öffentlicher Zugriff auf Entwicklungsphasen und Meilensteine
ALTER TABLE baby_development_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view development phases" ON baby_development_phases FOR SELECT USING (true);

ALTER TABLE baby_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view milestones" ON baby_milestones FOR SELECT USING (true);

-- Indizes für schnellere Abfragen
CREATE INDEX baby_milestone_progress_user_id_idx ON baby_milestone_progress(user_id);
CREATE INDEX baby_milestone_progress_milestone_id_idx ON baby_milestone_progress(milestone_id);
CREATE INDEX baby_current_phase_user_id_idx ON baby_current_phase(user_id);
CREATE INDEX baby_milestones_phase_id_idx ON baby_milestones(phase_id);
