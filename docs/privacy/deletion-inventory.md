# Löschinventar – Abgleich vor Produktivfreigabe

## Anbieterfortschreibung 02.10.2026 – Sentry

Die authentifiziert nachgeprüfte Fachantwort **215476206908813** ergänzt die Datenarten des konkreten QA-Falls: fünf positive Fehlerereignisse enthalten SDK-Breadcrumbs, aus der Eingangs-IP abgeleitete **Stadtdaten** trotz laut Antwort unterdrückter IP-Speicherung sowie `user.id`-Tagzusammenfassungen. Keine verknüpften Anhänge/Replays/Feedback wurden vom Support gefunden; drei Traces ohne Performance-Spans. Ein zusätzlich genannter Sitzungskandidat trägt einen anderen Kontohash, ist aber wegen eines zeitnahen B-Logins nicht als global B-frei bewiesen. Kein exklusives weiteres Löschziel daraus ableiten.

Aktive Aufbewahrung: Developer, 30 Tage ab Empfang am 01.10., etwa ab 31.10. nicht mehr zugänglich erwartet. Exakte IDs am 31.10. nach 13:35 UTC lesend prüfen; keine garantierte Gesamtlöschfrist. Allgemeine Backupregel: 90 Tage ab jeweiliger Erstellung, letzter betroffener Stand und konkrete Endbedingung fehlen. Anbieterstatus bleibt `pending`. [Fachantwort, Quellen und konkrete Aktionen](deletion-sentry-support-response-20261002.md), [aktueller Gesamtanbieterstand](deletion-provider-matrix-20261002.md). Die darunter erhaltenen Audit-/Mailzahlen sind historische Befunde; die separate aktive Bereinigung wurde bereits abgeschlossen und wird nicht wiederholt.

## Aktueller Nachtrag 01.10.2026

Die übergreifenden [Löschregeln](deletion-policy-20261001.md) sind auf ausdrücklichen Betreiberauftrag festgelegt; die bisherige 365-Tage-Empfehlung ist durch 90 Tage für minimale abgeschlossene Löschbelege ersetzt. Vor technischer Aktivierung jede konkrete Tabellen-/JSON-/Medienregel am aktuellen Endstand gegen diese Policy prüfen. Anbieter-/Backup-/Exportfristen bleiben nachzuweisen; es wurde kein DB-Fingerprint freigegeben. Echte verwaltete Wiederherstellung samt tatsächlichem Worker-Replay bestanden und Testprojekt entfernt. Frühere datierte Befunde darunter dokumentieren den damaligen Stand. [Aktuell verbleibende Schritte](deletion-next-steps-20261001.md).

## Anbieter-/Restkopienprüfung 01.10.2026, nach bestandenem Native-Worker

Die [aktuelle Abschlussliste](deletion-provider-closure-20261001.md) ersetzt ältere Aussagen zu ausstehenden RevenueCat-/Geräte-/Restoretests: diese Prüfungen sind bestanden. Aktuell ein Anbieterfall `completed`, Apple `not_applicable`, zehn weitere Pflichtfälle offen. Die 117 klassifizierten Anwendungstabellen sind kein Vollständigkeitsbeleg für Anbieter-/Auth-Kopien.

**Neu belegter aktiver Rest:** 18 `auth.audit_log_entries` enthalten nach der Kontolöschung weiterhin die exakte QA-Kennung und E-Mail; zusätzlich 479 externe Logtreffer mit derselben Kennung. Die Auth-Audittabelle besitzt keinen nachgewiesenen automatischen Sieben-Tage-Auslauf. Sie ist ausdrücklich im Fall `external_logs` und wegen möglicher künftiger Sicherungen auch unter `backups` erfasst. [Rohbefunde und begrenzte Aktionsvorbereitung](deletion-provider-supabase-review-20261001.md). Kein fremder Auditbestand wurde gelöscht.

