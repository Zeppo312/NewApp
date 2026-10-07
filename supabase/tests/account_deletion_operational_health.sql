-- Read-only aggregate for an operator/alert runner. No account IDs or evidence.
-- A nonzero alert count must be routed to an owned channel before launch.
SELECT
  (SELECT count(*) FROM deletion_private.requests
   WHERE status = 'needs_attention') AS needs_attention,
  (SELECT count(*) FROM deletion_private.requests
   WHERE status = 'queued' AND created_at < now() - interval '15 minutes') AS queued_over_15m,
  (SELECT count(*) FROM deletion_private.requests
   WHERE status = 'processing' AND lease_until < now() - interval '7 minutes') AS expired_lease_over_7m,
  -- Worker claims last three minutes. A future lease extending beyond that
  -- contract must alert too, even though it has not yet expired.
  (SELECT count(*) FROM deletion_private.requests
   WHERE status = 'processing' AND lease_until > updated_at + interval '3 minutes') AS lease_exceeds_contract,
  (SELECT count(*) FROM deletion_private.provider_tasks
   WHERE status = 'retention_pending' AND due_at < now()) AS overdue_retention,
  (SELECT count(*) FROM deletion_private.provider_tasks
   WHERE status = 'pending') AS pending_provider_evidence;
