-- Migration: Sleep Personalization Storage
-- Stores personalization data for sleep predictions per baby
-- Enables sync between partners without constant Supabase queries

-- Create sleep_personalization table
CREATE TABLE IF NOT EXISTS public.sleep_personalization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL,
  personalization_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one row per baby
  CONSTRAINT unique_baby_personalization UNIQUE (baby_id)
);

-- Add foreign key to baby_info if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'baby_info') THEN
    ALTER TABLE public.sleep_personalization
      ADD CONSTRAINT fk_sleep_personalization_baby
      FOREIGN KEY (baby_id)
      REFERENCES public.baby_info(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sleep_personalization_baby_id
  ON public.sleep_personalization(baby_id);

-- Create index for updated_at (für merge-Strategie)
CREATE INDEX IF NOT EXISTS idx_sleep_personalization_updated_at
  ON public.sleep_personalization(updated_at);

-- Enable Row Level Security
ALTER TABLE public.sleep_personalization ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read/write personalization for their babies
CREATE POLICY "Users can manage personalization for their babies"
  ON public.sleep_personalization
  FOR ALL
  USING (
    baby_id IN (
      SELECT baby_id
      FROM public.baby_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    baby_id IN (
      SELECT baby_id
      FROM public.baby_members
      WHERE user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sleep_personalization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on every update
CREATE TRIGGER trigger_update_sleep_personalization_updated_at
  BEFORE UPDATE ON public.sleep_personalization
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sleep_personalization_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.sleep_personalization TO authenticated;

-- Add comment
COMMENT ON TABLE public.sleep_personalization IS 'Stores sleep prediction personalization data per baby. Synced between partners for consistent predictions.';
