-- Hinzufügen einer Spalte für die Antwort des Arztes
ALTER TABLE public.doctor_questions ADD COLUMN IF NOT EXISTS answer TEXT;