Sentry enthält tatsächliche Fehler-/Replaybestände; OpenAI drei alte gespeicherte Completions; Convex frühere Deployments sind ohne passenden Teamzugang unbekannt. Drei exakt zugeordnete QA-OTP-Mails bleiben im erhaltenen Supportpostfach. Null aktuelle UID-Treffer in App-, Shop- oder Shared-Content-Abfragen beweisen keine Abwesenheit historischer oder kopierter Inhalte. Die folgenden älteren Bestandszahlen bleiben datierte Verlaufseinträge.

## Nachtrag 30.09.2026

Der frühere RevenueCat-Schreibrechteblocker ist für den separaten QA-Löschschlüssel beseitigt: frische synthetische Kunden angelegt, genaue Zuordnung/Aliase geprüft, einer gelöscht und anschließendGET404, der andere erhalten und später separat bereinigt. Dies ist ein Provider-API-Nachweis, noch keine vollständige Worker-/native Abnahme. Mailcodezustellung und exakte QA-Identitätsverifikation sind bestanden.

CDN: Die alte Test-URL lieferte am 30.09. trotz gelöschtem Ursprung wieder HTTP 200/HIT. Gezielter Cache-Purge mit HTTP 200 und folgende Nichtverfügbarkeit derselben URL sind belegt. Automatische Objektlöschung wird deshalb um explizite Cachebereinigung und einen eigenen Pflichtnachweis `storage_cdn` ergänzt. Der Nachweis eines einzelnen CDN-Pfads ersetzt keine globale Frist oder Browsercache-Behandlung. Datenregeln und Aufbewahrungsfristen bleiben weiterhin unfreigegeben. Aktuelle Belege und verbleibende Schritte stehen im [Abschlussplan](deletion-completion-plan-20260930.md).

## Nachprüfung 28.09.2026

Neue lesende Produktions-/QA-Katalogexporte unter `.family-qa/acceptance-20260928/` bestätigen unveränderte Tabellen/FKs gegenüber 26.09. (152 Tabellen, 220 FKs). Die folgende Matrix bleibt gültig, stellt weiterhin keine fachliche Freigabe dar. UUID-Halteprüfung in `content_reports` und `subscription_policy_audit` auf die vollständige Zeile erweitert und ausschließlich in QA verifiziert; Moderator-/Follow-up-IDs und verschachtelte Auditkopien werden damit erfasst. E-Mail-/Namens-/Medienkopien ohne UUID bleiben offen. Konkrete Eigentums-/Aufbewahrungsoptionen in [Entscheidungsvorlage Auftrag 7](../android-play/release-entscheidung-20260928.md); noch keine beschlossen. 129 Regeln unverändert, Fristen/Fingerprint nicht gesetzt.

Stand 26.09.2026. Grundlage sind ein neuer **lesender Produktions-Katalogexport ohne Inhaltsdaten**, Quellcode, die Löschmigration und der QA-Regelbestand. Die vollständige [Schema-Matrix aller 117 `public`-/`caretaker_private`-Tabellen](deletion-schema-matrix-20260926.md) nennt je Tabelle Identitätsspalten, gültige Regeln, FK-Ziele und Medien-/JSON-Spalten. Der private Roh-Katalog unter `.family-qa/account-deletion-production-catalog.local.json` erfasst zusätzlich `auth` und `storage`. 92 der 117 Anwendungstabellen besitzen mindestens eine gültige Regel; das ist **keine** fachliche Gesamtfreigabe. Von 129 Regeln treffen 106 die aktuellen Produktionsspalten; 23 zeigen auf nicht vorhandene Legacy-Ziele und werden nicht bloß zur Fehlervermeidung gestrichen. Der Worker nimmt mangels Fristen und Freigabe keine Aufträge an.

## Live-Abgleich vom 26.09.2026

Produktion `kwniiyayhzgjfqjsjcfu`: 152 Tabellen, 220 FKs, sieben Buckets, 342 Storage-Objekte. `deletion_private` fehlt dort weiter. QA `ggyonianphloycmqrwvj`: gleiche 117 Anwendungstabellen, aber mit nullable `direct_messages.receiver_id` und fünf `paid_*`-Spalten für den Familien-Test; `deletion_private` vorhanden. Die QA-Regeln wurden um 17 zugeordnete Fälle ergänzt und sind **nicht** als Fingerprint freigegeben. Familienmigrationen verändern das Schema erneut: nach Auftrag 5 ist ein frischer Endstand-Abgleich mit neuer Fingerprint-Freigabe Pflicht.

