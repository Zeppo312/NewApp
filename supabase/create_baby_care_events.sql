-- Table for unified diaper and feeding events
CREATE TABLE IF NOT EXISTS public.baby_care_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('diaper','feeding')),
  diaper_type TEXT CHECK (diaper_type IN ('wet','dirty','both')),
  feeding_type TEXT CHECK (feeding_type IN ('breast','bottle','solids')),
  volume_ml INTEGER,
  side TEXT CHECK (side IN ('left','right','both')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_syncing BOOLEAN DEFAULT FALSE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS baby_care_events_user_idx ON public.baby_care_events(user_id);
CREATE INDEX IF NOT EXISTS baby_care_events_start_idx ON public.baby_care_events(start_time);

-- Enable RLS
ALTER TABLE public.baby_care_events ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own and linked care events" ON public.baby_care_events;
DROP POLICY IF EXISTS "Users can insert their own care events" ON public.baby_care_events;
DROP POLICY IF EXISTS "Users can update their own care events" ON public.baby_care_events;
DROP POLICY IF EXISTS "Users can delete their own care events" ON public.baby_care_events;

CREATE POLICY "Users can view their own and linked care events"
ON public.baby_care_events
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.account_links al
    WHERE ((al.creator_id = auth.uid() AND al.invited_id = user_id) OR
           (al.invited_id = auth.uid() AND al.creator_id = user_id))
      AND al.status = 'accepted'
  )
);

CREATE POLICY "Users can insert their own care events"
ON public.baby_care_events
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own care events"
ON public.baby_care_events
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own care events"
ON public.baby_care_events
FOR DELETE USING (auth.uid() = user_id);
