# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Genehmigte und tatsächlich gespeicherte Regeln

**Jan Zeppenfeld** hat die im Auftrag enthaltenen fachlichen Regeln genehmigt; tatsächliche Datenbankdokumentation **2026-10-02T10:12:40.492461+00:00**. Produktionsmodus `supervised`, unbekanntes Backupmaximum `NULL`, Frist für abgeschlossene Löschbelege 90 Tage. Datenreset löscht Consententscheidungen, Ereignisse und alte Idempotenzbelege und erhöht ausschließlich die technische Revision; neue Zustimmung muss ausdrücklich erfolgen. Kontolöschung entfernt alle vier Nutzerbestände, globale settings/documents bleiben erhalten. Keine zusätzliche kontobezogene Consent-Belegaufbewahrung; 90 Tage sind keine Consent-Frist.

Diese Policy ist bereitgestellt, aber technische Produktionsaktivierung fehlt: Inventarfingerprint `409aba7a6ac8886f89271bb8abb58884` frisch geprüft, `approved_fingerprint/by/at=NULL`, Readiness false, Annahme/Worker und separater Consent-Rollout aus. Die bestehende bedingte Aktivierungsautorisierung wird nach belegter allseitiger Restoreisolation und echtem Produktionsregisterfall mit Jan, tatsächlicher Zeit und frisch geprüftem Stand dokumentiert. Keine abweichende Policy oder erfundene Freigabe.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Festgelegte Löschregeln – 01.10.2026

Diese Betriebsregeln sind auf ausdrücklichen Auftrag von Jan Zeppenfeld im Chat festgelegt („wenn auch nicht, dann leg das bitte fest“). Verantwortlicher: Jan Zeppenfeld. Sie ersetzen die bisherigen Vorschläge zur Datenbehandlung, Reaktionszeit und 365-tägigen Belegaufbewahrung. Ihre Festlegung bestätigt keine noch ungeprüfte Anbieterfrist, keinen vollständigen Schemaabgleich und keine technische Produktionsabnahme.

## Umfang und Datenbehandlung

| Bestand | Festgelegte Behandlung |
| --- | --- |
| Kontolöschung (`account`) | Eigene persönliche App-Daten, Profil, Auth-Konto, Sitzungen, Push-Zuordnungen und eindeutig eigene Dateien entfernen. Zugeordnete externe Kontodaten löschen bzw. den tatsächlichen Anbieterfall gesondert bearbeiten. Ein Store-Abonnement muss unabhängig beim Store gekündigt werden. |
| Datenreset (`data`) | Persönliche App-Daten und eigene Dateien nach denselben Eigentumsregeln entfernen. Auth-Konto und notwendige Aboverwaltung bleiben erhalten. Zugriff während der Bearbeitung sperren; danach erneute Anmeldung ermöglichen. |
| Ausschließlich eigenes Baby oder eigene Gruppe | Die zugehörigen eigenen Daten entfernen, sofern keine Daten/Rechte anderer Personen betroffen sind. Mitgliedschaften und Zugriffsfreigaben des ausscheidenden Kontos entfernen. |
| Gemeinsam betreutes Baby, gemeinsame Gruppe oder eigene Einträge in einem fremd verwalteten Baby | Fremde und gemeinsame Inhalte vor unbeabsichtigter Löschung schützen. Vor destruktiven Phasen anhalten. Jan prüft den Einzelfall: personenbezogene Inhalte der ausscheidenden Person löschen oder nachweislich redigieren; fortbestehende Familiendaten nur mit geprüftem Zweck und Berechtigung erhalten. Notwendige Nachfolge ausschließlich auf ein vorhandenes, berechtigtes Mitglied, mit dessen dokumentierter Übernahme. Keine automatische oder erfundene Nachfolgeidentität. Ohne geklärte Berechtigung bleibt der Fall offen; kein Abschlussvermerk. |
| Eigene öffentliche Beiträge und Rezepte | Eigene Beiträge, Rezepte und zugehörige Medien grundsätzlich löschen, auch wenn sie global veröffentlicht wurden. Übernommene Kopien und fremde Verweise vorab prüfen. Eine erhaltene Kopie benötigt einen geprüften eigenen Zweck/Berechtigung und die Entfernung personenbezogener Angaben; Veröffentlichung allein rechtfertigt keine dauerhafte Aufbewahrung. |
| Nachrichten anderer Personen | Fremde Nachrichten nicht pauschal löschen; Empfänger-/Kontoverknüpfungen entfernen. Enthaltene Namen, E-Mail-Adressen, Fotos oder andere personenbezogene Kopien der ausscheidenden Person zusätzlich prüfen und nötigenfalls redigieren/löschen. Eine entfernte UUID allein gilt nicht als Anonymisierung. |
| Moderation, Admin-Snapshots und Audit-JSON | Personenbezogene Kopien in abgeschlossenen Fällen entfernen oder nachweislich redigieren. Für einen noch erforderlichen Einzelfall nur den nötigen Teil getrennt und geschützt halten: konkreter Zweck, begründete Berechtigung, Bearbeiter, Enddatum und nächste Prüfung. Kein pauschaler Dauerbestand; mindestens wöchentlich prüfen und bei Wegfall des Zwecks entfernen. |
| Dateien und Caches | Eigentum anhand verlässlicher Objekt-/Datensatzzuordnung und bekannter exakter Pfade bestimmen. Ursprung über Storage API entfernen, ursprüngliche öffentliche URLs gezielt bereinigen und ihre Nichtverfügbarkeit prüfen. Fremde Medien sowie ungeklärte historische Uploads nicht anhand von Namensfragmenten löschen. Lokale App-Kopien beim Vorgang bereinigen; bereits heruntergeladene fremde/Browserkopien als eigenen Prüffall behandeln. |

