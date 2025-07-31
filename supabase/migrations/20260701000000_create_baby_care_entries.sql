-- Unified table for feeding and diaper activities
CREATE TABLE IF NOT EXISTS public.baby_care_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date TIMESTAMPTZ NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('diaper','feeding')),
  diaper_type TEXT CHECK (diaper_type IN ('wet','poop','both')),
  feeding_type TEXT CHECK (feeding_type IN ('breast','bottle','solid')),
  breast_side TEXT CHECK (breast_side IN ('left','right','both')),
  bottle_amount INTEGER,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_syncing BOOLEAN DEFAULT FALSE
);

-- trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_baby_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_baby_care_entries_updated_at
BEFORE UPDATE ON public.baby_care_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_baby_care_updated_at();

-- Row level security
ALTER TABLE public.baby_care_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own and linked care entries"
ON public.baby_care_entries
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.account_links al
    WHERE ((al.creator_id = auth.uid() AND al.invited_id = user_id) OR
           (al.invited_id = auth.uid() AND al.creator_id = user_id))
      AND al.status = 'accepted'
  )
);

CREATE POLICY "Users can insert their own care entries"
ON public.baby_care_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own care entries"
ON public.baby_care_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own care entries"
ON public.baby_care_entries
FOR DELETE
USING (auth.uid() = user_id);
