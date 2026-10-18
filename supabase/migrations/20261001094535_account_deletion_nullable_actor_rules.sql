-- Clear references to the departing account without deleting another owner's
-- entries or shared application configuration. Applies to account and data
-- scopes; an Auth ON DELETE SET NULL alone does not cover a data reset.
-- Does not classify/redact free text, audit copies or provider data.
BEGIN;
DO $$
DECLARE ref record;
BEGIN
 FOR ref IN SELECT * FROM (VALUES
  ('sleep_entries', 'updated_by'),
  ('shopping_items', 'partner_id'),
  ('paywall_content_config', 'updated_by'),
  ('startup_messages', 'created_by'),
  ('startup_messages', 'updated_by'),
  ('subscription_plan_features', 'updated_by'),
  ('subscription_policy_state', 'updated_by')
 ) AS refs(table_name, column_name) LOOP
  IF EXISTS (SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name=ref.table_name
    AND c.column_name=ref.column_name
    AND (c.udt_name<>'uuid' OR c.is_nullable<>'YES')) THEN
   RAISE EXCEPTION 'deletion_actor_column_requires_review: %.%',
    ref.table_name, ref.column_name;
  END IF;
  IF EXISTS (SELECT 1 FROM deletion_private.rules r
   WHERE r.schema_name='public' AND r.table_name=ref.table_name
    AND r.column_name=ref.column_name AND r.action<>'detach') THEN
   RAISE EXCEPTION 'deletion_actor_rule_requires_review: %.%',
    ref.table_name, ref.column_name;
  END IF;
  INSERT INTO deletion_private.rules(schema_name,table_name,column_name,action)
   VALUES ('public',ref.table_name,ref.column_name,'detach')
   ON CONFLICT (schema_name,table_name,column_name) DO NOTHING;
 END LOOP;
END $$;
-- The changed manifest invalidates a prior approval automatically. No policy
-- fingerprint, retention value, cron flag or permission is approved here.
COMMIT;
