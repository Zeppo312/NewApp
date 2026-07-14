-- Tabelle für FAQ-Kategorien
CREATE TABLE faq_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für FAQ-Einträge
CREATE TABLE faq_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fügen Sie Row-Level-Security (RLS) für die Tabellen hinzu
ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;

-- Erstellen Sie Richtlinien für den Zugriff auf die Tabellen
-- Jeder kann Kategorien und FAQ-Einträge lesen
CREATE POLICY "Jeder kann FAQ-Kategorien lesen" ON faq_categories
  FOR SELECT USING (true);

CREATE POLICY "Jeder kann FAQ-Einträge lesen" ON faq_entries
  FOR SELECT USING (true);

-- Beispieldaten für Kategorien
INSERT INTO faq_categories (name, icon) VALUES
  ('Stillen & Ernährung', 'drop.fill'),
  ('Schlaf & Tagesrhythmus', 'moon.stars.fill'),
  ('Gesundheit & Pflege', 'heart.fill'),
  ('Entwicklung & Meilensteine', 'chart.bar.fill'),
  ('Mama & Papa', 'person.2.fill');

-- Beispieldaten für FAQ-Einträge
-- Wir müssen zuerst die IDs der Kategorien abrufen
DO $$
DECLARE
  stillen_id UUID;
  schlaf_id UUID;
  gesundheit_id UUID;
  entwicklung_id UUID;
  mama_papa_id UUID;
