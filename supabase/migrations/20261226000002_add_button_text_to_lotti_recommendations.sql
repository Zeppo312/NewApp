-- Add customizable button text for recommendation links
ALTER TABLE public.lotti_recommendations
  ADD COLUMN IF NOT EXISTS button_text TEXT DEFAULT 'Zum Produkt';

COMMENT ON COLUMN public.lotti_recommendations.button_text IS 'Text des Produkt-Buttons (optional)';
