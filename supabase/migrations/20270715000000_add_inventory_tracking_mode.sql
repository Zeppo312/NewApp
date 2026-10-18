-- Qualitative Füllstände für Produkte, deren Verbrauch nicht exakt gebucht wird.
-- Bestehende Vorräte bleiben durch den Default weiterhin mengenbasiert.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'quantity',
  ADD COLUMN IF NOT EXISTS stock_level_percent SMALLINT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reorder_level_percent SMALLINT NOT NULL DEFAULT 20;

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_tracking_mode_check,
  ADD CONSTRAINT inventory_items_tracking_mode_check
    CHECK (tracking_mode IN ('quantity', 'level')),
  DROP CONSTRAINT IF EXISTS inventory_items_stock_level_percent_check,
  ADD CONSTRAINT inventory_items_stock_level_percent_check
    CHECK (stock_level_percent BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS inventory_items_reorder_level_percent_check,
  ADD CONSTRAINT inventory_items_reorder_level_percent_check
    CHECK (reorder_level_percent BETWEEN 0 AND 100);
