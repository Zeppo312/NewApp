-- Recheck negative provider evidence promptly after renewal/restore.
-- This never extends a paid period or grants access while verification is pending.
-- Positive evidence retains its five-minute maximum lease; unlink/deletion stay immediate.
BEGIN;
CREATE OR REPLACE FUNCTION subscription_private.family_state(uid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sponsor uuid; e public.lotti_subscription_entitlements; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(72481023001);
  IF uid IS NULL OR deletion_private.blocked(uid) THEN
    RAISE EXCEPTION 'account unavailable' USING ERRCODE='42501';
  END IF;
  result := jsonb_build_object('schemaVersion',1,'userId',uid,'status','none');
  SELECT b.user_id INTO sponsor FROM subscription_private.members a
    JOIN subscription_private.members b ON b.link_id=a.link_id AND b.user_id<>a.user_id
    JOIN public.account_links l ON l.id=a.link_id AND l.status='accepted' AND l.relationship_type='partner'
    WHERE a.user_id=uid;
  IF sponsor IS NULL OR deletion_private.blocked(sponsor) THEN RETURN result; END IF;
  SELECT * INTO e FROM public.lotti_subscription_entitlements WHERE user_id=sponsor;
  IF e.paid_verified_at IS NULL OR e.paid_verified_at>clock_timestamp() OR
     e.paid_verified_at<=clock_timestamp()-interval '5 minutes' OR
     (e.paid_tier IS NULL AND e.paid_verified_at<=clock_timestamp()-interval '15 seconds') OR
     (e.paid_tier IS NOT NULL AND e.paid_expires_at<=clock_timestamp()) THEN
    RETURN result || jsonb_build_object('status','stale','sponsorId',sponsor);
  END IF;
  IF e.paid_tier IS NULL OR e.paid_expires_at<=clock_timestamp() THEN RETURN result; END IF;
  RETURN result || jsonb_build_object('status','active','sponsorId',sponsor,'tier',e.paid_tier,
    'expiresAt',e.paid_expires_at,'validUntil',least(e.paid_expires_at,e.paid_verified_at+interval '5 minutes'));
END $$;
REVOKE ALL ON FUNCTION subscription_private.family_state(uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
