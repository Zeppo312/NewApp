-- Read-only. Run explicitly against the intended linked workspace.
-- One result preserves all sections in the Supabase Management API response.
SELECT jsonb_build_object(
  'database', current_database(),
  'schemas', (SELECT jsonb_object_agg(name, to_regnamespace(name) IS NOT NULL)
    FROM unnest(ARRAY['subscription_private','deletion_private','caretaker_private']) name),
  'tables', (SELECT jsonb_object_agg(name, to_regclass(name) IS NOT NULL)
    FROM unnest(ARRAY['public.profiles','public.account_links','public.account_links_audit_log',
      'public.lotti_subscription_entitlements','public.subscription_plan_features',
      'public.lotti_ai_requests','public.lotti_ai_usage_buckets']) name),
  'rpcs', (SELECT jsonb_object_agg(name, to_regprocedure(name) IS NOT NULL)
    FROM unnest(ARRAY['public.prevent_profile_privilege_escalation()',
      'public.get_linked_users_with_info(uuid)','public.get_user_invitations_with_info(uuid)',
      'public.redeem_invitation_code_and_sync_due_date(text,uuid)',
      'public.account_deletion_worker(text,jsonb)', 'public.get_family_subscription_access()',
      'public.consume_advisor_ai_quota(uuid)', 'caretaker_private.has_premium(uuid)']) name),
  'cache_columns', (SELECT jsonb_agg(column_name ORDER BY ordinal_position)
    FROM information_schema.columns WHERE table_schema='public' AND table_name='lotti_subscription_entitlements'),
  'accepted_links', (SELECT count(*) FROM public.account_links WHERE status='accepted'),
  'legacy_cache_rows', (SELECT count(*) FROM public.lotti_subscription_entitlements
    WHERE product_id IN ('entl7a7b4e9838','LottiBabyAbo')),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)))
    FROM pg_constraint WHERE conrelid IN ('public.account_links'::regclass,'public.lotti_ai_usage_buckets'::regclass)),
  'feature_count', (SELECT count(*) FROM public.subscription_plan_features),
  'authenticator_settings', (SELECT rolconfig FROM pg_roles WHERE rolname='authenticator'),
  'target_migrations', (SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations
    WHERE version IN ('20260911065615','20260912185037','20260924064154','20260924074150'))
) AS preflight;
