# Moderation report notifications

This database-webhook function is deployed with gateway JWT verification disabled
and authenticates every request with its own required shared secret.

Required production secrets:

- `MODERATION_WEBHOOK_SECRET`: same value as the secret stored under
  `moderation_webhook_secret` in Supabase Vault.

Configure the matching database secret in Supabase Vault without committing its
value:

```sql
SELECT vault.create_secret(
  '<same-random-secret>',
  'moderation_webhook_secret',
  'Shared database-to-function authentication secret'
);
```

Set the Edge Function secrets with `supabase secrets set`, then deploy
`moderation-report-notify`. Reports are stored durably in `content_reports` and
remain visible in the admin moderation queue even when no admin push token is
available. In that case the function returns HTTP 202 and logs a warning; Expo
Push is an additional alert, not the source of truth.
