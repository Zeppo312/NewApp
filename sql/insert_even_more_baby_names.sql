-- Erstelle eine Tabelle für Babynamen, falls sie noch nicht existiert
CREATE TABLE IF NOT EXISTS baby_names (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  meaning TEXT NOT NULL,
  origin TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'unisex')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stelle sicher, dass jeder Name nur einmal vorkommt
  CONSTRAINT unique_name UNIQUE (name)
);

-- Erstelle eine Row Level Security Policy, damit alle Benutzer die Namen sehen können
ALTER TABLE baby_names ENABLE ROW LEVEL SECURITY;

-- Policy für Lesen (SELECT) - Alle können lesen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Anyone can view baby names'
  ) THEN
    CREATE POLICY "Anyone can view baby names"
      ON baby_names
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Policy für Einfügen (INSERT) - Nur Administratoren können Namen hinzufügen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Only admins can add baby names'
  ) THEN
    CREATE POLICY "Only admins can add baby names"
      ON baby_names
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END
$$;

-- Policy für Aktualisieren (UPDATE) - Nur Administratoren können Namen aktualisieren
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Only admins can update baby names'
  ) THEN
    CREATE POLICY "Only admins can update baby names"
      ON baby_names
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END
$$;

-- Policy für Löschen (DELETE) - Nur Administratoren können Namen löschen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Only admins can delete baby names'
  ) THEN
    CREATE POLICY "Only admins can delete baby names"
      ON baby_names
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END
$$;