Nach Annahme eines verifizierten Auftrags werden bestehende Sitzungen beendet und weiterer Kontozugriff sowie verspätete Schreibzugriffe gesperrt. Die Sperre bleibt während manueller Fälle bestehen. Annahme, Löschung im aktiven System und vollständiger Abschluss sind getrennte Zustände. `completed` erst setzen, wenn sämtliche Pflichtprüfungen und Anbieterfälle tatsächlich abgeschlossen oder nach belegter Prüfung nicht anwendbar sind.

## Eigene Aufbewahrung und Zweck

| Datenklasse | Festgelegte Frist | Zweck und Begrenzung |
| --- | --- | --- |
| Minimaler Löschbeleg und minimale Supportreferenz | **90 Tage nach belegtem Gesamtabschluss**, anschließend entfernen | Klärung unmittelbar anschließender Rückfragen/Fehler sowie nachvollziehbarer Abschluss. Nur Referenz, nötige interne Kontokennung, Umfang, Zeiten, Status, Bearbeiter und knappes Nachweisergebnis. Keine Kinderdaten, Rohdatenexporte, Passwörter, OTPs oder Tokens. Das ist eine eigene Betriebsfrist, keine behauptete gesetzliche 90-Tage-Pflicht. |
| Provider-Lokatoren und Arbeitspfade | Nur bis zum Abschluss ihres notwendigen Bearbeitungsschritts | E-Mail-/Anbieterkennungen nach Abschluss des jeweiligen Providerfalls entfernen; Objektpfade nach Gesamtabschluss. Identitätsunterlagen auf das erforderliche Prüfergebnis reduzieren. Rohanhänge und unnötige Mailinhalte nicht als Löschbeleg archivieren. |
| Noch offene Aufträge und Wiederherstellungsregister | Nur solange Bearbeitung oder nachgewiesene Wiederherstellungsmöglichkeit es erfordern | Täglich betreuen; Zweck, Verantwortlichen, nächsten Prüftermin und tatsächliche Endbedingung dokumentieren. Kein offener Auftrag wird automatisch nach 90 Tagen weggeworfen. Unbekannte Kopien dürfen weder als erledigt noch durch ein erfundenes Enddatum geschlossen werden. |
| Eigene technische Diagnoseprotokolle | **7 Tage ab Entstehung**, anschließend entfernen | Kurzfristige Fehlerdiagnose; Inhalte und Identitäten möglichst gar nicht protokollieren. Ein konkreter laufender Vorfall braucht für jede längere Aufbewahrung eine begründete Ausnahme mit Enddatum und wöchentlicher Prüfung. |
| Selbst verwaltete reguläre Backups/Exporte, falls vorhanden | Ziel: **höchstens 7 Tage ab Erstellung**; keine neuen personenbezogenen Dauerexporte | Nur Wiederherstellung. Vorhandene externe Kopien und tatsächliche automatische Bereinigung müssen zuerst inventarisiert und geprüft werden. Arbeitsexporte nach ihrem Zweck sofort entfernen. Diese Regel ist keine Bestätigung, dass ältere oder unbekannte Kopien bereits entfernt sind. |

