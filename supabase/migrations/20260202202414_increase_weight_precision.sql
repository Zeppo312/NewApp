-- Aus der Remote-Migrationshistorie rekonstruiert.
-- Remote-Version: 20260202202414, Name: increase_weight_precision.

ALTER TABLE weight_entries
  ALTER COLUMN weight TYPE numeric(8,4);