-- Einfügen von 250 weiteren Babynamen mit ON CONFLICT DO NOTHING, um doppelte Namen zu überspringen
INSERT INTO baby_names (name, meaning, origin, gender) VALUES
-- Weitere Jungennamen (100 Namen)
('Aiden', 'Kleines Feuer', 'Irisch', 'male'),
('Brayden', 'Der Breite', 'Irisch', 'male'),
('Caleb', 'Treuer Hund', 'Hebräisch', 'male'),
('Declan', 'Mann des Gebets', 'Irisch', 'male'),
('Ethan', 'Der Beständige', 'Hebräisch', 'male'),
('Finn', 'Der Helle', 'Irisch', 'male'),
('Gavin', 'Der Falke', 'Walisisch', 'male'),
('Hudson', 'Sohn von Hugh', 'Englisch', 'male'),
('Isaiah', 'Gott ist Heil', 'Hebräisch', 'male'),
('Jaxon', 'Gott ist gnädig', 'Englisch', 'male'),
('Kayden', 'Kämpfer', 'Arabisch', 'male'),
('Landon', 'Der lange Hügel', 'Altenglisch', 'male'),
('Mason', 'Der Steinmetz', 'Englisch', 'male'),
('Nolan', 'Der Berühmte', 'Irisch', 'male'),
('Owen', 'Der junge Krieger', 'Walisisch', 'male'),
('Parker', 'Der Parkwächter', 'Englisch', 'male'),
('Quincy', 'Der Fünfte', 'Lateinisch', 'male'),
('Ryder', 'Der Reiter', 'Englisch', 'male'),
('Sawyer', 'Der Holzfäller', 'Englisch', 'male'),
('Tristan', 'Der Traurige', 'Keltisch', 'male'),
('Uriah', 'Gott ist mein Licht', 'Hebräisch', 'male'),
('Vaughn', 'Der Kleine', 'Walisisch', 'male'),
('Wesley', 'Westliche Wiese', 'Altenglisch', 'male'),
('Xavier', 'Der neue Hausherr', 'Baskisch', 'male'),
('Yusuf', 'Gott vermehre', 'Arabisch', 'male'),
('Zane', 'Gottes Geschenk', 'Hebräisch', 'male'),
('Axel', 'Quelle des Friedens', 'Skandinavisch', 'male'),
('Beckett', 'Bienenstock', 'Altenglisch', 'male'),
('Camden', 'Gewundenes Tal', 'Schottisch', 'male'),
('Dawson', 'Sohn des David', 'Walisisch', 'male'),
('Easton', 'Östliche Stadt', 'Altenglisch', 'male'),
('Flynn', 'Sohn des Rothaarigen', 'Irisch', 'male'),
('Greyson', 'Sohn des Grauhaarigen', 'Englisch', 'male'),
('Holden', 'Tiefe Höhle', 'Altenglisch', 'male'),
('Ivan', 'Gottes Geschenk', 'Russisch', 'male'),
('Jett', 'Schwarzer Edelstein', 'Englisch', 'male'),
('Knox', 'Runder Hügel', 'Schottisch', 'male'),
('Lincoln', 'Siedlung am Teich', 'Altenglisch', 'male'),
('Maddox', 'Sohn des Maddock', 'Walisisch', 'male'),
('Nash', 'Bei der Esche', 'Altenglisch', 'male'),
('Orion', 'Der Jäger', 'Griechisch', 'male'),
('Phoenix', 'Purpurrot', 'Griechisch', 'male'),
('Quade', 'Der Vierte', 'Lateinisch', 'male'),
('Ronan', 'Kleiner Seehund', 'Irisch', 'male'),
('Silas', 'Waldmensch', 'Lateinisch', 'male'),
('Tate', 'Fröhlich', 'Altnordisch', 'male'),
('Uriel', 'Gott ist mein Licht', 'Hebräisch', 'male'),
('Vance', 'Sumpfgebiet', 'Altenglisch', 'male'),
('Wilder', 'Jäger', 'Altenglisch', 'male'),
('Xander', 'Verteidiger der Menschen', 'Griechisch', 'male'),
('Yosef', 'Gott vermehre', 'Hebräisch', 'male'),
('Zayn', 'Schönheit', 'Arabisch', 'male'),
('August', 'Der Erhabene', 'Lateinisch', 'male'),
('Bodhi', 'Erleuchtung', 'Sanskrit', 'male'),
('Colt', 'Junges Pferd', 'Englisch', 'male'),
('Dexter', 'Rechtshändig', 'Lateinisch', 'male'),
('Emmett', 'Universell', 'Germanisch', 'male'),
('Forrest', 'Waldbewohner', 'Französisch', 'male'),
('Griffin', 'Starker Herr', 'Walisisch', 'male'),
('Hendrix', 'Herrscher des Hauses', 'Germanisch', 'male'),
('Iker', 'Besuch', 'Baskisch', 'male'),
('Jude', 'Gelobt', 'Hebräisch', 'male'),
('Keegan', 'Sohn des Feuergeborenen', 'Irisch', 'male'),
('Lennon', 'Liebhaber', 'Irisch', 'male'),
('Miller', 'Müller', 'Altenglisch', 'male'),
('Nixon', 'Sohn des Nicholas', 'Englisch', 'male'),
('Odin', 'Raserei, Ekstase', 'Altnordisch', 'male'),
('Porter', 'Türhüter', 'Französisch', 'male'),
('Quinn', 'Weiser Anführer', 'Irisch', 'male'),
('Rhett', 'Ratgeber', 'Walisisch', 'male'),
('Sterling', 'Von hohem Wert', 'Altenglisch', 'male'),
('Thatcher', 'Dachdecker', 'Altenglisch', 'male'),
('Ulysses', 'Der Zürnende', 'Griechisch', 'male'),
('Vincent', 'Der Siegreiche', 'Lateinisch', 'male'),
('Waylon', 'Straßenland', 'Altenglisch', 'male'),
('Xavi', 'Der neue Hausherr', 'Baskisch', 'male'),
('York', 'Eibendorf', 'Altenglisch', 'male'),
('Zeke', 'Gott stärkt', 'Hebräisch', 'male'),
('Atticus', 'Der Athener', 'Griechisch', 'male'),
('Bowen', 'Sohn des Owen', 'Walisisch', 'male'),
('Callum', 'Taube', 'Schottisch', 'male'),
('Dax', 'Der Anführer', 'Französisch', 'male'),
('Ellis', 'Freundlich', 'Walisisch', 'male'),
('Ford', 'Flussdurchgang', 'Altenglisch', 'male'),
('Gael', 'Großzügig', 'Keltisch', 'male'),
('Hayes', 'Hecke', 'Altenglisch', 'male'),
('Ira', 'Wachsam', 'Hebräisch', 'male'),
('Jax', 'Gott ist gnädig', 'Amerikanisch', 'male'),
('Koa', 'Krieger', 'Hawaiianisch', 'male'),
('Levi', 'Verbunden', 'Hebräisch', 'male'),
('Milo', 'Gnädig', 'Germanisch', 'male'),
('Nico', 'Sieg des Volkes', 'Griechisch', 'male'),
('Otto', 'Wohlhabend', 'Germanisch', 'male'),
('Pierce', 'Fels', 'Englisch', 'male'),

