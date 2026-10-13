-- Milchpulver-Dosierung: Gramm Pulver pro 100 ml trinkfertiger Nahrung,
-- damit Fläschchen-Einträge (ml) automatisch den Pulver-Vorrat (g) abbuchen können.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS dosage_grams_per_100ml NUMERIC(10,2)
  CHECK (dosage_grams_per_100ml IS NULL OR dosage_grams_per_100ml > 0);
