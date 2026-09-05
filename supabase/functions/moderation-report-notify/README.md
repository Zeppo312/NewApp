# Moderation report notifications

This database-webhook function is deployed with gateway JWT verification disabled
and authenticates every request with its own required shared secret.

Required production secrets:

- `MODERATION_WEBHOOK_SECRET`: same value as the secret stored under
  `moderation_webhook_secret` in Supabase Vault.
- `RESEND_API_KEY`: API key for the email delivery fallback.
- `MODERATION_ALERT_EMAIL_FROM`: verified Resend sender, for example
  `Lotti Baby Moderation <moderation@lottibaby.de>`.
- `MODERATION_ALERT_EMAIL_TO`: comma-separated moderation recipients.

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
available. If no push can be delivered, the function sends a data-minimized
fallback email through Resend. The email contains only the report metadata and
an app deep link, not the reported content snapshot. If both alert channels
fail, the function returns HTTP 202 and logs an error; the durable admin queue
remains the source of truth.
