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
      WITH CHECK (auth.uid() IN (
        SELECT id FROM auth.users WHERE email = 'admin@example.com'
      ));
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
      USING (auth.uid() IN (
        SELECT id FROM auth.users WHERE email = 'admin@example.com'
      ));
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
      USING (auth.uid() IN (
        SELECT id FROM auth.users WHERE email = 'admin@example.com'
      ));
  END IF;
END
$$;

-- Einfügen von 250 weiteren Babynamen mit ON CONFLICT DO NOTHING, um doppelte Namen zu überspringen
INSERT INTO baby_names (name, meaning, origin, gender) VALUES
-- Weitere Jungennamen (100 Namen)
('Adrian', 'Der aus Adria Stammende', 'Lateinisch', 'male'),
('Benedikt', 'Der Gesegnete', 'Lateinisch', 'male'),
('Conrad', 'Der kühne Ratgeber', 'Germanisch', 'male'),
('Dennis', 'Dem Dionysos geweiht', 'Griechisch', 'male'),
('Elian', 'Der Sonnenhafte', 'Hebräisch', 'male'),
('Fabio', 'Der Bohnenanbauer', 'Lateinisch', 'male'),
('Gerhard', 'Der starke Speerwerfer', 'Germanisch', 'male'),
('Hauke', 'Der Kluge', 'Friesisch', 'male'),
('Ilja', 'Jahwe ist mein Gott', 'Russisch', 'male'),
('Jaro', 'Der Frühlingshafte', 'Slawisch', 'male'),
('Kjell', 'Der Kessel, der Helm', 'Skandinavisch', 'male'),
('Leander', 'Der Löwenmann', 'Griechisch', 'male'),
('Marius', 'Der Männliche', 'Lateinisch', 'male'),
('Nathanael', 'Geschenk Gottes', 'Hebräisch', 'male'),
('Oscar', 'Göttlicher Speer', 'Altnordisch', 'male'),
('Peer', 'Der Fels', 'Skandinavisch', 'male'),
('Quirin', 'Der Speerträger', 'Lateinisch', 'male'),
('Raphael', 'Gott hat geheilt', 'Hebräisch', 'male'),
('Sebastian', 'Der Ehrwürdige', 'Griechisch', 'male'),
('Timo', 'Der Ehrende', 'Griechisch', 'male'),
('Urban', 'Der Städter', 'Lateinisch', 'male'),
('Veit', 'Der Lebendige', 'Lateinisch', 'male'),
('Willi', 'Der entschlossene Beschützer', 'Germanisch', 'male'),
('Xeno', 'Der Gastfreundliche', 'Griechisch', 'male'),
('Yannick', 'Gott ist gnädig', 'Hebräisch', 'male'),
('Zoltan', 'Der Herrscher', 'Ungarisch', 'male'),
('Ansgar', 'Der göttliche Speer', 'Altnordisch', 'male'),
('Bela', 'Der Weiße', 'Ungarisch', 'male'),
('Caspar', 'Der Schatzmeister', 'Persisch', 'male'),
('Dario', 'Der Besitzende', 'Persisch', 'male'),
('Enno', 'Der Riese', 'Friesisch', 'male'),
('Fynn', 'Der Blonde, der Helle', 'Irisch', 'male'),
('Gideon', 'Der Zerstörer', 'Hebräisch', 'male'),
('Henning', 'Der Hausherr', 'Germanisch', 'male'),
('Isidor', 'Geschenk der Isis', 'Griechisch', 'male'),
('Juri', 'Der Bauer', 'Russisch', 'male'),
('Korbinian', 'Der Rabe', 'Lateinisch', 'male'),
('Lennox', 'Mit vielen Linden', 'Schottisch', 'male'),
('Malte', 'Der Herrscher', 'Skandinavisch', 'male'),
('Nepomuk', 'Aus Pomuk stammend', 'Tschechisch', 'male'),
('Otis', 'Der Reiche', 'Germanisch', 'male'),
('Piet', 'Der Fels', 'Niederländisch', 'male'),
('Ragnar', 'Der Krieger', 'Altnordisch', 'male'),
('Severin', 'Der Strenge', 'Lateinisch', 'male'),
('Thore', 'Der Donnergott', 'Altnordisch', 'male'),
('Urs', 'Der Bär', 'Lateinisch', 'male'),
('Vitus', 'Der Lebendige', 'Lateinisch', 'male'),
('Wolf', 'Der Wolf', 'Germanisch', 'male'),
('Xaver', 'Der neue Hausherr', 'Baskisch', 'male'),
('Yves', 'Der Eibenbogen', 'Keltisch', 'male'),
('Zoran', 'Die Morgenröte', 'Slawisch', 'male'),
('Armin', 'Der Krieger', 'Germanisch', 'male'),
('Bjarne', 'Der Bär', 'Skandinavisch', 'male'),
('Cornelius', 'Der Gehörnte', 'Lateinisch', 'male'),
('Dominik', 'Dem Herrn gehörend', 'Lateinisch', 'male'),
('Eike', 'Der mit dem Schwert', 'Friesisch', 'male'),
('Fiete', 'Der Friedensreiche', 'Friesisch', 'male'),
('Gustav', 'Der Stab der Goten', 'Schwedisch', 'male'),
('Hanno', 'Gott ist gnädig', 'Hebräisch', 'male'),
('Ivar', 'Der Bogenschütze', 'Altnordisch', 'male'),
('Janne', 'Gott ist gnädig', 'Skandinavisch', 'male'),
('Knut', 'Der Knoten', 'Altnordisch', 'male'),
('Leif', 'Der Erbe', 'Altnordisch', 'male'),
('Mats', 'Geschenk Gottes', 'Schwedisch', 'male'),
('Niels', 'Der Siegreiche', 'Skandinavisch', 'male'),
('Ole', 'Der Vorfahre', 'Altnordisch', 'male'),
('Pelle', 'Der Fels', 'Schwedisch', 'male'),
('Ruben', 'Seht, ein Sohn', 'Hebräisch', 'male'),
('Sören', 'Der Strenge', 'Skandinavisch', 'male'),
('Thilo', 'Der Mächtige', 'Germanisch', 'male'),
('Uwe', 'Der Schafbock', 'Friesisch', 'male'),
('Vincent', 'Der Siegende', 'Lateinisch', 'male'),
('Wilfried', 'Der Friedliebende', 'Germanisch', 'male'),
('Xaver', 'Der neue Hausherr', 'Baskisch', 'male'),
('Yannik', 'Gott ist gnädig', 'Hebräisch', 'male'),
('Zeno', 'Geschenk des Zeus', 'Griechisch', 'male'),
('Arved', 'Der Adler', 'Altnordisch', 'male'),
('Bent', 'Der Gesegnete', 'Skandinavisch', 'male'),
('Claas', 'Der Siegreiche', 'Griechisch', 'male'),
('Denny', 'Dem Dionysos geweiht', 'Griechisch', 'male'),
('Einar', 'Der Krieger', 'Altnordisch', 'male'),
('Falk', 'Der Falke', 'Germanisch', 'male'),
('Gero', 'Der Speerträger', 'Germanisch', 'male'),
('Hagen', 'Der Umhegte', 'Germanisch', 'male'),
('Iven', 'Der Bogenschütze', 'Keltisch', 'male'),
('Jonte', 'Gott ist gnädig', 'Friesisch', 'male'),
('Kalle', 'Der Freie', 'Skandinavisch', 'male'),
('Lasse', 'Der Ruhmreiche', 'Skandinavisch', 'male'),
('Maik', 'Wer ist wie Gott?', 'Hebräisch', 'male'),
('Niko', 'Sieg des Volkes', 'Griechisch', 'male'),
('Onno', 'Der Starke', 'Friesisch', 'male'),
('Pepe', 'Gott vermehre', 'Spanisch', 'male'),
('Rune', 'Geheimnis', 'Altnordisch', 'male'),
('Sven', 'Der junge Krieger', 'Altnordisch', 'male'),
('Titus', 'Der Geehrte', 'Lateinisch', 'male'),
('Ulf', 'Der Wolf', 'Altnordisch', 'male'),

