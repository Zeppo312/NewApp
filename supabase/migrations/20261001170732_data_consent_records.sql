-- Additive staging only. No existing table, policy, hook, function or job changes.
BEGIN;
CREATE SCHEMA consent_private;
REVOKE ALL ON SCHEMA consent_private FROM PUBLIC, anon, authenticated;
CREATE TABLE consent_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  document_version text NOT NULL DEFAULT '2026-10-01.1',
  client_release text,
  edge_release text,
  approved_at timestamptz
);
INSERT INTO consent_private.settings(singleton) VALUES(true);
CREATE TABLE consent_private.documents (
  version text PRIMARY KEY,
  copy jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- The exact DE/EN/ES disclosures are appended below by the source generator.
CREATE TABLE consent_private.user_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE consent_private.decisions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('health','ai')),
  decision text NOT NULL CHECK (decision IN ('granted','declined','revoked')),
  document_version text NOT NULL REFERENCES consent_private.documents(version),
  decided_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,scope)
);
CREATE TABLE consent_private.operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  scope text NOT NULL,
  decision text NOT NULL,
  document_version text NOT NULL,
  locale text NOT NULL,
  revision bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE consent_private.events (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('health','ai')),
  decision text NOT NULL CHECK (decision IN ('granted','declined','revoked')),
  document_version text NOT NULL REFERENCES consent_private.documents(version),
  locale text NOT NULL CHECK(locale IN ('de','en','es')),
  revision bigint NOT NULL,
  decided_at timestamptz NOT NULL,
  source text NOT NULL CHECK(source IN ('explicit_app_choice','health_withdrawal')),
  PRIMARY KEY(user_id,operation_id,scope)
);
ALTER TABLE consent_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_private.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_private.user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_private.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_private.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_private.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA consent_private FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION consent_private.has_consent(p_user_id uuid, p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM consent_private.decisions d
    JOIN consent_private.settings s ON s.singleton
    WHERE d.user_id=p_user_id AND d.scope=p_scope AND d.decision='granted'
      AND d.document_version=s.document_version)