Die 90-Tage-Frist gilt für den minimalen abgeschlossenen Beleg, nicht für weiter genutzte App-Daten. Ist eine konkrete gesetzlich nötige Aufbewahrung betroffen, wird nur dieser Bestand mit Zweck, Rechtsgrund und tatsächlichem Enddatum gesondert behandelt; kein pauschales Aufbewahren des gesamten Kontos. Der vorhandene Worker bereinigt abgeschlossene Aufträge nach `max(receipt_retention_days, backup_window_days)`. Für die spätere Konfiguration ist `receipt_retention_days=90` festgelegt. `backup_window_days` bleibt bis zum belegten maximalen Wiederherstellungsfenster ungesetzt. Ein längeres Fenster erfordert eine gesonderte, begründete Behandlung des notwendigen Wiederherstellungsregisters.

## Anbieterfristen und offene Tatsachen

Supabase nennt für Pro tägliche Backups mit sieben Tagen Aufbewahrung sowie sieben Tage API-/Datenbank- und Auth-Logaufbewahrung. Am 01.10. bestätigt die Anbieter-API diese beiden 7-Tage-Entitlements tatsächlich für die richtige Organisation; Produktion und Familien-QA haben keinen ausgewählten PITR-Zusatz. Replikationskatalog: nur zwei Supabase-Realtime-Slots in Produktion, keine in QA, keine PostgreSQL-Subscriptions. Nachweis: `output/deletion-completion-20260930/provider-retention-live-20261001.json`. Das sind dokumentierte Tarifwerte, keine hier geprüfte Garantie für sämtliche Replikate, Exporte, andere Anbieter oder Browserkopien. Die am 01.10. sichtbaren Backupstände und ausgeschaltetes PITR belegen den aktuellen verfügbaren Bestand; acht sichtbare Einträge legen keine garantierte maximale Gesamtdauer fest. Datenbankbackups enthalten Storage-Metadaten, nicht die Dateiobjekte selbst.

Sentry ist live dem richtigen App-Projekt zugeordnet: kostenloser Developer-Tarif, Datenregion USA, vorhandene Fehler-/Replay-Ingestion. Für neue Developer-Ereignisse dokumentiert Sentry 30 Tage; ältere Daten behalten die beim Eingang geltende Frist, Anbieterbackups 30 oder 90 Tage je Datentyp. Kein pauschaler Nichtnutzungs-/Löschbeleg. Neue Ereignisse speichern seit der Prüfung keine IP-Adressen mehr, nach Neuladen bestätigt; vorhandene Ereignisse bleiben davon unberührt. Ein nicht existierender DELETE-Aufruf auf `/users/{id}` wäre kein Löschbeleg. Betroffene Issues, Replays, Attachments, Feedback und übrige Datentypen müssen getrennt behandelt werden; fremde Ereignisse nicht pauschal löschen. Nachweis: `output/deletion-completion-20260930/sentry-retention-live-20261001.json`.

Vor Produktionsaktivierung weiterhin konkret nachzuweisen:

