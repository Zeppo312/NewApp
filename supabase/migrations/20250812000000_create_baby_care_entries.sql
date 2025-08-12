-- Create unified table for feeding and diaper entries
-- Stores all options in a single table

CREATE TABLE IF NOT EXISTS public.baby_care_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('feeding', 'diaper')),

  -- Common fields
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  notes TEXT,

  -- Feeding-specific fields
  feeding_type TEXT CHECK (feeding_type IN ('BREAST', 'BOTTLE', 'SOLIDS')),
  feeding_volume_ml INTEGER,
  feeding_side TEXT CHECK (feeding_side IN ('LEFT', 'RIGHT', 'BOTH')),

  -- Diaper-specific fields
  diaper_type TEXT CHECK (diaper_type IN ('WET', 'DIRTY', 'BOTH')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_baby_care_entries_user_id ON public.baby_care_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_baby_care_entries_entry_type ON public.baby_care_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_baby_care_entries_start_time ON public.baby_care_entries(start_time DESC);

-- Row Level Security
ALTER TABLE public.baby_care_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own baby care entries" ON public.baby_care_entries;
CREATE POLICY "Users can view their own baby care entries" ON public.baby_care_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own baby care entries" ON public.baby_care_entries;
CREATE POLICY "Users can insert their own baby care entries" ON public.baby_care_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own baby care entries" ON public.baby_care_entries;
CREATE POLICY "Users can update their own baby care entries" ON public.baby_care_entries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own baby care entries" ON public.baby_care_entries;
CREATE POLICY "Users can delete their own baby care entries" ON public.baby_care_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_baby_care_entries_updated_at ON public.baby_care_entries;
CREATE TRIGGER trg_baby_care_entries_updated_at
BEFORE UPDATE ON public.baby_care_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Optional: Basic check to avoid invalid combinations (not enforced strictly)
-- Note: We keep it simple to avoid blocking valid partial entries