-- Weitere Mädchennamen (100 Namen)
('Aria', 'Melodie', 'Italienisch', 'female'),
('Brooklyn', 'Wasserbach', 'Englisch', 'female'),
('Chloe', 'Blühend', 'Griechisch', 'female'),
('Daisy', 'Gänseblümchen', 'Englisch', 'female'),
('Everly', 'Wildschweinlichtung', 'Altenglisch', 'female'),
('Faith', 'Vertrauen', 'Lateinisch', 'female'),
('Grace', 'Anmut', 'Lateinisch', 'female'),
('Harper', 'Harfenspielerin', 'Altenglisch', 'female'),
('Isla', 'Insel', 'Schottisch', 'female'),
('Jade', 'Grüner Edelstein', 'Spanisch', 'female'),
('Kinsley', 'Königswiese', 'Altenglisch', 'female'),
('Luna', 'Mond', 'Lateinisch', 'female'),
('Madison', 'Sohn des Maud', 'Englisch', 'female'),
('Nova', 'Neu', 'Lateinisch', 'female'),
('Olivia', 'Olive', 'Lateinisch', 'female'),
('Paisley', 'Kirchengebiet', 'Schottisch', 'female'),
('Quinn', 'Weise', 'Irisch', 'female'),
('Riley', 'Roggenwiese', 'Irisch', 'female'),
('Scarlett', 'Scharlachrot', 'Englisch', 'female'),
('Tessa', 'Die Erntende', 'Griechisch', 'female'),
('Uma', 'Nation', 'Sanskrit', 'female'),
('Violet', 'Violett', 'Lateinisch', 'female'),
('Willow', 'Weide', 'Altenglisch', 'female'),
('Ximena', 'Die Hörende', 'Spanisch', 'female'),
('Yasmin', 'Jasminblüte', 'Persisch', 'female'),
('Zuri', 'Schön', 'Swahili', 'female'),
('Adalyn', 'Adelig', 'Germanisch', 'female'),
('Brielle', 'Gott ist meine Stärke', 'Französisch', 'female'),
('Callie', 'Schönste', 'Griechisch', 'female'),
('Delilah', 'Zarte Schönheit', 'Hebräisch', 'female'),
('Eloise', 'Gesunde Kriegerin', 'Französisch', 'female'),
('Finley', 'Heller Krieger', 'Irisch', 'female'),
('Genevieve', 'Frau des Volkes', 'Französisch', 'female'),
('Harlow', 'Felsige Anhöhe', 'Altenglisch', 'female'),
('Ivy', 'Efeu', 'Altenglisch', 'female'),
('Juniper', 'Wacholder', 'Lateinisch', 'female'),
('Kenzie', 'Die Schöne', 'Schottisch', 'female'),
('Lyla', 'Nacht', 'Arabisch', 'female'),
('Maeve', 'Die Berauschende', 'Irisch', 'female'),
('Nora', 'Ehre', 'Lateinisch', 'female'),
('Oakley', 'Eichenwiese', 'Altenglisch', 'female'),
('Piper', 'Flötenspielerin', 'Englisch', 'female'),
('Quinn', 'Weise', 'Irisch', 'female'),
('Raelyn', 'Anmutig', 'Amerikanisch', 'female'),
('Sage', 'Weise', 'Lateinisch', 'female'),
('Thea', 'Göttin', 'Griechisch', 'female'),
('Unity', 'Einheit', 'Lateinisch', 'female'),
('Vivienne', 'Lebendig', 'Französisch', 'female'),
('Winter', 'Winterzeit', 'Altenglisch', 'female'),
('Xiomara', 'Bereit zum Kampf', 'Spanisch', 'female'),
('Yara', 'Kleine Perle', 'Arabisch', 'female'),
('Zara', 'Prinzessin', 'Arabisch', 'female'),
('Amara', 'Ewig', 'Griechisch', 'female'),
('Blair', 'Feld', 'Schottisch', 'female'),
('Collins', 'Sohn des Colin', 'Irisch', 'female'),
('Demi', 'Halb', 'Französisch', 'female'),
('Eden', 'Wonne', 'Hebräisch', 'female'),
('Fiona', 'Weiß', 'Gälisch', 'female'),
('Georgia', 'Landwirtin', 'Griechisch', 'female'),
('Haven', 'Zufluchtsort', 'Altenglisch', 'female'),
('Iris', 'Regenbogen', 'Griechisch', 'female'),
('Juliet', 'Jugendlich', 'Französisch', 'female'),
('Kaia', 'Meer', 'Hawaiianisch', 'female'),
('Lennox', 'Mit vielen Linden', 'Schottisch', 'female'),
('Margot', 'Perle', 'Französisch', 'female'),
('Nadia', 'Hoffnung', 'Russisch', 'female'),
('Octavia', 'Die Achte', 'Lateinisch', 'female'),
('Paige', 'Junge Dienerin', 'Griechisch', 'female'),
('Quincy', 'Fünfte', 'Lateinisch', 'female'),
('Rosalie', 'Rose', 'Französisch', 'female'),
('Sloane', 'Kriegerin', 'Irisch', 'female'),
('Talia', 'Tau vom Himmel', 'Hebräisch', 'female'),
('Uma', 'Nation', 'Sanskrit', 'female'),
('Vera', 'Glaube', 'Russisch', 'female'),
('Wren', 'Zaunkönig', 'Altenglisch', 'female'),
('Xena', 'Gastfreundlich', 'Griechisch', 'female'),
('Yuna', 'Freundlich', 'Japanisch', 'female'),
('Zelda', 'Gesegnet', 'Germanisch', 'female'),
('Aurelia', 'Die Goldene', 'Lateinisch', 'female'),
('Brynn', 'Hügel', 'Walisisch', 'female'),
('Celine', 'Himmlisch', 'Französisch', 'female'),
('Dahlia', 'Blume', 'Schwedisch', 'female'),
('Esme', 'Geliebt', 'Französisch', 'female'),
('Freya', 'Edle Frau', 'Nordisch', 'female'),
('Gemma', 'Edelstein', 'Italienisch', 'female'),
('Holland', 'Waldland', 'Niederländisch', 'female'),
('Indie', 'Unabhängig', 'Englisch', 'female'),
('Jolie', 'Hübsch', 'Französisch', 'female'),
('Kira', 'Sonne', 'Persisch', 'female'),
('Leilani', 'Himmlische Blume', 'Hawaiianisch', 'female'),
('Maren', 'Stern des Meeres', 'Lateinisch', 'female'),
('Noelle', 'Weihnachten', 'Französisch', 'female'),
('Ophelia', 'Hilfe', 'Griechisch', 'female'),
('Poppy', 'Mohnblume', 'Lateinisch', 'female'),
('Quinley', 'Königswiese', 'Englisch', 'female'),
('Remi', 'Ruderer', 'Französisch', 'female'),
('Sutton', 'Aus der Südstadt', 'Altenglisch', 'female'),
('Tatum', 'Fröhlicher Bringer', 'Altenglisch', 'female'),