BEGIN
  SELECT id INTO stillen_id FROM faq_categories WHERE name = 'Stillen & Ernährung' LIMIT 1;
  SELECT id INTO schlaf_id FROM faq_categories WHERE name = 'Schlaf & Tagesrhythmus' LIMIT 1;
  SELECT id INTO gesundheit_id FROM faq_categories WHERE name = 'Gesundheit & Pflege' LIMIT 1;
  SELECT id INTO entwicklung_id FROM faq_categories WHERE name = 'Entwicklung & Meilensteine' LIMIT 1;
  SELECT id INTO mama_papa_id FROM faq_categories WHERE name = 'Mama & Papa' LIMIT 1;

  -- FAQ-Einträge für "Stillen & Ernährung"
  INSERT INTO faq_entries (category_id, question, answer, order_number) VALUES
  (stillen_id, 'Wie oft sollte ich mein Neugeborenes stillen?', 'Neugeborene sollten etwa 8-12 Mal innerhalb von 24 Stunden gestillt werden. In den ersten Wochen ist es normal, alle 2-3 Stunden zu stillen, manchmal auch häufiger. Achte auf die Hungersignale deines Babys und nicht strikt auf die Uhr.', 1),
  (stillen_id, 'Woher weiß ich, ob mein Baby genug Milch bekommt?', 'Gute Anzeichen sind: 6-8 nasse Windeln pro Tag, regelmäßiger Stuhlgang, zufriedenes Verhalten nach dem Stillen, und eine stetige Gewichtszunahme. Dein Baby sollte nach der anfänglichen Gewichtsabnahme nach der Geburt wieder zunehmen und sein Geburtsgewicht innerhalb von 10-14 Tagen wieder erreichen.', 2),
  (stillen_id, 'Wann sollte ich mit Beikost beginnen?', 'Die Weltgesundheitsorganisation (WHO) empfiehlt, mit Beikost frühestens ab dem vollendeten 4. Monat, idealerweise ab dem 6. Monat zu beginnen. Achte auf Anzeichen der Bereitschaft: Dein Baby kann aufrecht sitzen, zeigt Interesse an deinem Essen und hat den Zungenstreckreflex verloren.', 3);

  -- FAQ-Einträge für "Schlaf & Tagesrhythmus"
  INSERT INTO faq_entries (category_id, question, answer, order_number) VALUES
  (schlaf_id, 'Wie viel Schlaf braucht mein Baby?', 'Neugeborene schlafen etwa 14-17 Stunden pro Tag, aber in kurzen Phasen von 2-4 Stunden. Mit 3-6 Monaten schlafen Babys etwa 12-15 Stunden, mit längeren Schlafphasen in der Nacht. Mit 6-12 Monaten sind es etwa 11-14 Stunden, mit 2-3 Nickerchen tagsüber.', 1),
  (schlaf_id, 'Wie kann ich meinem Baby helfen, nachts durchzuschlafen?', 'Etabliere eine beruhigende Abendroutine, achte auf Müdigkeitsanzeichen, lege dein Baby wach aber müde ins Bett, und versuche, Tag und Nacht deutlich zu unterscheiden. Bedenke, dass es normal ist, dass Babys in den ersten Monaten nachts aufwachen, um zu trinken.', 2),
  (schlaf_id, 'Ist es normal, dass mein Baby nur auf mir schlafen will?', 'Ja, das ist sehr normal. Babys fühlen sich durch deine Nähe, deinen Herzschlag und deine Wärme sicher und geborgen. Du kannst versuchen, dein Baby nach dem Einschlafen vorsichtig abzulegen oder Tragehilfen nutzen, um die Hände frei zu haben. Mit der Zeit wird dein Baby lernen, auch alleine zu schlafen.', 3);

  -- FAQ-Einträge für "Gesundheit & Pflege"
  INSERT INTO faq_entries (category_id, question, answer, order_number) VALUES
  (gesundheit_id, 'Wie oft sollte ich mein Baby baden?', 'Neugeborene müssen nicht täglich gebadet werden. 2-3 Mal pro Woche ist ausreichend, um die Haut nicht auszutrocknen. Achte auf eine gründliche Reinigung der Hautfalten, des Gesichts und des Windelbereichs bei jedem Windelwechsel.', 1),
  (gesundheit_id, 'Wann sollten die ersten Impfungen erfolgen?', 'In Deutschland beginnen die Standardimpfungen in der Regel ab dem Alter von 2 Monaten. Die STIKO (Ständige Impfkommission) empfiehlt einen Impfplan, der Schutz gegen verschiedene Krankheiten wie Rotaviren, Tetanus, Diphtherie, Keuchhusten und andere bietet. Sprich mit deinem Kinderarzt über den individuellen Impfplan für dein Baby.', 2),
  (gesundheit_id, 'Was tun bei Fieber beim Baby?', 'Bei Babys unter 3 Monaten gilt jede erhöhte Temperatur über 38°C als Grund, sofort den Arzt aufzusuchen. Bei älteren Babys kannst du bei leichtem Fieber (bis 38,5°C) zunächst beobachten, viel Flüssigkeit anbieten und leichte Kleidung anziehen. Bei höherem Fieber, Teilnahmslosigkeit oder wenn das Fieber länger als 24 Stunden anhält, solltest du einen Arzt konsultieren.', 3);

  -- FAQ-Einträge für "Entwicklung & Meilensteine"
  INSERT INTO faq_entries (category_id, question, answer, order_number) VALUES
  (entwicklung_id, 'Wann sollte mein Baby anfangen zu lächeln?', 'Das erste soziale Lächeln erscheint in der Regel zwischen der 6. und 8. Lebenswoche. Vorher können Babys auch lächeln, aber dies ist meist reflexartig und nicht als soziale Reaktion zu verstehen.', 1),
  (entwicklung_id, 'Wann lernt mein Baby, sich umzudrehen?', 'Die meisten Babys beginnen zwischen 4 und 6 Monaten, sich vom Bauch auf den Rücken zu drehen. Das Drehen vom Rücken auf den Bauch folgt oft etwas später, zwischen 5 und 7 Monaten. Wie bei allen Entwicklungsschritten gibt es jedoch große individuelle Unterschiede.', 2),
  (entwicklung_id, 'Wann sollte mein Baby anfangen zu krabbeln?', 'Die meisten Babys beginnen zwischen 7 und 10 Monaten zu krabbeln. Manche Babys überspringen das Krabbeln jedoch komplett und gehen direkt zum Hochziehen und Laufen über. Andere entwickeln alternative Fortbewegungsmethoden wie Robben oder Rollen.', 3);

  -- FAQ-Einträge für "Mama & Papa"
  INSERT INTO faq_entries (category_id, question, answer, order_number) VALUES
  (mama_papa_id, 'Wie lange dauert es, bis sich mein Körper nach der Geburt erholt hat?', 'Die körperliche Erholung nach der Geburt dauert etwa 6-8 Wochen (das sogenannte Wochenbett). In dieser Zeit bildet sich die Gebärmutter zurück und die Wunde, die durch die Plazenta entstanden ist, heilt. Die vollständige Erholung, besonders nach einem Kaiserschnitt oder einer komplizierten Geburt, kann jedoch mehrere Monate dauern.', 1),
  (mama_papa_id, 'Wie können wir unsere Partnerschaft nach der Geburt pflegen?', 'Kommunikation ist entscheidend. Sprecht offen über eure Gefühle, Bedürfnisse und Ängste. Plant bewusst Zeit zu zweit ein, auch wenn es nur kurze Momente sind. Teilt euch die Babybetreuung und Haushaltsaufgaben fair auf und unterstützt euch gegenseitig. Habt Verständnis füreinander, denn beide Partner durchleben eine große Umstellung.', 2),
  (mama_papa_id, 'Wie erkenne ich eine postpartale Depression?', 'Anzeichen können anhaltende Traurigkeit, Erschöpfung, Schlafprobleme, Appetitlosigkeit, Gefühle der Überforderung, Schuldgefühle und Gedanken, sich selbst oder dem Baby zu schaden, sein. Im Gegensatz zum Baby-Blues, der nach einigen Tagen abklingt, hält eine postpartale Depression länger an und beeinträchtigt den Alltag. Bei Verdacht solltest du unbedingt professionelle Hilfe suchen.', 3);
END $$;