| Fachlich klassifiziert und als `delete` ergänzt | Begründung |
| --- | --- |
| `analytics_events`, `baby_names_favorites`, `hospital_checklist`, `planner_blocks`, `planner_days`, `push_tokens`, `wiki_favorites` jeweils `user_id` | Direkt personenbezogene, über `auth.users` mit `ON DELETE CASCADE` verbundene Einzelbestände; die explizite Regel ermöglicht Medien-/Restprüfung vor Auth-Cascade. JSON `analytics_events.properties` kann fremde Kennungen enthalten und bleibt Inhaltsprüffall. |
| `feeding_events`, `feeding_preferences` jeweils `user_id` | Direktes Konto plus `baby_id`; bei fremd verwaltetem Baby hält die Shared-Baby-Vorprüfung vor der Löschung an. |
| `community_images.user_id` | Direktes Eigentum; öffentliche URL und mögliche Verweise anderer Konten müssen vor Dateilöschung geprüft werden. Aktuell 0 Tabellenzeilen, die Bucket-Objekte sind davon unabhängig. |
| `baby_recipes.user_id` | Direkte Eigentümerschaft und Bildreferenz. **20 global sichtbare Rezepte** halten den Auftrag vor Dateilöschung mit `global_recipe_review_required` an; ihre künftige Behandlung ist fachlich offen. |
| `user_connections` (`inviter_id`, `invited_id`), `user_partners` (`user_id`, `partner_id`), `sleep_entry_shares` (`owner_id`, `shared_with_id`) | Beide Seiten der Beziehung sind personenbezogen; spätes Wiederanlegen wird auch vom ergänzten Write-Guard erfasst. |

**Nicht fertig klassifiziert und damit Freigabeblockade:** Die Behandlung der 20 global sichtbaren `baby_recipes` ist offen; der neue Preflight stoppt solche Konten explizit. `content_reports` enthält 5 Moderationsfälle mit `target_snapshot`, Medienpfad und Beteiligtenrollen. `account_links_audit_log` enthält 314 Zeilen mit `old_data`/`new_data`-JSON ohne FK; dort können gelöschte IDs und kopierte Profildaten verbleiben. Der Preflight stoppt erkannte UUID-Bezüge in beiden Beständen, ersetzt aber keine semantische Inhaltsprüfung. `subscription_policy_audit.changed_by` ist `NOT NULL` und `ON DELETE RESTRICT` (aktuell 0 Zeilen); betroffene Admin-Konten werden nun vorab angehalten. `startup_messages`, `paywall_content_config`, `product_catalog.provider_payload`, `wiki_articles.content`, `direct_messages.metadata`, `sleep_personalization.personalization_data` sowie andere JSON-/Adminbestände brauchen Inhalts- und Aufbewahrungsentscheidung. Indirekt abhängige Tabellen ohne eigene Regel werden nur durch nachgewiesene FK-Cascades erfasst; Matrix und Einzelfalltest bleiben maßgeblich.

**Geteilte Inhalte:** 52 angenommene Account-Links und 74 Babys mit mehr als einem `baby_members`-Eintrag im Produktionsbestand. Eigentumsübergang, Trennung, Medienreferenzen und persönliche Inhalte in erhaltenen Nachrichten sind vor produktiver Löschung fachlich zu entscheiden. Die Vorprüfung hält erkannte gemeinsame Baby-/Gruppenfälle an; sie ersetzt keine Entscheidung über kopierte Inhalte.

**Medien:** `baby-profile-images` 3/0, `baby-size` 43/43, `chat-audio` 3/0, `community-images` 202/0, `group-event-images` 5/0, `public-images` 28/0, `recipe-images` 58/1 (Objekte/eigentümerlos). Die 43 `baby-size`-Objekte sind gemeinsame Produktassets, kein kontobezogener Pfad. Die eine eigentümerlose Rezeptdatei ist in `baby_recipes.image_url` nicht referenziert; ihre historische Herkunft bleibt manuell zu prüfen, ohne Namensfragment-Löschung. Zwei `community-images`-Pfade entsprechen nicht den bekannten Mustern, haben aber Eigentümermetadaten. Alle 342 Objekte tragen `max-age=3600`.

