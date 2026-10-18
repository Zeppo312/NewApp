-- Disposable managed restore source only. Never run on existing QA/production.
-- Supabase supplies real Auth and Storage schemas; this file adds test tables.
BEGIN;
DO $guard$
DECLARE n bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public') THEN
  RAISE EXCEPTION 'managed_fixture_requires_empty_public_schema';
 END IF;
 IF EXISTS(SELECT 1 FROM auth.users) THEN
  RAISE EXCEPTION 'managed_fixture_requires_empty_auth';
 END IF;
 IF to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM cron.job' INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'managed_fixture_forbids_existing_jobs'; END IF;
 END IF;
 IF to_regclass('vault.secrets') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM vault.secrets' INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'managed_fixture_forbids_existing_secrets'; END IF;
 END IF;
END $guard$;

CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.baby_info(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.baby_members(baby_id uuid REFERENCES public.baby_info(id) ON DELETE CASCADE,user_id uuid,role text);
CREATE TABLE public.direct_messages(id uuid,sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,content text);
CREATE TABLE public.user_settings(id uuid,user_id uuid);
CREATE TABLE public.sleep_entries(id uuid,user_id uuid,partner_id uuid,shared_with_user_id uuid);
CREATE TABLE public.community_posts(id uuid,user_id uuid,image_url text);
CREATE TABLE public.baby_milestone_entries(id uuid,baby_id uuid,user_id uuid);
CREATE TABLE public.community_group_messages(id uuid,sender_id uuid,content text);
CREATE TABLE public.blog_posts(id uuid,author_id uuid,cover_image_url text);
CREATE TABLE public.baby_recipes(id uuid DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,is_global boolean,image_url text);
CREATE TABLE public.account_links_audit_log(id uuid DEFAULT gen_random_uuid(),changed_by uuid,old_data jsonb,new_data jsonb);
CREATE TABLE public.content_reports(id uuid DEFAULT gen_random_uuid(),reporter_id uuid,reported_user_id uuid,target_id uuid,target_snapshot text);
CREATE TABLE public.subscription_policy_audit(id uuid DEFAULT gen_random_uuid(),changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT);

-- No app users are granted access to these synthetic tables.
DO $rls$
DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t.tablename);
 END LOOP;
END $rls$;
COMMIT;
