-- Allow linked users to insert planner items for each other (collaboration).
-- Run this after the planner tables/policies are created.

DROP POLICY IF EXISTS "planner_items_insert_own" ON public.planner_items;

CREATE POLICY "planner_items_insert_own" ON public.planner_items
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id OR
      EXISTS (
        SELECT 1
        FROM public.account_links al
        WHERE al.status = 'accepted'
          AND (
            (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
            (al.invited_id = auth.uid() AND al.creator_id = user_id)
          )
      )
    ) AND
    EXISTS (
      SELECT 1
      FROM public.planner_days d
      WHERE d.id = day_id AND d.user_id = user_id
    ) AND
    (
      block_id IS NULL OR
      EXISTS (
        SELECT 1
        FROM public.planner_blocks b
        WHERE b.id = block_id AND b.user_id = user_id
      )
    )
  );