**Medienreferenzen und Kopien:** 746 `baby_info.photo_url`-Werte sind eingebettete `data:`-Bilder (maximal ca. 3,1 MB), eine weitere ist eine öffentliche Projekt-URL. Weitere gezählte Projekt-URLs: 68 `baby_milestone_entries`, 30 `baby_recipes`, 1 `blog_posts`, 1 `community_group_events`, 6 `lotti_recommendations`, 90 `profiles`, 2 `wiki_articles`. Ein `baby_recipes.video_url` ist ein fremder HTTP-Host; `community_group_messages` hat einen Audio-Pfad. Die 20 geprüften URL-/Pfad-Spalten zeigen sonst keine abweichenden HTTP-Hosts, aber verschachtelte JSONs, signierte Alt-URLs, indirekte Kopien und CDN-Ränder sind damit nicht ausgeschlossen. QA löschte ein synthetisches öffentliches Bild via Storage API, die unveränderte URL lieferte unmittelbar danach aus dem CDN noch HTTP 200 (`HIT`). Der tatsächliche Auslauf nach Produktions-TTL und weitere CDN-PoPs sind nicht belegt.

## Bilder und Audio

Der Worker liest Storage-Metadaten und erstellt vor dem Entfernen der Datenbankzeilen eine private Dateiliste. Entfernt wird ausschließlich über die Storage API, anschließend wird das Ergebnis erneut geprüft. Eigentümerschaft erfasst auch verwaiste Dateien; zusätzlich gelten folgende bekannte Pfade:

| Bucket | Zusätzliche Zuordnung |
| --- | --- |
| `baby-profile-images` | `<user-id>/<baby-id>/…` |
| `recipe-images` | `recipes/<user-id>/…` |
| `group-event-images` | `<group-id>/<user-id>/…` |
| `chat-audio` | `<scope>/<user-id>/…` |
| `public-images` | `recommendation-images/<user-id>/…` |
| `community-images` | `avatars/avatar_<user-id>_…`, `blog-covers/blog_<user-id>_…`, `wiki-covers/wiki_<user-id>_…`, `milestones/<baby-id>/<user-id>_…` |

Referenzen aus zu löschenden Zeilen werden zusätzlich ausgewertet: öffentliche URLs müssen exakt zum konfigurierten `settings.storage_origin` und einem vorhandenen Objekt passen; Chat-Audio wird auch über `audio_storage_path` erfasst. Fremde Storage-Eigentümerschaft und Referenzen anderer Nutzer halten den Auftrag vor der Dateilöschung zur Prüfung an. Ein öffentlicher Link ist keine Erlaubnis, die Datei eines anderen Kontos zu entfernen.

**Manuell zu prüfen:** historische Postbilder ohne Eigentümer und ohne verbliebene Referenz, verschachtelte JSON-Referenzen, frühere/custom CDN-Hosts, signierte historische URLs, weitere Buckets sowie Kopien in Moderations-, Support- oder Exportbeständen. CDN- und Backup-Auslauf sind gesondert nachzuweisen.

## Datenbank und gemeinsame Inhalte

Das maschinenlesbare Manifest ist `deletion_private.rules` in der Migration. Die Regeln sind ausdrücklich nach Schema, Tabelle und Eigentümerspalte benannt. Fehlende Tabellen werden nicht automatisch als vorhanden angenommen; Live-Schema und Regeln fließen in einen Fingerprint ein.

Neben `user_id` berücksichtigt das Manifest unter anderem `profiles.id`, `blog_posts.author_id`, `community_group_messages.sender_id`, `community_group_events.created_by_user_id`, `created_by` bei Inventar/Einkauf/Empfehlungen/eigenen Aktivitäten, beide Seiten von Account-Verbindungen, Follows und Blocks sowie private Betreuerfreigaben.

