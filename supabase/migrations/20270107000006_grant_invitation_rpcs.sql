-- Ensure authenticated users can execute invitation RPCs.

DO $$
BEGIN
  IF to_regprocedure('public.redeem_invitation_code_and_sync_due_date(text, uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.redeem_invitation_code_and_sync_due_date(text, uuid) TO authenticated';
  END IF;

  IF to_regprocedure('public.accept_invitation_and_sync_due_date(uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.accept_invitation_and_sync_due_date(uuid, uuid) TO authenticated';
  END IF;

  IF to_regprocedure('public.accept_invitation(uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid, uuid) TO authenticated';
  END IF;
END $$;