$$;
CREATE FUNCTION consent_private.snapshot(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('enabled',s.enabled OR s.activated_at IS NOT NULL,'userId',p_user_id,
    'revision',COALESCE((SELECT revision FROM consent_private.user_state WHERE user_id=p_user_id),0),
    'documentVersion',s.document_version,
    'health',(SELECT jsonb_build_object('decision',decision,'documentVersion',document_version,'decidedAt',decided_at) FROM consent_private.decisions WHERE user_id=p_user_id AND scope='health'),
    'ai',(SELECT jsonb_build_object('decision',decision,'documentVersion',document_version,'decidedAt',decided_at) FROM consent_private.decisions WHERE user_id=p_user_id AND scope='ai'))
  FROM consent_private.settings s WHERE singleton
$$;
CREATE FUNCTION consent_private.own_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE health_allowed boolean; ai_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF to_regprocedure('consent_private.family_allowed(uuid,text)') IS NOT NULL THEN
    EXECUTE 'SELECT consent_private.family_allowed($1,''health''),consent_private.family_allowed($1,''ai'')'
      INTO health_allowed,ai_allowed USING auth.uid();
  ELSE
    health_allowed := consent_private.processing_allowed(auth.uid(),'health');
    ai_allowed := consent_private.processing_allowed(auth.uid(),'ai');
  END IF;
  RETURN consent_private.snapshot(auth.uid()) || jsonb_build_object('healthAllowed',health_allowed,'aiAllowed',ai_allowed);
END $$;
CREATE FUNCTION public.get_data_consents()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT consent_private.own_snapshot()
$$;
CREATE FUNCTION consent_private.record_decision(p_scope text, p_decision text,
  p_document_version text, p_locale text, p_operation_id uuid, p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); s consent_private.settings; current_revision bigint;
  previous consent_private.operations; at_time timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('health','ai') OR p_decision IS NULL OR p_decision NOT IN ('granted','declined','revoked')
    OR p_locale IS NULL OR p_locale NOT IN ('de','en','es') OR p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'invalid_consent_decision' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM consent_private.settings WHERE singleton;
  IF p_document_version IS DISTINCT FROM s.document_version THEN RAISE EXCEPTION 'consent_document_changed' USING ERRCODE='40001'; END IF;
  -- Withdrawal is always accepted, including during a paused rollout.
  IF NOT s.enabled AND p_decision <> 'revoked' THEN RAISE EXCEPTION 'consents_not_enabled' USING ERRCODE='55000'; END IF;
  INSERT INTO consent_private.user_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM consent_private.user_state WHERE user_id=uid FOR UPDATE;
  SELECT * INTO previous FROM consent_private.operations WHERE user_id=uid AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.scope IS DISTINCT FROM p_scope OR previous.decision IS DISTINCT FROM p_decision OR previous.locale IS DISTINCT FROM p_locale OR previous.document_version IS DISTINCT FROM p_document_version THEN
      RAISE EXCEPTION 'consent_operation_conflict' USING ERRCODE='22023';
    END IF;
    -- A retry never restores an old grant after a later withdrawal.
    RETURN consent_private.own_snapshot();
  END IF;
  IF current_revision <> p_expected_revision THEN RAISE EXCEPTION 'consent_revision_changed' USING ERRCODE='40001'; END IF;
  IF p_scope='ai' AND p_decision='granted' AND NOT consent_private.has_consent(uid,'health') THEN
    RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501';
  END IF;
  at_time := clock_timestamp();
  current_revision := current_revision+1;
  UPDATE consent_private.user_state SET revision=current_revision WHERE user_id=uid;
  INSERT INTO consent_private.operations VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time);
  INSERT INTO consent_private.decisions VALUES(uid,p_scope,p_decision,p_document_version,at_time)
    ON CONFLICT(user_id,scope) DO UPDATE SET decision=excluded.decision,document_version=excluded.document_version,decided_at=excluded.decided_at;
  INSERT INTO consent_private.events VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time,'explicit_app_choice');
  IF p_scope='health' AND p_decision<>'granted' AND EXISTS(SELECT 1 FROM consent_private.decisions WHERE user_id=uid AND scope='ai' AND decision='granted') THEN
    UPDATE consent_private.decisions SET decision='revoked',document_version=p_document_version,decided_at=at_time WHERE user_id=uid AND scope='ai';
    INSERT INTO consent_private.events VALUES(uid,p_operation_id,'ai','revoked',p_document_version,p_locale,current_revision,at_time,'health_withdrawal');
  END IF;
  RETURN consent_private.own_snapshot();
