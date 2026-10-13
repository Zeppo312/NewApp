BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
ALTER POLICY "Baby info: select by member" ON public.baby_info
  USING ((user_id=auth.uid()) OR public.is_baby_member(id));
DROP FUNCTION consent_private.current_accessible_baby_ids();
NOTIFY pgrst, 'reload schema';
COMMIT;
