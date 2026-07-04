-- Packungsmodell für Vorräte: neben dem angebrochenen Bestand (current_quantity)
-- wird die Anzahl ungeöffneter Packungen geführt. Bestehende Posten behalten
-- ihren Bestand als "angebrochen" (packages_sealed = 0), Gesamtbestand bleibt gleich.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS packages_sealed INTEGER NOT NULL DEFAULT 0
  CHECK (packages_sealed >= 0);