END $$;
CREATE FUNCTION public.record_data_consent(p_scope text,p_decision text,p_document_version text,
  p_locale text,p_operation_id uuid,p_expected_revision bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT consent_private.record_decision(p_scope,p_decision,p_document_version,p_locale,p_operation_id,p_expected_revision)
$$;
-- Service API takes a verified identity; clients cannot query another account.
CREATE FUNCTION consent_private.processing_allowed(p_user_id uuid,p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN NOT (enabled OR activated_at IS NOT NULL) THEN true ELSE
    p_user_id IS NOT NULL AND p_scope IN ('health','ai') AND consent_private.has_consent(p_user_id,'health')
    AND (p_scope='health' OR consent_private.has_consent(p_user_id,'ai')) END
  FROM consent_private.settings WHERE singleton
$$;
CREATE FUNCTION public.check_data_processing_consent(p_user_id uuid,p_scope text DEFAULT 'health')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT consent_private.processing_allowed(p_user_id,p_scope)
$$;
-- No activation until the separate enforcement migration is installed and verified.
CREATE FUNCTION consent_private.guard_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.enabled OR NEW.activated_at IS NOT NULL THEN RAISE EXCEPTION 'consent_enforcement_not_installed' USING ERRCODE='55000'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_activation_guard BEFORE UPDATE ON consent_private.settings
FOR EACH ROW EXECUTE FUNCTION consent_private.guard_activation();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA consent_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_data_consents(),public.record_data_consent(text,text,text,text,uuid,bigint),public.check_data_processing_consent(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA consent_private TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION consent_private.own_snapshot(),consent_private.record_decision(text,text,text,text,uuid,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_consents(),public.record_data_consent(text,text,text,text,uuid,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION consent_private.processing_allowed(uuid,text),public.check_data_processing_consent(uuid,text) TO service_role;
INSERT INTO consent_private.documents(version,copy) VALUES('2026-10-01.1',$copy${"de":{"healthTitle":"Gesundheitsdaten","healthBody":"Lotti Baby verarbeitet Angaben zu Schwangerschaft und Geburt, Zyklus, Schlaf, Ernährung, Windeln, Wachstum, Entwicklung, Stimmung und deine zugehörigen Notizen. Dazu können besonders geschützte Gesundheitsdaten von dir und deinem Kind gehören. Wir speichern und verarbeiten diese auf deinem Gerät und bei Supabase für eure Dokumentation, Auswertungen, Synchronisierung und von dir aktivierte Erinnerungen. Von dir freigegebene Familieninhalte sind für berechtigte Partner und Betreuungspersonen zugänglich. Cloud-Dienste können Daten auch außerhalb der EU, insbesondere in den USA, verarbeiten.","healthChoice":"Ich stimme der beschriebenen Verarbeitung meiner Daten und der Daten meines Kindes ausdrücklich zu. Für mein Kind bin ich zur Einwilligung berechtigt.","healthConsequence":"Ohne Zustimmung bleiben Schwangerschaft, Baby-Tracking und Funktionen mit diesen Daten ausgeschaltet. Einwilligungen, Datenschutz, Support und die Kontolöschung bleiben erreichbar.","aiTitle":"KI-Verarbeitung","aiBody":"Für Frag Lotti, KI-Texte in Lottis Fürsorge und Spracheingaben senden wir ausgewählte Inhalte über Supabase an OpenAI: Fragen und Gesprächsverlauf, Babyname und Alter bzw. Schwangerschaftswoche sowie passende Tracking-Auswertungen und Notizen. Bei Spracheingaben gehören auch deine Audioaufnahme und der erkannte Text dazu. Diese Inhalte können Gesundheitsdaten von dir oder deinem Kind enthalten. OpenAI kann sie auch in den USA verarbeiten. Die Verarbeitung dient Antworten, persönlichen Hinweisen und Vorschlägen für Einträge. Bestätigte Einträge und Fürsorge-Hinweise werden bei Supabase gespeichert; die Aufbewahrung bei Dienstleistern ist in der Datenschutzerklärung erläutert.","aiChoice":"Ich stimme der beschriebenen Übermittlung an OpenAI und der KI-Verarbeitung ausdrücklich zu.","aiConsequence":"Ohne diese zusätzliche Zustimmung sind Frag Lotti, KI-Texte und Spracheingaben ausgeschaltet. Manuelle Einträge und Fürsorge ohne KI bleiben mit Gesundheits-Einwilligung verfügbar.","withdrawal":"Du kannst jede Einwilligung hier jederzeit widerrufen. Danach starten keine neuen Verarbeitungen für diese Funktionen. Bei KI-Widerruf werden lokale Lotti-Gespräche entfernt; bei Gesundheits-Widerruf zusätzlich lokale Datenzwischenspeicher, Entwürfe und Erinnerungen auf diesem Gerät. Bereits übermittelte Inhalte und rechtmäßig erfolgte Verarbeitung werden dadurch nicht rückwirkend gelöscht; dafür gibt es Konto & Daten löschen. Der Widerruf der Gesundheits-Einwilligung widerruft auch die KI-Einwilligung. Dein Abo wird durch einen Widerruf nicht gekündigt.","settingsIntro":"Du entscheidest getrennt über Gesundheitsdaten und KI. Eine Zustimmung ist freiwillig und wird mit Zeitpunkt und Textversion gespeichert. Du kannst sie jederzeit widerrufen.","privacy":"Datenschutzerklärung lesen"},"en":{"healthTitle":"Health data","healthBody":"Lotti Baby processes pregnancy and birth information, cycle, sleep, feeding, diapers, growth, development, mood and related notes. This may include special-category health data about you and your child. We store and process it on your device and with Supabase for records, summaries, synchronization and reminders you enable. Family content you share is accessible to authorized partners and caregivers. Cloud providers may process data outside the EU, particularly in the USA.","healthChoice":"I explicitly consent to the processing described for my data and my child’s data. I am authorized to consent for my child.","healthConsequence":"Without consent, pregnancy, baby tracking and features using this data stay disabled. Consents, privacy, support and account deletion remain available.","aiTitle":"AI processing","aiBody":"For Ask Lotti, AI wording in Care and voice input, we send selected content through Supabase to OpenAI: questions and conversation history, baby name and age or pregnancy week, and relevant tracking summaries and notes. Voice input also includes your audio recording and its transcript. Content may include your or your child’s health data. OpenAI may process it in the USA. Processing provides answers, personal insights and entry suggestions. Confirmed entries and Care messages are stored with Supabase; provider retention is explained in the privacy policy.","aiChoice":"I explicitly consent to the described transfer to OpenAI and AI processing.","aiConsequence":"Without this additional consent, Ask Lotti, AI wording and voice input stay disabled. Manual entries and Care without AI remain available with health consent.","withdrawal":"You can withdraw either consent here at any time. No new processing for those features will start afterwards. AI withdrawal clears local Lotti conversations; health withdrawal also clears local cached data, drafts and reminders on this device. Previously transmitted content and lawful processing are not retroactively deleted; use Delete account & data for deletion. Withdrawing health consent also withdraws AI consent. Withdrawal does not cancel your subscription.","settingsIntro":"You decide separately about health data and AI. Consent is voluntary and saved with its time and text version. You can withdraw it at any time.","privacy":"Read privacy policy"},"es":{"healthTitle":"Datos de salud","healthBody":"Lotti Baby trata información sobre embarazo y parto, ciclo, sueño, alimentación, pañales, crecimiento, desarrollo, estado de ánimo y notas relacionadas. Puede incluir datos de salud especialmente protegidos sobre ti y tu hijo. Los almacenamos y tratamos en tu dispositivo y en Supabase para registros, resúmenes, sincronización y recordatorios que actives. El contenido familiar que compartas es accesible para parejas y cuidadores autorizados. Los proveedores en la nube pueden tratar datos fuera de la UE, especialmente en Estados Unidos.","healthChoice":"Consiento expresamente el tratamiento descrito de mis datos y los de mi hijo. Estoy autorizado para consentir por mi hijo.","healthConsequence":"Sin consentimiento, el embarazo, el seguimiento del bebé y las funciones que usan estos datos quedan desactivados. Los consentimientos, privacidad, soporte y eliminación de cuenta siguen disponibles.","aiTitle":"Tratamiento con IA","aiBody":"Para Pregunta a Lotti, textos de IA en Cuidados y entradas de voz enviamos contenido seleccionado a OpenAI a través de Supabase: preguntas e historial, nombre y edad del bebé o semana de embarazo, resúmenes de seguimiento y notas pertinentes. Las entradas de voz incluyen también la grabación y su transcripción. El contenido puede incluir datos de salud tuyos o de tu hijo. OpenAI puede tratarlos en Estados Unidos para respuestas, consejos y propuestas de registros. Los registros confirmados y mensajes de Cuidados se guardan en Supabase; la política de privacidad explica la conservación en los proveedores.","aiChoice":"Consiento expresamente el envío a OpenAI y el tratamiento con IA descritos.","aiConsequence":"Sin este consentimiento adicional, Pregunta a Lotti, los textos con IA y las entradas de voz quedan desactivados. Los registros manuales y Cuidados sin IA siguen disponibles con consentimiento de salud.","withdrawal":"Puedes retirar cada consentimiento aquí en cualquier momento. Después no se iniciarán nuevos tratamientos para esas funciones. La retirada de IA borra las conversaciones locales con Lotti; la retirada de salud también borra datos en caché, borradores y recordatorios locales de este dispositivo. Los contenidos ya enviados y el tratamiento lícito previo no se eliminan retroactivamente; para ello existe Eliminar cuenta y datos. Retirar el consentimiento de salud también retira el de IA. La retirada no cancela tu suscripción.","settingsIntro":"Decides por separado sobre los datos de salud y la IA. El consentimiento es voluntario y se guarda con fecha y versión del texto. Puedes retirarlo en cualquier momento.","privacy":"Leer política de privacidad"}}$copy$::jsonb);
COMMIT;
