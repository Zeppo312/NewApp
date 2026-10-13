-- Allow partners to view and delete baby weight entries.

DROP POLICY IF EXISTS "Users can view their own weight entries" ON public.weight_entries;
CREATE POLICY "Users can view own and partner baby weight entries"
ON public.weight_entries
FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    subject = 'baby'
    AND EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND al.relationship_type = 'partner'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id)
          OR (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can delete their own weight entries" ON public.weight_entries;
CREATE POLICY "Users can delete own and partner baby weight entries"
ON public.weight_entries
FOR DELETE
USING (
  auth.uid() = user_id
  OR (
    subject = 'baby'
    AND EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND al.relationship_type = 'partner'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id)
          OR (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  )
);
