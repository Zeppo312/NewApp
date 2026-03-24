-- Add favorite flag for recommendation badge
ALTER TABLE public.lotti_recommendations
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.lotti_recommendations.is_favorite IS 'Marks a recommendation as a favorite';