-- Weitere Unisex-Namen (50 Namen)
('Addison', 'Sohn des Adam', 'Englisch', 'unisex'),
('Briar', 'Dornbusch', 'Englisch', 'unisex'),
('Campbell', 'Schiefmund', 'Schottisch', 'unisex'),
('Denver', 'Grünes Tal', 'Englisch', 'unisex'),
('Emerson', 'Sohn des Emery', 'Altenglisch', 'unisex'),
('Finley', 'Heller Krieger', 'Irisch', 'unisex'),
('Greer', 'Wachsam', 'Schottisch', 'unisex'),
('Hayden', 'Heidebewohner', 'Altenglisch', 'unisex'),
('Indiana', 'Land der Indianer', 'Amerikanisch', 'unisex'),
('Justice', 'Gerechtigkeit', 'Lateinisch', 'unisex'),
('Kendall', 'Tal des Flusses Kent', 'Altenglisch', 'unisex'),
('London', 'Festung am Fluss', 'Altenglisch', 'unisex'),
('Monroe', 'Mündung des Roe', 'Schottisch', 'unisex'),
('Nico', 'Sieg des Volkes', 'Griechisch', 'unisex'),
('Oakley', 'Eichenwiese', 'Altenglisch', 'unisex'),
('Palmer', 'Pilger', 'Altenglisch', 'unisex'),
('Quinn', 'Weise', 'Irisch', 'unisex'),
('Reese', 'Begeisterung', 'Walisisch', 'unisex'),
('Sawyer', 'Holzfäller', 'Altenglisch', 'unisex'),
('Tatum', 'Fröhlicher Bringer', 'Altenglisch', 'unisex'),
('Utah', 'Bergbewohner', 'Indianisch', 'unisex'),
('Vaughn', 'Klein', 'Walisisch', 'unisex'),
('Wilder', 'Jäger', 'Altenglisch', 'unisex'),
('Xen', 'Gastfreundlich', 'Griechisch', 'unisex'),
('Yael', 'Steinbock', 'Hebräisch', 'unisex'),
('Zion', 'Markierung', 'Hebräisch', 'unisex'),
('Arden', 'Hohes Tal', 'Altenglisch', 'unisex'),
('Bellamy', 'Schöner Freund', 'Französisch', 'unisex'),
('Carson', 'Sohn des Carr', 'Schottisch', 'unisex'),
('Dallas', 'Wohnen in der Wiese', 'Irisch', 'unisex'),
('Elliott', 'Der Herr ist mein Gott', 'Hebräisch', 'unisex'),
('Fallon', 'Anführer', 'Irisch', 'unisex'),
('Gray', 'Grau', 'Altenglisch', 'unisex'),
('Harley', 'Hasenwiese', 'Altenglisch', 'unisex'),
('Indigo', 'Indigoblau', 'Griechisch', 'unisex'),
('Journey', 'Reise', 'Französisch', 'unisex'),
('Keegan', 'Sohn des Feuergeborenen', 'Irisch', 'unisex'),
('Lennox', 'Mit vielen Linden', 'Schottisch', 'unisex'),
('Marlowe', 'Driftholz', 'Altenglisch', 'unisex'),
('Nova', 'Neu', 'Lateinisch', 'unisex'),
('Onyx', 'Schwarzer Edelstein', 'Griechisch', 'unisex'),
('Phoenix', 'Purpurrot', 'Griechisch', 'unisex'),
('Quincy', 'Der Fünfte', 'Lateinisch', 'unisex'),
('Rory', 'Roter König', 'Irisch', 'unisex'),
('Shiloh', 'Friedlich', 'Hebräisch', 'unisex'),
('Tate', 'Fröhlich', 'Altnordisch', 'unisex'),
('Unity', 'Einheit', 'Lateinisch', 'unisex'),
('Vesper', 'Abendstern', 'Lateinisch', 'unisex'),
('Winter', 'Winterzeit', 'Altenglisch', 'unisex'),
('Zephyr', 'Westwind', 'Griechisch', 'unisex')
ON CONFLICT (name) DO NOTHING;
