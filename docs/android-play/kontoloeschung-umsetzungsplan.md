# Kontolöschung: konkreter Umsetzungsplan

Stand: 11.09.2026. Grundlage: lokaler Arbeitsbaum und aktuelle offizielle Dokumentation. Dies ist ein Plan; kein Backend-Deployment, keine produktive Löschung und keine Veröffentlichung wurden ausgeführt. Vorhandene lokale Änderungen bleiben bestehen.

## 1. Ziel und bestätigte Lücken

Alle Einstiege in App und Website erzeugen denselben dauerhaften Löschauftrag. Die App bestätigt zunächst dessen Annahme; Abschluss wird erst nach überprüfter Löschung beziehungsweise konkret ausgewiesenen Aufbewahrungsausnahmen bestätigt.

Google verlangt einen auffindbaren Weg in der App und eine öffentliche Webressource, über die die Löschung ohne installierte App angefordert werden kann. Zugehörige Nutzerdaten und verarbeitende Dienstleister sind einzubeziehen; begründete Aufbewahrung muss transparent sein. Eine E-Mail-Anfrage ist zulässig, ein Formular nicht zwingend. [Google Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

| Lokaler Befund | Konsequenz |
| --- | --- |
| `lib/profile.ts` ruft `delete_user_data` auf; Avatar wird nur bei übergebener URL behandelt | Umfang hängt vom Einstieg ab; Dateien serverseitig ermitteln |
| Migration `20261226000001_fix_delete_user_data_and_partner_fk.sql` durchsucht `public` nach `user_id`, behandelt einige Sondertabellen und löscht optional `auth.users` | Kein vollständiges Inventar, keine Provider-/Storage-Orchestrierung; private Schemas und indirekte Verweise separat behandeln |
| `parseDeleteUserResponse` akzeptiert auch fehlende/unerwartete Antwortdaten | Striktes Antwortschema; ungültige Antworten niemals als Erfolg werten |
| `revokeAppleSignInBeforeDeletion` blockiert Apple-Konten außerhalb iOS | Android und Browser brauchen einen funktionierenden Apple-/Supportpfad |
| `app/app-settings.tsx` zeigt nach dem RPC bereits „Konto gelöscht“ | Annahme, Bearbeitung, Abschluss und Fehler unterscheiden |
| `contexts/AuthContext.tsx` invalidiert beim Logout bestimmte Caches | Audio, Bilder, lokale KI-Chats, Benachrichtigungen und weitere Speicher explizit inventarisieren |
| `contexts/ConvexContext.tsx` deaktiviert Convex | Keine aktive Übertragung ableiten; frühere Deployments trotzdem auf Altbestände prüfen |
| Öffentliche Lösch-URL ist in `store/support-und-loeschung.md` offen | Website separat bereitstellen und real testen |

## 2. Arbeitspaket A: vollständiger Löschumfang und Live-Abgleich

Ergebnis: `docs/privacy/deletion-inventory.md` mit einer Zeile pro Tabelle, Dateityp, Cache und Dienstleister: Eigentümer-/Betroffenenbezug, Auswahlregel, Löschaktion, mögliche Ausnahme, Frist, Prüfabfrage und verantwortliche Person.

1. Read-only tatsächliches Schema, FKs, Trigger, RPCs, Storage-Buckets und deployed Functions exportieren. Lokale SQL-Dateien sind kein Deploymentbeleg; insbesondere die Zukunftsdatierungen nicht als Reihenfolge einer produktiven Installation voraussetzen.
2. Alle App-Schemas aufnehmen, ausdrücklich `caretaker_private.grants`, nicht nur `public`. Spalten wie `owner_id`, `created_by`, `sender_id`, `receiver_id`, `baby_id`, `invited_id`, `reporter_id`, JSON-Payloads und indirekte Kindtabellen untersuchen.
3. Tracking, Gesundheitsdaten, Babyprofile, Familienfreigaben, Aufpasserzugang, Community/Chats, Planer/Kalenderverweise, Einkauf/Kundenkarten, Fürsorge, KI-Quoten, Push-Tokens, Consent, Abocache, Webhook-Payloads und Moderation abdecken. Startpunkt: `store/dateninventar.md`.
4. Anbieter-Dashboards und Verträge auf tatsächlich aktivierte Integrationen, Logs, Replays, Exporte, Replikate, Backups und Altprojekte prüfen. Keine API-Schlüssel oder personenbezogenen Beispiele in die Dokumentation schreiben.
5. Explizites Löschmanifest erstellen. Ein Schema-Vergleich in CI meldet neue Tabellen/Referenzen ohne zugeordneten Lösch- oder Aufbewahrungsentscheid. Das Schema dient der Vollständigkeitsprüfung; nicht zur ungeprüften dynamischen Massenlöschung.

Abnahme: Jede relevante Datenquelle hat eine ausführbare Auswahlregel und einen überprüfbaren Abschlusszustand. Unbekannte Quellen sind offene Punkte, keine stillschweigenden Ausnahmen.

## 3. Arbeitspaket B: Familien- und Community-Regeln

Vor den SQL-Löschschritten fachlich festlegen und in der Bestätigung erklären:

- Persönliche Kontodaten und eigene private Inhalte löschen; Zugänge, Einladungen, Push-Tokens und Freigaben sofort widerrufen.
- Eigene veröffentlichte Nachrichten/Beiträge einschließlich Anhängen löschen; gegebenenfalls einen inhaltslosen Platzhalter für Gesprächsstruktur verwenden. Eine entfernte Autor-ID anonymisiert verbleibenden Freitext nicht automatisch.
- Von anderen Personen verfasste Inhalte nicht pauschal wegen `receiver_id` löschen. Eigene Zustell-/Lesebeziehungen entfernen; Inhalte mit personenbezogenem Bezug im definierten Löschumfang gesondert behandeln. Gegenwärtige Direktnachrichten-Regel ausdrücklich ablösen.
- Bei Babys zwischen allein verwalteten Daten und Daten mit weiteren berechtigten Sorgepersonen unterscheiden. Empfohlene Produktregel: allein verwaltete Baby-Daten löschen; bei fortbestehender Berechtigung anderer Eltern deren Daten und legitime gemeinsame Baby-Daten erhalten, persönliche Daten des ausscheidenden Kontos entfernen. Zweck/Rechtsgrundlage der verbleibenden Daten dokumentieren; keine pauschale Ausnahme für alle „Familieninhalte“.
- Gruppen-/Baby-Eigentum vor dem Löschen auf zulässige Nachfolge prüfen. Übertragung nur nach festgelegter Berechtigung und gegebenenfalls Annahme; ohne Nachfolger definierte Auflösung. Keine automatische Übertragung an Aufpasser und keine unbegrenzte Blockade einer Löschanfrage.
- Synchronisierte Kopien prüfen: Eine ursprüngliche Zeile zu löschen genügt nicht, wenn Inhalte unter der Partner-ID dupliziert wurden. Herkunftsbezug ergänzen, soweit erforderlich; Bestandsfälle gesondert zuordnen.

Abnahme: Tests mit zwei Eltern, einer fremden Familie und einem Aufpasser beweisen sowohl die Entfernung als auch den Erhalt unbeteiligter Daten.

## 4. Arbeitspaket C: dauerhafter serverseitiger Löschauftrag

Neue Komponenten: `supabase/functions/request-account-deletion/`, `process-account-deletion/`, `_shared/accountDeletion/` und Migrationen für ein nicht öffentlich exponiertes Schema `deletion_private`.

**Datenmodell:** `requests` mit zufälliger Auftrags-ID, internem Kontobezug, Quelle, bestätigtem Umfang/Policy-Version, Zeitpunkten und Zustand. `steps` mit eindeutiger Kombination aus Auftrag und Schritt, Versuchen, nächstem Versuch, Worker-Lease, bereinigtem Fehlercode und Nachweisreferenz. `objects` als temporäres, unveränderliches Medienmanifest; `provider_tasks` mit Anbieter, benötigter Kennung, Status und Referenz. Kein Löschauftrag darf durch `ON DELETE CASCADE` am Auth-Konto verschwinden. Kontakt- und Providerkennungen nur eingeschränkt zugänglich und soweit nötig verschlüsselt speichern; nach Erledigung gemäß Frist entfernen.

**API-Vertrag:** `POST request-account-deletion` akzeptiert authentifizierten, kürzlich bestätigten Nutzer, Bestätigung und Idempotenzschlüssel. Nutzer-ID ausschließlich aus verifizierter Identität ableiten. Antwort `202 { requestId, status: "queued" }`; Doppelaufrufe liefern denselben aktiven Auftrag. Unauthentifiziert `401`, unzureichende Bestätigung `403`, ungültige Parameter `400`. Zeitüberschreitungen über vorhandenen Auftrag auflösen, nicht blind einen zweiten erzeugen.

**Ablauf:**

1. Bestätigung validieren; Auftrag und Sperre atomar setzen. Vor Sperre nötige Apple-Bestätigung durchführen oder einen gesicherten, kontogebundenen Fortsetzungspfad vorsehen.
2. Lesen/Schreiben des ausscheidenden Kontos sperren, Sessions widerrufen; Familienfreigaben, Aufpasserzugang, Push und geplante Verarbeitung stoppen. Sperre in RLS, Storage, RPCs und Edge Functions prüfen. Service-Role-Jobs/Webhooks benötigen eigene Prüfungen, weil RLS dort nicht greift. Alte JWTs bleiben sonst bis Ablauf verwendbar. [Supabase Auth](https://supabase.com/docs/guides/auth/managing-user-data)
3. Laufende Uploads/KI-Anfragen/Jobs auslaufen lassen oder abbrechen; anschließend Medien und Providerkennungen vollständig sichern. Ergebnisse schon laufender Requests dürfen nach der Sperre keine Daten neu anlegen.
4. Dateien gemäß Abschnitt 5 löschen; Schritte einzeln verbuchen und nachprüfen.
5. Dienstleisteraufträge mit den gesicherten Kennungen starten. Ein Anbieterausfall darf die Entfernung eigener Daten nicht auf unbestimmte Zeit verhindern.
6. Datenbankinhalte anhand expliziter, FK-gerechter Schritte in Transaktionen entfernen beziehungsweise zulässige Referenzen lösen. Trigger dürfen keine Benachrichtigungen mit gelöschten Inhalten versenden.
7. Auth-Konto serverseitig über `auth.admin.deleteUser` endgültig entfernen, sobald lokale Voraussetzungen einschließlich Storage und benötigter Identitätsdaten erfüllt sind. Kein direkter Client-/SQL-Sonderweg mehr. [Supabase Auth](https://supabase.com/docs/guides/auth/managing-user-data)
8. Unabhängige Kontrollabfragen ausführen; Auftrag bis zum belegten Anbieterabschluss oder dokumentierten, befristeten Ausnahmezustand weiterführen. Status unterscheidet `processing`, `retry_wait`, `needs_attention`, `retention_pending` und `completed`.

**Betrieb:** Worker über geschützten Scheduler, kleine begrenzte Batches und wiederaufnehmbare Schritte ausführen, nicht als Hintergrund-Promise eines HTTP-Aufrufs. Lease verhindert konkurrierende Worker. Vorschlag für Retry-Abstände: 1 Minute, 5 Minuten, 30 Minuten, 2 Stunden, 12 Stunden; anschließend betreute Eskalation mit weiter sichtbarem Auftrag. Permanente Auth-/Konfigurationsfehler sofort eskalieren. Fehlendes Objekt nur nach korrekter Identitäts-/Projektzuordnung als bereits entfernt werten; `401/403` nie als Löschbeleg.

Alte RPC `delete_user_data` beim Rollout absichern: keine weitere sofortige Auth-Löschung. Alte App-Versionen dürfen den neuen Prozess nicht umgehen; klarer Update-/Webhinweis im bisherigen Fehlerformat. „Nur Daten löschen“ erhält einen getrennten Reset-Vertrag mit erhaltenem Login, ohne Rückfall auf den alten unvollständigen Medienpfad.

## 5. Arbeitspaket D: Bilder und Audio vollständig entfernen

| Bucket | Im Quellcode belegte Inhalte / Einstieg |
| --- | --- |
| `community-images` | Avatare, Posts, Meilensteine, Blog-/Wiki-Cover; `lib/profile.ts`, `community.ts`, `milestones.ts`, `blog.ts`, `supabase/wiki.ts` |
| `baby-profile-images` | Babybilder unter Nutzer-/Baby-ID; `lib/babyPhoto.ts` |
| `recipe-images` | Eigene Rezeptbilder; `lib/recipes.ts` |
| `group-event-images` | Gruppenterminbilder; `lib/groupChatEvents.ts` |
| `chat-audio` | Direkt-/Gruppenaudio unter Scope/Nutzer-ID; `lib/chatAudio.ts` |
| `public-images` | Empfehlungsbilder; `lib/supabase/recommendations.ts` |

1. Pfade aus DB-Referenzen, belegter Storage-Eigentümerschaft und geprüften historischen Pfadkonventionen zusammenführen. Auch ersetzte Avatare und Uploads ohne nachfolgende Datenbankzeile finden. Alle Seiten/Unterordner abarbeiten; kein ungenaues UUID-Substring-Matching.
2. Eigentümerschaft der Datei vom fachlichen Löschumfang unterscheiden: Ein empfangener Anhang oder ein zulässig übernommenes Gruppenbild darf nicht versehentlich als eigenes Privatmedium gelöscht werden. Konflikte aus Abschnitt 3 auflösen.
3. Dateien ausschließlich über Storage API `remove` in Batches von höchstens 1.000 entfernen, nicht über SQL an `storage.objects`. SQL entfernt dort nicht die eigentlichen Dateien. Fehler je Batch prüfen. [Supabase Storage](https://supabase.com/docs/guides/storage/management/delete-objects)
4. Nachkontrolle per Objektinventar und tatsächlichem Abruf bekannter öffentlicher/signierter URLs. CDN-/Browsercache-Fristen erfassen und Ablauf/Invalidierung testen; keine sofortige weltweite Unsichtbarkeit aus einem erfolgreichen API-Aufruf ableiten.
5. Für neue Uploads eine verlässliche Medienzuordnung mit Bucket, Pfad, Eigentümer und fachlichem Objekt pflegen. Bestandsdateien nachtragen; unzuordenbare Dateien in einen Prüfbericht aufnehmen. Ein automatischer Orphan-Cleanup benötigt eine belegte Nichtverwendung und Schonfrist.

## 6. Arbeitspaket E: Dienstleister, Logs und Backups

| Dienst | Konkrete Umsetzung und Nachweis |
| --- | --- |
| RevenueCat | Kundenzuordnung und Aliase ermitteln; `DELETE /v2/projects/{project_id}/customers/{customer_id}` serverseitig mit passender Berechtigung. Aliasfälle mit anderen aktiven App-Konten vorher auflösen. Erfolg und anschließendes Fehlen prüfen. Webhook/SDK dürfen gelöschte IDs nicht wieder erzeugen. [API](https://www.revenuecat.com/docs/api-v2/customer) |
| Apple Sign-In | Bestehende Revoke-Function übernehmen, Identitätsbindung und Fehler prüfen. Browser-Reauth mit konfiguriertem Apple-Weblogin für Android/Web ermöglichen; Legacy-/Relay-Fälle über betreuten Identitätsnachweis bearbeiten. Keine iPhone-Pflicht. Tokenwiderruf im Auftrag nachweisen. [Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/) |
| OpenAI | Tatsächliche Endpunkte/Projekte inventarisieren. `store:false` beibehalten/prüfen; persistierte Ressourcen, falls vorhanden, anhand IDs löschen. Abuse-Logs, endpointabhängige Fristen und genehmigte Datenkontrollen gesondert dokumentieren; `store:false` ist kein Nachweis für Zero Data Retention. Wo keine nutzerbezogene Lösch-API existiert, Anbieterprozess und Aufbewahrung belegen statt einen fiktiven API-Erfolg zu speichern. [Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data) |
| Sentry | Reale Zuordnung über Nutzerkennung, vorhandenen RC-Nutzerhash, Event-/Replay-IDs prüfen. Unterstützte Löschung je Datenart oder Supportanfrage verwenden; keine erfundene Endnutzer-DELETE-API. Issue-Löschung kann fremde Events betreffen und braucht einen bewusst definierten Prozess. Event-/Replay-/Backupfristen belegen. Neue Logs/Breadcrumbs von Gesundheitsdaten, Tokens, Audio und Fragen bereinigen. [Sentry-Löschverfahren](https://www.sentry.help/en/articles/16187006-how-do-i-complete-a-gdpr-erasure-request-for-a-user-in-sentry) |
| Expo Push / FCM | Eigene Tokens, Payloads und geplante Nachrichten entfernen, Zustellung für gesperrte Konten unterbinden. Anbieterretention und bereits zugestellte Benachrichtigungen separat beschreiben; Tokenentfernung ist keine Löschung aller Anbieterlogs |
| Support-Mail / Resend | Zugehörige Tickets/Meldungen einschließlich Anhängen nach dokumentierter Regel entfernen oder begründet befristet aufbewahren; aktivierten Mailanbieter und Resend-Nutzung live bestätigen |
| Shop / Shopify / Zahlung | Verknüpfte Kunden-/Bestelldaten und Dienstleister bestimmen. Löschung/Redaktion im tatsächlichen Shop-System anstoßen; gesetzlich erforderliche Belege zweckgebunden und befristet aufbewahren. Keine Identitätszusammenführung allein durch unsichere E-Mail-Ähnlichkeit |
| Wetter, Barcode, Hosting/CDN | Ermitteln, welche personenbezogenen Anfrage-/Standortlogs zuordenbar sind. Anbieterprozess beziehungsweise belegte Retention dokumentieren; fehlende App-Konto-ID bedeutet nicht automatisch Anonymität |
| Historisches Convex | Altdeployment auf reale Nutzerdaten prüfen; bei Bestand separat löschen und belegen. Deaktivierter Client allein ist kein Löschbeweis |

Kontolöschung und Kündigung eines Apple-/Google-Abos getrennt erklären; funktionierenden Verwaltungslink zum tatsächlichen Herkunftsstore anbieten. Das Löschen des RevenueCat-Kunden beendet diese Store-Abos nicht automatisch. [RevenueCat](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile)

**Fristen:** Internes vorgeschlagenes Ziel: eigene aktive Daten binnen 24 Stunden nach bestätigtem Auftrag. Das ist keine bereits zugesagte oder von Google vorgeschriebene Frist. Für jeden Anbieter, Backup-/PITR-Typ, Log und legitimen Restbestand vor Veröffentlichung konkrete tatsächlich tragfähige Frist, Zweck und Verantwortlichen eintragen. Kein pauschales „alles nach 30 Tagen“.

**Backups und Wiederherstellung:** Löschregister getrennt vom wiederherzustellenden App-Datenbestand führen, soweit für Wiederanwendung erforderlich. Bei Restore gelöschte Konten vor Freischaltung erneut entfernen. Registerdaten selbst minimieren, zugriffsbeschränken und nach Ende des nötigen Wiederherstellungs-/Nachweiszeitraums löschen. Pseudonyme Kennungen sind nicht automatisch anonym. Lokale Dumps und Testkopien in denselben Prozess einbeziehen.

## 7. Arbeitspaket F: App, lokale Daten und öffentliche Website

**App-Dateien:** `lib/profile.ts`, neues `lib/accountDeletion.ts`, `app/app-settings.tsx`, `app/profil.tsx`, `app/dsgvo.tsx`, zugehörige Übersetzungen und `contexts/AuthContext.tsx`.

- Einheitlicher klar benannter Einstieg „Konto und Daten löschen“; konkrete Auswirkungen auf Baby/Familie, Medien und Abo vor Bestätigung zeigen.
- Nach bestätigter Annahme lokalen Zugriff beenden und „Löschung beauftragt“ mit Referenz anzeigen. Fehlender/ungültiger Servernachweis ergibt keinen Erfolg. Netzwerkabbruch nach Annahme über Statusabfrage auflösen.
- Zentralen idempotenten Cleanup für Auth-/Memory-/AsyncStorage-Daten, Frag-Lotti-Chats, Bild-/Audiocaches, Aufnahmedateien, Push-/lokale Erinnerungen, Widgets/Live Activities und Hintergrundjobs ergänzen. Laufende Requests dürfen Caches nicht wieder befüllen.
- Cleanup bei gesperrter/gelöschter Sitzung auch auf weiteren Geräten auslösen; offline gespeicherte Kopien können erst bei nächstem Kontakt entfernt werden. Bereits exportierte Dateien, Empfängerkopien und externe Systemkalender nicht als fernlöschbar versprechen. App-erzeugte Kalendertermine anhand der Sync-Verweise gezielt und mit klarer Nutzerinformation behandeln.

**Öffentliche Ziel-URL:** `https://lottibaby.de/konto-loeschen` (vorgeschlagen, noch nicht als vorhanden verifiziert). Das Website-Quellprojekt/Deployment zuerst identifizieren; `hostinger-coming-soon` ist kein Beleg für die aktuelle Live-Website. Kein erfundenes Framework voraussetzen.

Die Seite nennt „Lotti Baby“, Betreiber/Kontakt, Löschumfang, Schritte, tatsächliche Bearbeitungsfristen, Anbieter-/Backup-Ausnahmen, Familienfolgen und Aboverwaltung. Verlinkung in Website-Footer, Datenschutz, App und Play Console; mindestens Deutsch und Englisch.

**Browserablauf:** E-Mail eingeben → neutrale Antwort unabhängig von Kontobestand → einmaligen kurzlebigen Bestätigungslink an die bereits verifizierte Kontoadresse senden → Umfang erklären und ausdrücklich per POST bestätigen → denselben Backendauftrag erzeugen. Token nur gehasht speichern, einmal verwenden, Ablauf und Rate-Limits prüfen; GET durch Mail-Vorschau darf niemals löschen. Keine Kontoerstellung als Nebenwirkung, kein Token in Analytics/Referrer/Logs, keine frei wählbare Ziel-User-ID. Browserstatus nur über gesicherten, zeitlich begrenzten Zugriff; zufällige Auftrags-ID allein reicht nicht als Autorisierung.

**Supportfallback:** Sichtbarer Kontakt `support@lottibaby.de`, Betreff „Lotti Baby – Konto löschen“, besonders für fehlenden Mailzugang/Apple-Relay. Mitarbeitende bestätigen Identität über einen festgelegten, verhältnismäßigen Prozess und starten den gleichen Auftrag. Eine bloße Absenderadresse genügt nicht als Identitätsnachweis. Kein App-Download erforderlich; reale Betreuung und Eskalation sicherstellen.

## 8. Umsetzungsschritte und Abnahme

| Reihenfolge | Lieferung | Schätzung aktive Arbeit |
| --- | --- | --- |
| 1 | Live-Inventar, Familienregeln, Anbieter-/Fristenmatrix | 1–2 Tage |
| 2 | Löschauftrag, Sperren, SQL-Manifest, Medienlöschung, Legacy-RPC-Schutz | 2–4 Tage |
| 3 | Anbieteradapter und dokumentierte manuelle Verfahren | 1–3 Tage |
| 4 | Einheitliche App-Oberfläche, Cleanup, Apple-/Browserpfad, öffentliche Seite | 2–3 Tage |
| 5 | Integrationstests, Restore-Probe, Staging-Nachweis und kontrollierter Rollout | 1–2 Tage |

Gesamt grob 7–14 Arbeitstage für eine umsetzende Person, zusätzlich externe Wartezeit und etwaige Bereinigung komplexer Altbestände. Schätzung setzt erreichbare Anbieter-/Website-Zugänge voraus.

**Verbindliche Tests:**

1. Je frischem Testkonto alle sechs belegten Buckets bestücken, mehrere/ersetzte Bilder, verwaiste Uploads, mehrseitiges Objektinventar, Direkt-/Gruppenaudio und indirekte DB-Daten erzeugen; Bestand vorher erfassen.
2. Alle drei App-Einstiege, Browser ohne App, Apple-Konto auf Android und Supportfall durchlaufen. Frische Bestätigung, falsche/abgelaufene/recycelte Tokens, fremde ID und doppelte Anfragen testen.
3. Nach Sperre alte JWTs auf REST/RPC/Storage/Functions und weitere Geräte prüfen; laufenden Upload, verspätete KI-Antwort, Scheduler und RevenueCat-Webhook simulieren. Keine Neuanlage oder weitere Weitergabe.
4. Worker zwischen Teilschritten abbrechen, Storage-/Anbieterfehler, Rate-Limit und Auth-Fehler injizieren. Neustart setzt fort; vorhandene Erfolge bleiben erhalten; keine falsche Abschlussmeldung.
5. Unabhängige Verifikation: keine löschpflichtigen Zeilen/Objekte/Auth-Nutzer; Dateien und alte URLs nicht mehr vom kontrollierten Ursprung abrufbar; Anbieterbelege vorhanden; Partner-/Fremddaten gemäß Regeln erhalten.
6. App-Neustart und Kontowechsel: keine privaten Chats/Bilder/Audios/Erinnerungen des gelöschten Kontos. Zweitgerät online/offline und App-erzeugte Kalenderkopien berücksichtigen.
7. Isolierte Wiederherstellung aus Backup: Löschregister anwenden, bevor Datenzugriff aktiviert wird. Öffentliche Seite über frischen mobilen Browser inklusive tatsächlicher Antragstellung testen.

**Prüfmittel:** gezielte Jest-Tests für Vertrag/UI/Cleanup, SQL-/RLS-Integrationstests in `supabase/tests`, Function-Integrationstests mit kontrollierten Anbieterantworten sowie reale Anbieter-/Storage-Tests mit Wegwerfkonten. Bestehende passende Typecheck-/Lint-Prüfungen ausführen; keine realen Familien- oder Reviewer-Hauptkonten löschen.

**Rollout:** zuerst Migrationen/Sperren und Worker in Staging, dann Anbieter-/Restore-Nachweis; anschließend Backend samt altem RPC absichern, neue App und getestete Website freigeben. Bei Problemen neue Annahmen kontrolliert auf betreuten Support lenken, bestehende Löschaufträge weiterbearbeiten; bereits gelöschte Daten nicht per Rollback reaktivieren.

**Fertig ist der Punkt erst, wenn** der Ende-zu-Ende-Nachweis pro Datenbereich vorliegt, keine ungeklärte Aufbewahrung übrig ist, Betrieb/Eskalation betreut werden und die funktionierende Lösch-URL samt zutreffenden Angaben in Play Console → App-Inhalte → Datensicherheit eingetragen wurde. Nachweise datensparsam in `docs/privacy/deletion-verification.md` dokumentieren; öffentliche Datenschutztexte und `docs/android-play/store/support-und-loeschung.md` auf den belegten Stand aktualisieren.
