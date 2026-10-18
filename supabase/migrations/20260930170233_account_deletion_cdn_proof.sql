-- A Storage API deletion is not proof that cached copies have expired.
CREATE FUNCTION deletion_private.require_cdn_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO deletion_private.provider_tasks(request_id,provider) VALUES(NEW.id,'storage_cdn') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION deletion_private.require_cdn_evidence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER account_deletion_cdn_evidence AFTER INSERT ON deletion_private.requests
 FOR EACH ROW EXECUTE FUNCTION deletion_private.require_cdn_evidence();
INSERT INTO deletion_private.provider_tasks(request_id,provider)
 SELECT id,'storage_cdn' FROM deletion_private.requests WHERE status<>'completed' ON CONFLICT DO NOTHING;
