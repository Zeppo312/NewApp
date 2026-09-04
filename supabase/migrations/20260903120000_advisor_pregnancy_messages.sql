-- Lottis Fürsorge in der Schwangerschaft: Hinweise ohne Baby-Bezug.
--
-- Vor der Geburt gibt es keine baby_info-Zeile. Tageshinweise werden dann mit
-- baby_id = NULL pro Nutzer/Tag gespeichert. Der bestehende UNIQUE-Constraint
-- greift bei NULL nicht (NULLs gelten als verschieden), daher ein partieller
-- Unique-Index für den Schwangerschaftsfall.

ALTER TABLE public.advisor_messages
  ALTER COLUMN baby_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS advisor_messages_pregnancy_daily_unique
  ON public.advisor_messages (user_id, local_date)
  WHERE baby_id IS NULL;