- Das maximale tatsächlich mögliche Wiederherstellungsfenster einschließlich weiterer Kopien; erst danach `backup_window_days` setzen.
- Persönliche externe Backups/Exporte: **am 01.10. durch Jan bestätigt nicht vorhanden**. Das beantwortet den Betreiberbestand auf Rechner, Drive oder anderen Diensten; technisch erzeugte Anbieter-/Replikations-/Logkopien bleiben gesonderte Prüffälle.
- Tatsächliche Log-Drains, Replikationsziele, Sentry-/KI-/RevenueCat-/Support-Mail-/Shop-/Alt-Convex-Bestände und ihre Lösch-/Auslaufbedingungen. Nichtnutzung muss geprüft und begründet werden.
- CDN-/Browser- und Gerätebehandlung mit konkreten Nachweisen. Der bestandene einzelne Cache-Purge bestätigt keine universelle Frist.

Diese Tatsachen sind von den nun festgelegten Regeln getrennt. Bei unbekannten oder überfälligen Fristen bleibt der Anbieterfall offen und wird bearbeitet. Wiederhergestellte Daten bleiben isoliert: anhand eines unabhängig gesicherten Löschregisters zuerst Sperren und Löschungen erneut anwenden, dann erst Anwendungszugriff öffnen. Der echte verwaltete Restore-Test vom 01.10. ist bestanden und bereinigt; kein weiterer Testprojektaufbau gehört zu dieser Festlegung.

## Verantwortlichkeit und Bearbeitung

Jan bearbeitet Support und Löschalarme über **support@lottibaby.de**. Interner Standard ab dieser Festlegung: Montag bis Freitag morgens und nachmittags prüfen, neue Anfragen spätestens am nächsten Arbeitstag aufnehmen und einen konkreten Antworttermin erfassen. Technische Alarme beim nächsten Prüffenster priorisieren; bekannte Zugriffs-/Datenschutzprobleme sofort behandeln. Keine 24-Stunden-Bereitschaft wird zugesagt. Unverzüglich bearbeiten und die gesetzliche Antwortfrist grundsätzlich eines Monats verfolgen; interne Arbeitstage verlängern diese Frist nicht.

Die Ehefrau übernimmt nur ausdrücklich übergebene Fälle mit tatsächlich vorhandenem geschütztem Zugriff. Solange dieser Zugriff nicht nachgewiesen ist, bleibt Jan zuständig. Übergabe: Referenz, Status, nächste Handlung und Termin; keine persönlichen Inhalte in Alarmmails. Keine Passwörter oder OTPs über Support anfordern. Eingangs-/Annahmebestätigung und belegte Abschlussbestätigung getrennt versenden.

## Technischer Umsetzungsstand

Diese Festlegung wurde als Betriebsregel und Entscheidungsnachweis gespeichert. QA-/Produktionswerte wurden dadurch nicht gesetzt; kein Schema-Fingerprint bestätigt und kein echter Löschbetrieb aktiviert. Die Alias-Korrektur `20261001051435` ist inzwischen gezielt in der bestehenden Familien-QA eingespielt und registriert: exakter vorheriger Function-Stand abgeglichen, korrigierter Stand verifiziert, echte Service-Role-Aufrufe für `purge_receipts`/`list` erfolgreich, 16 SQL-Tests bestanden. Sieben QA-Konten, Storagebestand, Berechtigungen, Einstellungen und Scheduler unverändert; keine neuen Advisor-Meldungen. Produktion unverändert. Beleg: `output/deletion-completion-20260930/qa-worker-alias-20261001.json`.

Es fehlen noch der endgültige Inventar-/Policy-Abgleich, vollständiger nativer Ablauf mit ausschließlich Wegwerfdaten, die genannten Anbieterbelege und gezielte Produktionsbereitstellung. Vor Aktivierung jede Tabellen-/JSON-/Medienregel anhand des tatsächlichen Endstands gegen diese Policy prüfen. API-Protokollversion `2026-09-11` bleibt unverändert; Datum dieser Betriebsregel ist `2026-10-01`.

Quellen, am 01.10.2026 geprüft: [Europäische Kommission – Datenminimierung und Speicherbegrenzung](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en?prefLang=hu), [Supabase – Tarifwerte](https://supabase.com/pricing), [Supabase – Backups und Grenzen](https://supabase.com/docs/guides/platform/backups), [Supabase – Logs und Exporte](https://supabase.com/docs/guides/observability/logs). Aktueller technischer Abschlussplan: [verbleibende Schritte](deletion-next-steps-20261001.md).
