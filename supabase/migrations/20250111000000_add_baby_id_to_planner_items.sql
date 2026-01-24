-- Add baby_id field to planner_items for child assignments
ALTER TABLE public.planner_items
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_planner_items_baby_id ON public.planner_items(baby_id);

-- Add comment to explain the field
COMMENT ON COLUMN public.planner_items.baby_id IS 'Specific baby ID when assignee is "child". Allows assigning tasks/events to specific children.';