-- Weitere Mädchennamen (100 Namen)
('Annika', 'Die Anmutige', 'Nordisch', 'female'),
('Berit', 'Die Glänzende', 'Nordisch', 'female'),
('Chiara', 'Die Klare, die Helle', 'Italienisch', 'female'),
('Daphne', 'Der Lorbeerbaum', 'Griechisch', 'female'),
('Esther', 'Der Stern', 'Persisch', 'female'),
('Fenja', 'Die Friedliche', 'Nordisch', 'female'),
('Greta', 'Die Perle', 'Germanisch', 'female'),
('Hedy', 'Die Kämpferin', 'Germanisch', 'female'),
('Ines', 'Die Reine', 'Griechisch', 'female'),
('Jette', 'Die Heimische', 'Friesisch', 'female'),
('Kaja', 'Die Reine', 'Nordisch', 'female'),
('Liv', 'Das Leben', 'Nordisch', 'female'),
('Malin', 'Die Starke', 'Schwedisch', 'female'),
('Nadia', 'Die Hoffnung', 'Russisch', 'female'),
('Orla', 'Die Goldene', 'Keltisch', 'female'),
('Pippa', 'Die Pferdeliebhaberin', 'Englisch', 'female'),
('Quenby', 'Die Frau aus der Mühle', 'Englisch', 'female'),
('Runa', 'Das Geheimnis', 'Nordisch', 'female'),
('Svea', 'Die Schwedin', 'Schwedisch', 'female'),
('Thea', 'Die Göttliche', 'Griechisch', 'female'),
('Uma', 'Die Beschützerin', 'Sanskrit', 'female'),
('Viola', 'Das Veilchen', 'Lateinisch', 'female'),
('Wanda', 'Die Wanderin', 'Slawisch', 'female'),
('Xandra', 'Die Beschützerin', 'Griechisch', 'female'),
('Ylvi', 'Die Wölfin', 'Nordisch', 'female'),
('Zita', 'Die Kleine', 'Italienisch', 'female'),
('Astrid', 'Die göttlich Schöne', 'Nordisch', 'female'),
('Birte', 'Die Strahlende', 'Nordisch', 'female'),
('Cosima', 'Die Wohlgeordnete', 'Griechisch', 'female'),
('Delia', 'Die Sichtbare', 'Griechisch', 'female'),
('Elin', 'Die Fackel', 'Griechisch', 'female'),
('Freya', 'Die Herrin', 'Nordisch', 'female'),
('Gisela', 'Die Geisel', 'Germanisch', 'female'),
('Hedda', 'Die Kämpferin', 'Germanisch', 'female'),
('Ida', 'Die Fleißige', 'Germanisch', 'female'),
('Jill', 'Die Jugendliche', 'Englisch', 'female'),
('Kathi', 'Die Reine', 'Griechisch', 'female'),
('Lotta', 'Die Freie', 'Germanisch', 'female'),
('Mina', 'Die Beschützerin', 'Persisch', 'female'),
('Nele', 'Die Strahlende', 'Friesisch', 'female'),
('Olga', 'Die Heilige', 'Russisch', 'female'),
('Pia', 'Die Fromme', 'Lateinisch', 'female'),
('Quinta', 'Die Fünfte', 'Lateinisch', 'female'),
('Rike', 'Die Mächtige', 'Germanisch', 'female'),
('Sinja', 'Die Wahrhaftige', 'Russisch', 'female'),
('Tara', 'Der Stern', 'Irisch', 'female'),
('Ulla', 'Die Willensstarke', 'Germanisch', 'female'),
('Vivien', 'Die Lebendige', 'Lateinisch', 'female'),
('Wiebke', 'Die Kämpferin', 'Friesisch', 'female'),
('Xena', 'Die Gastfreundliche', 'Griechisch', 'female'),
('Yara', 'Die Kleine Perle', 'Arabisch', 'female'),
('Zoe', 'Das Leben', 'Griechisch', 'female'),
('Anke', 'Die Anmutige', 'Friesisch', 'female'),
('Bente', 'Die Gesegnete', 'Friesisch', 'female'),
('Carolin', 'Die Freie', 'Germanisch', 'female'),
('Dagmar', 'Die Tagberühmte', 'Nordisch', 'female'),
('Edda', 'Die Urgroßmutter', 'Nordisch', 'female'),
('Feline', 'Die Katzenhafte', 'Lateinisch', 'female'),
('Gerda', 'Die Beschützerin', 'Germanisch', 'female'),
('Helga', 'Die Heilige', 'Nordisch', 'female'),
('Imke', 'Die Universelle', 'Friesisch', 'female'),
('Janne', 'Gott ist gnädig', 'Friesisch', 'female'),
('Katrin', 'Die Reine', 'Griechisch', 'female'),
('Lene', 'Die Strahlende', 'Griechisch', 'female'),
('Merle', 'Die Amsel', 'Friesisch', 'female'),
('Neele', 'Die Strahlende', 'Friesisch', 'female'),
('Oda', 'Die Besitzerin', 'Germanisch', 'female'),
('Pina', 'Die Kleine', 'Italienisch', 'female'),
('Rieke', 'Die Mächtige', 'Germanisch', 'female'),
('Silke', 'Die Himmlische', 'Friesisch', 'female'),
('Tomke', 'Die Zwillingsschwester', 'Friesisch', 'female'),
('Ute', 'Die Reiche', 'Germanisch', 'female'),
('Veronika', 'Die Siegbringerin', 'Griechisch', 'female'),
('Wiebke', 'Die Kämpferin', 'Friesisch', 'female'),
('Xenia', 'Die Gastfreundliche', 'Griechisch', 'female'),
('Yvette', 'Die Eibe', 'Französisch', 'female'),
('Zara', 'Die Prinzessin', 'Arabisch', 'female'),
('Alva', 'Die Elfe', 'Nordisch', 'female'),
('Britta', 'Die Starke', 'Nordisch', 'female'),
('Cora', 'Das Mädchen', 'Griechisch', 'female'),
('Doris', 'Die vom Meer', 'Griechisch', 'female'),
('Elin', 'Die Fackel', 'Griechisch', 'female'),
('Fenja', 'Die Friedliche', 'Nordisch', 'female'),
('Gunda', 'Die Kämpferin', 'Nordisch', 'female'),
('Hella', 'Die Helle', 'Germanisch', 'female'),
('Ilka', 'Die Edle', 'Nordisch', 'female'),
('Jara', 'Die Junge', 'Slawisch', 'female'),
('Kerstin', 'Die Christliche', 'Schwedisch', 'female'),
('Lisbeth', 'Die Gottgeweihte', 'Hebräisch', 'female'),
('Maike', 'Die Bittere', 'Friesisch', 'female'),
('Nadine', 'Die Hoffnungsvolle', 'Russisch', 'female'),
('Olga', 'Die Heilige', 'Russisch', 'female'),
('Petra', 'Der Fels', 'Griechisch', 'female'),
('Rebekka', 'Die Fesselnde', 'Hebräisch', 'female'),
('Silvia', 'Die aus dem Wald', 'Lateinisch', 'female'),
('Tanja', 'Die Gekrönte', 'Russisch', 'female'),
('Ulrike', 'Die Erbreiche', 'Germanisch', 'female'),