Eigene Direktnachrichten werden entfernt. Bei Nachrichten anderer Absender wird die Empfängerreferenz getrennt; gegebenenfalls darin enthaltene persönliche Informationen bleiben Gegenstand der dokumentierten Prüfung gemeinsamer Inhalte. Geteilte Baby-/Gruppeneigentümerschaft sowie eigene Beiträge in fremd verwalteten Babys verlangen Klärung vor den destruktiven Schritten.

**Manuell zu klassifizieren:** Moderationsberichte und Antwort-Snapshots, Audit-/Adminbestände, JSON-Payloads, indirekte Fremdschlüssel, kopierte Partnereinträge und global geteilte Inhalte. Eine Löschregel nur zu entfernen, um die Prüfung zu umgehen, ist keine zulässige Auflösung.

## Dienstleister und Betrieb

RevenueCat ist als einziger Anbieter für automatische API-Löschung implementiert, aber der aktuelle QA-Schlüssel bestand den Schreibrechtetest nicht (HTTP 403 bei synthetischem Create). Eindeutige Zuordnung, Aliase, echte DELETE-Bestätigung und ausreichende Berechtigung sind vor Freigabe zu belegen; unklare Aliase oder fehlende Anfangsidentität verlangen Prüfung. Apple, OpenAI, Sentry, Push-Anbieter, Support-Mail, Shop, externe Logs, Alt-Convex, Backups und erhaltene gemeinsame Inhalte besitzen eigene verpflichtende manuelle Nachweisaufgaben.

Ein Auftrag erreicht `completed` erst nach Datenbank-/Storage-Prüfung und Abschluss aller Anbieteraufgaben. Eine Aufbewahrungsfrist allein schließt nichts ab. Die privaten Ereignisse dokumentieren Supportprüfung, Anbieterentscheidungen und Wiederaufnahme; sie werden zusammen mit dem befristeten Auftragsnachweis bereinigt.

Die automatisierten Tests verwenden ausschließlich synthetische Konten. In QA wurden Hook und später Service-Role-Schreibzugriff mit einem anschließend entfernten Wegwerfkonto geprüft. Die RevenueCat-API verweigerte die Anlage eines synthetischen Testkunden mit HTTP 403; eine echte Providerlöschung ist daher weiterhin **nicht** nachgewiesen. Native Löschung, E-Mail-Codezustellung, Support-Antwortbetrieb, CDN-Auslauf und isolierter Backup-Restore sind offen. Fristen bleiben ohne Entscheidungsträger und Datum ungesetzt. Schritte und Entscheidungsvorlage stehen im [Runbook](deletion-runbook.md).


## Consent-Inventar 02.10.2026 – aktuelle additive Regeln

Aktuell sechs `consent_private`-Relationen live bestätigt. Im neuen ausgeschalteten Kandidaten gelten `decisions.user_id`, `operations.user_id`, `events.user_id` als exakte `delete`-Ziele. `user_state.user_id` erhält eine explizite, ausschließlich dort zulässige `consent_revision`-Aktion: Konto entfernt die Zeile; Datenreset erhält eine einmal pro Auftrag erhöhte monotone Revisionsuntergrenze und entfernt alle alten Choices/Operationen/Ereignisse. `settings` und `documents` bleiben global erhalten. Vier zusätzliche Policies/Trigger und der Consent-Katalog-/Body-/ACL-Fingerprint schließen die technischen Schreib-/Retrylücken. 122 Guards / 140 Regeln / neun Löschquellen; 16 neue lokale PostgreSQL-Prüfungen bestanden.

Keine Consent-Belegfrist aus der 90-Tage-Löschbelegregel abgeleitet. Neue Policy ist Empfehlung und bleibt `unapproved`; begründete Aufbewahrungsausnahmen benötigen Zweck, Minimalumfang, Zugriff, Fristbeginn/Endbedingung und gegebenenfalls einen separat geprüften Archivpfad vor Annahme. Aktuelle vier Nutzerbestände in Produktion jeweils 0, globale Consent-Aktivierung aus; keine unbekannten Kopien als abwesend behauptet. Keine Livebereitstellung, originale Migrations-/Testbelege und Register erhalten. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
