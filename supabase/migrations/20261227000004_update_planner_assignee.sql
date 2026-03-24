-- Allow planner assignees beyond me/partner.

ALTER TABLE public.planner_items
  DROP CONSTRAINT IF EXISTS planner_items_assignee_check;

ALTER TABLE public.planner_items
  ADD CONSTRAINT planner_items_assignee_check
  CHECK (assignee IN ('me', 'partner', 'family', 'child'));