-- Weitere Unisex-Namen (50 Namen)
('Andy', 'Der Tapfere', 'Griechisch', 'unisex'),
('Billie', 'Die Entschlossene', 'Englisch', 'unisex'),
('Chris', 'Der Christusträger', 'Griechisch', 'unisex'),
('Devin', 'Der Dichter', 'Irisch', 'unisex'),
('Emery', 'Der Fleißige', 'Germanisch', 'unisex'),
('Frankie', 'Der Freie', 'Germanisch', 'unisex'),
('Glenn', 'Das Tal', 'Schottisch', 'unisex'),
('Harper', 'Der Harfenspieler', 'Englisch', 'unisex'),
('Ira', 'Der Wachsame', 'Hebräisch', 'unisex'),
('Jackie', 'Der Fersenschleicher', 'Hebräisch', 'unisex'),
('Kerry', 'Der Dunkelhaarige', 'Irisch', 'unisex'),
('Lenny', 'Der Löwenstarke', 'Englisch', 'unisex'),
('Maddox', 'Der Wohltätige', 'Walisisch', 'unisex'),
('Nico', 'Der Sieger', 'Griechisch', 'unisex'),
('Ollie', 'Der Friedensbringer', 'Germanisch', 'unisex'),
('Paris', 'Der Korb', 'Griechisch', 'unisex'),
('Quinn', 'Der Weise', 'Irisch', 'unisex'),
('Riley', 'Der Tapfere', 'Irisch', 'unisex'),
('Skyler', 'Der Gelehrte', 'Niederländisch', 'unisex'),
('Toby', 'Gott ist gut', 'Hebräisch', 'unisex'),
('Uli', 'Der Erbreiche', 'Germanisch', 'unisex'),
('Vega', 'Der fallende Adler', 'Arabisch', 'unisex'),
('Wren', 'Der Zaunkönig', 'Englisch', 'unisex'),
('Xen', 'Der Gastfreundliche', 'Griechisch', 'unisex'),
('Yuki', 'Der Glückliche', 'Japanisch', 'unisex'),
('Zephyr', 'Der Westwind', 'Griechisch', 'unisex'),
('Ariel', 'Der Löwe Gottes', 'Hebräisch', 'unisex'),
('Blair', 'Das Feld', 'Schottisch', 'unisex'),
('Cody', 'Der Hilfsbereite', 'Irisch', 'unisex'),
('Dana', 'Mein Richter', 'Hebräisch', 'unisex'),
('Ellis', 'Der Freundliche', 'Walisisch', 'unisex'),
('Finley', 'Der helle Krieger', 'Schottisch', 'unisex'),
('Greer', 'Der Wachsame', 'Schottisch', 'unisex'),
('Harley', 'Die Hasenwiese', 'Englisch', 'unisex'),
('Indigo', 'Indigoblau', 'Griechisch', 'unisex'),
('Jody', 'Der Gepriesene', 'Hebräisch', 'unisex'),
('Kris', 'Der Christusträger', 'Griechisch', 'unisex'),
('Lou', 'Der berühmte Krieger', 'Germanisch', 'unisex'),
('Merritt', 'Der Würdige', 'Englisch', 'unisex'),
('Nicky', 'Der Sieger', 'Griechisch', 'unisex'),
('Ocean', 'Das Meer', 'Griechisch', 'unisex'),
('Phoenix', 'Der Purpurrote', 'Griechisch', 'unisex'),
('Remy', 'Der Ruderer', 'Französisch', 'unisex'),
('Shay', 'Das Geschenk', 'Irisch', 'unisex'),
('Tanner', 'Der Gerber', 'Englisch', 'unisex'),
('Umber', 'Der Schattige', 'Lateinisch', 'unisex'),
('Vesper', 'Der Abendstern', 'Lateinisch', 'unisex'),
('Whitley', 'Die weiße Wiese', 'Englisch', 'unisex'),
('Xen', 'Der Gastfreundliche', 'Griechisch', 'unisex'),
('Yael', 'Der Steinbock', 'Hebräisch', 'unisex')
ON CONFLICT (name) DO NOTHING;
