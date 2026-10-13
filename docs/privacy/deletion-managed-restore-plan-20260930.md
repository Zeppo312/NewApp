# Verwalteter Restore-Test: Abschluss am 01.10.2026

**Bestanden und bereinigt.** Der tatsächliche physische Supabase-Backupstand 1833695425 wurde im bestehenden eigenen Wegwerfprojekt wiederhergestellt. Zwei markierte Auth-/Profil-Identitäten und fehlende aktuelle Löschbelege wurden live nachgewiesen; das wiedererschienene Löschkonto wurde anhand des außerhalb des Backups gehaltenen Registers vor Anwendungseintritt erneut durch den echten Worker gelöscht. Altes frisches Token gesperrt, Kontrollkonto/ursprüngliche Datei/abgetrennte fremde Nachricht erhalten. Kein zweites Projekt angelegt. Quelle entfernt und Abwesenheit per Anbieter-API zweimal geprüft; Produktion bleibt ACTIVE_HEALTHY, Familien-QA ist vorhanden und lesend über die Datenbank erreichbar. Zusätzliche Compute-Schätzung insgesamt **0,16128 USD** (keine bestätigte Rechnung), einmalige Automation beendet.

Nachweise: `output/deletion-completion-20260930/managed-restored-source-deletion.json` und `managed-restore-cleanup.json`. Dies belegt den verwalteten Restore im ausschließlich synthetischen Testprojekt, keinen separaten Klon und keine vollständige Produktionsfreigabe. Die folgenden Abschnitte dokumentieren Planung und Ablauf chronologisch.

## Freigegebener Ablauf ohne Eingriff in die Familien-QA

Ein frisches Micro-Testprojekt in derselben Organisation und Region dient als Backup-Quelle, ein späterer Klon davon als Restore-Ziel. Beide enthalten ausschließlich neu angelegte Wegwerfkonten und Testmedien. Es werden keine Kundeninhalte, Vault-Secrets, ausgehenden Jobs oder bestehende QA-Konten kopiert. Die bewachte Fixture `supabase/tests/account_deletion_managed_fixture.sql` verweigert einen nicht leeren Ausgangsbestand; sie verwendet die echten Supabase-Auth-/Storage-Schemas und ein minimales Anwendungsschema. Die vier aktuellen Löschmigrationen werden nur auf diesem leeren Testbestand angewendet. Dies prüft den verwalteten Sicherungs-/Wiederanlaufmechanismus, ersetzt aber nicht die vollständige Produktionsschema- oder native App-Abnahme.

Am 30.09. ausdrücklich vom Betreiber freigegeben: **höchstens 5 USD zusätzliche Gesamtkosten, höchstens 72 Stunden Laufzeit, danach beide eigenen Testprojekte entfernen**. Der Betreiber verlangt eine zügige Durchführung mit möglichst geringen Kosten. Zwei Micro-Projekte kosten laut aktueller Anbieterangabe zusammen 0,02688 USD/Stunde; 72 Stunden entsprächen rund 1,94 USD Compute zuzüglich gegebenenfalls weiterer Nutzung. Die stundenweise Abrechnung und das Fehlen eines Compute-Spend-Caps sind [dokumentiert](https://supabase.com/docs/guides/platform/manage-your-usage/compute). Vor Anlage tatsächliche Vorschau und Org-Quoten prüfen; bei Abweichung oder nicht kontrollierbarer Laufzeit stoppen. Die automatisierte Fortsetzung und Bereinigung ist im selben Chat eingerichtet. Als zusätzliche Reserve gilt ein geplanter Abbruch schon nach 48 Stunden: **02.10.2026, 20:40 Uhr Europe/Berlin**; absolute Grenze: 03.10., 20:40 Uhr. Die kleine Testquelle muss vor der Löschung einen nachgewiesenen verwalteten Backupstand erhalten; dessen Termin ist noch nicht bestätigt. Die lokale Codex-Automation benötigt einen laufenden Rechner und erreichbare Anbieter-API; sie ist kein serverseitiger Compute-Spend-Cap.

Auf diesem sauberen Quellbestand gibt es keine aktiven ausgehenden Jobs, die beim Klonen das ursprüngliche Familien-QA ansprechen könnten. Kein Klon des derzeit laufenden QA-Bestands wird beauftragt.

## Aktuell belegter Anbieterstand

Kostenklärung am 30.09.: Die offene Supabase-Abrechnung vom 20.09. bis 20.10. zeigt 25,00 USD Pro-Grundpreis, 3,47 USD Produktions-Compute vollständig durch Credits gedeckt und 3,47 USD Branching für die bestehende Familien-QA. Aktueller Rechnungszwischenstand 28,47 USD, Anbieterprognose für Zyklusende 34,33 USD. Letzte bezahlte Rechnung vom 20.09.: 26,79 USD. Die QA ist ein Micro-Preview-Branch mit bislang 258 Stunden in diesem Zyklus. Dieser Billing-Snapshot wurde vor Anlage der Testquelle aufgenommen. Anschließend hat der Betreiber das 5-USD-Budget freigegeben. Ein Micro-Testquellprojekt ist jetzt angelegt, der zweite Klon noch nicht. Der Anlagedialog bestätigte 10 USD zusätzliche monatliche Compute-Kosten für Micro; tatsächlich wird stundenweise abgerechnet. Der aktuelle zusätzliche Rechnungsbetrag ist noch nicht separat im Dashboard ausgewiesen. Quelle: laufendes Billing-Dashboard; `output/deletion-completion-20260930/cost-status.json`. Offener Zwischenstand und Prognose sind keine endgültige Rechnung und keine Gesamtkostenrechnung aller Anbieter.

- Produktion `kwniiyayhzgjfqjsjcfu`: acht sichtbare physische Sicherungen vom 23. bis 30.09.2026; jüngste Sicherung 30.09., 05:31:28 UTC.
- QA `ggyonianphloycmqrwvj`: sieben sichtbare physische Sicherungen vom 23. bis 29.09.2026; jüngste Sicherung 29.09., 23:27:52 UTC. Das heute angelegte OTP-Wegwerfkonto ist darin noch nicht enthalten.
- Der Dialog zum QA-Restore in ein neues Projekt nennt **9,68 USD zusätzliche monatliche Compute-Kosten**, 0 USD zusätzliche Disk-Kosten, gleiche Organisation und Region `eu-central-1`. Der Dialog wurde abgebrochen; kein Projekt wurde angelegt, kein kostenpflichtiger Restore beauftragt.
- Diese Sichtprüfung belegt vorhandene Sicherungen, keine freigegebene maximale Aufbewahrungsfrist einschließlich lokaler Exporte oder zusätzlicher Kopien.

Nachweise: `output/deletion-completion-20260930/production-backups.png`, `qa-backups.png`, `qa-restore-cost.png`.

## Laufender Test und kontrollierte Fortsetzung

1. Ein frisches, ausdrücklich wegwerfbares Auth-/Datenbank-/Storage-Testpaar samt unabhängigen Prüfreferenzen anlegen. Keine bestehenden Familien-QA-Konten löschen.
2. Nachweisen, dass der ausgewählte verwaltete Backupstand die Testidentität enthält. Erst danach das eine Testkonto und seine eigenen Dateien löschen und die Löschregisterreferenz außerhalb des Sicherungsbestands behalten. Das zweite Konto dient als Erhaltskontrolle.
3. Ein separates, vor Zugriff der Anwendung geschütztes Restore-Ziel und eine konkrete Kosten-/Laufzeitgrenze vereinbaren. Die monatliche Anzeige ist eine Kostenübersicht; sie ist keine Zusicherung kostenloser Kurzzeitnutzung.
4. Ausgehende Jobs und Hooks im Restore-Bestand kontrollieren. In QA ist `family-subscription-rechecks` aktiv. Ein binärer Klon kann kopierte Cronjobs und entschlüsselbare Vault-Secrets sofort benutzen und dadurch das ursprüngliche QA ansprechen. Dieser Bestand darf nicht ungeprüft geklont werden.
5. Für einen kontrollierten binären Test einen zuvor gesicherten, ausgehend deaktivierten Quellstand verwenden, ohne den laufenden Familien-Test zu beeinträchtigen. Alternativ einen logischen Restore mit vorab entfernten Jobs/Hooks vorbereiten; dann ausdrücklich ausweisen, dass dies kein Test des nativen physischen Restore-Verfahrens ist.
6. Nach dem Restore unabhängiges Löschregister abgleichen und wieder aufgetauchte Testdaten vor Freigabe erneut löschen. Auth, ursprüngliche Medien-URLs, fremde Konten und Tokenzugriff gesondert prüfen.
7. Ein neues Testprojekt nach der Abnahme kontrolliert außer Betrieb nehmen. Quellen, Kosten, Wiederanlauf, Restbefund und Einschränkungen dokumentieren.

Supabase stellt beim Klonen Datenbank und Auth-Bestand wieder her; Storage-Dateien, Functions und Auth-Konfiguration müssen separat behandelt werden. Die Dokumentation weist ausdrücklich auf sofort startende externe Erweiterungen und Jobs hin: [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project), am 30.09.2026 geprüft. Die Kostenfreigabe liegt vor; eine erfolgreiche verwaltete Wiederherstellung ist weiterhin nicht belegt.

## Aktueller ausführbarer Stand

- Eigene Testquelle `ukpxoxvxxgyvlotntvdl`, Name `lotti-delete-restore-source-20260930`, Organisation `xqbmotyjxjdeqoisbgow`, Region `eu-central-1`, Micro, `ACTIVE_HEALTHY`.
- Bewachtes minimales Anwendungsschema und alle vier aktuellen Löschmigrationen angewendet; Dateihashes im Lifecycle-Nachweis. Zwei echte, ausdrücklich markierte Auth-Wegwerfkonten, zwei Profile und zwei echte Storage-Dateien angelegt. Bereitschafts-RPC über den Service-Zugang liefert `true`; null Löschaufträge. Keine ausgehenden Jobs, Functions oder Vault-Secrets kopiert.
- Testdaten vollständig am 30.09., **19:14:12 UTC** angelegt. Erster physischer Backupstand `1830649403` ist zwar abgeschlossen, stammt aber von **18:46:15 UTC** und wird ausgeschlossen. Vor einem geeigneten neueren Stand wird keines der Testkonten gelöscht.
- `node scripts/managed-deletion-restore.cjs status` und `backups` prüfen ausschließlich diese registrierte Testquelle. `cleanup` prüft Referenz, Namen, Organisation und Region und entfernt nur eigene registrierte Wegwerfprojekte. Ab `cleanupAfter` schalten die Kommandos automatisch auf Bereinigung. Produktion und Familien-QA sind fest ausgeschlossen.
- Restore-Klon: Der dokumentierte Dashboard-Klon benötigt ein neues Datenbankpasswort. Der bestehende CLI-PAT ist für die Dashboard-Klon-API nicht zugelassen (lesender Abruf HTTP 401); keine fremden Connector-Konten oder versteckten Browser-Zugangsdaten verwenden. Sobald ein geeigneter Backupstand vorliegt, wird der Klon im Dashboard konkret vorbereitet; eine nötige Passwort-Eingabe übernimmt der Betreiber direkt dort. Kein Klon und keine zweite Compute-Instanz bisher angelegt.
- Geplante Compute-Obergrenze für zwei Micro-Projekte über jeweils 48 Stunden: rund **1,29 USD**; kein PITR-Zusatz und kein Tarifwechsel. Nach Testabschluss beide sofort entfernen, sonst zu `cleanupAfter`. Nachweis der tatsächlichen Abwesenheit speichern und die einmalige Automation pausieren.

Maßgeblicher Zustand: `output/deletion-completion-20260930/managed-restore-lifecycle.json`, `managed-source-backups.json`. Private Passwörter und Testtokens liegen ausschließlich unter `.family-qa/deletion-completion-20260930/managed-restore/`.


## Fortsetzung am 01.10.2026

Der abgeschlossene physische Backupstand **1833695425**, 01.10. **03:10:17 UTC**, liegt nach der vollständigen Anlage der zwei markierten Auth-/Profil-/Storage-Fixtures. Dieser Stand ist ausgewählt; die tatsächliche Rückkehr der Testidentitäten wird erst im wiederhergestellten Ziel nachgewiesen. Der ältere Stand bleibt ausgeschlossen.

Beim erstmaligen echten Worker-Aufruf wurde ein bisher nicht abgedeckter SQL-Startfehler **42702** belegt: Tabellenalias `r` kollidierte in `list` und `purge_receipts` mit der gleichnamigen PL/pgSQL-Variablen. Die fünfte Migration `20261001051435_account_deletion_worker_aliases.sql` ersetzt nur diese Aliase, erhält Rechte und übrige Funktion. **16 SQL-Tests** einschließlich Startbereinigung, Mindestaufbewahrung, unbekannter Frist und Anbieterübersicht sind bestanden. Die Korrektur wurde ausschließlich in der eigenen Testquelle angewendet; QA und Produktion sind unverändert. Der ausgewählte Backupstand liegt vor der Korrektur: Im Restore-Ziel muss sie vor dem Worker-Replay erneut angewendet werden.

Der tatsächliche `process-account-deletion`-Handler lief lokal gegen echtes verwaltetes Auth und Storage. Auth-Identität, Profil und Storage-Objekt des einen Testkontos sind entfernt; die alte öffentliche Datei liefert HTTP 400, ein frisch vor Annahme ausgestellter Token wird mit 42501 gesperrt. Kontrollkonto, Profil, ursprüngliche Datei mit gleichem SHA-256 und fremde Nachricht mit abgetrennter Empfängerreferenz bleiben erhalten. Das externe Löschregister liegt privat außerhalb des Backups. Nachweis: `managed-source-deletion.json`, einschließlich erstem Fehler und erfolgreicher Wiederaufnahme. **Keine Gesamtabschlussbehauptung:** Backup-, CDN- und externe Log-Aufgaben bleiben `retention_pending`; native App- und vollständige Produktionsschema-Abnahme sind offen.

Der Dashboard-Dialog für `lotti-delete-restore-target-20261001` ist vorbereitet: gleicher Micro-Compute, gleiche Organisation/Region, 9,68 USD zusätzliche monatliche Compute-Anzeige und 0 USD Disk-Anzeige; tatsächliche Abrechnung stundenweise. Das zweite Projekt ist noch nicht angelegt. Wegen des neuen Datenbankpassworts wurde der Betreiber um direkte Erzeugung und Absendung gebeten. Danach `status` zur bewachten Referenzübernahme und bei `ACTIVE_HEALTHY` den Replay mit dem gebündelten Node-24-Runtime ausführen:

```sh
/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-transform-types scripts/managed-deletion-restore-runner.mjs restore
```

Das Skript prüft das unabhängig gehaltene Register, genau die beiden wiederhergestellten markierten Konten, fehlende aktuelle Löschbelege und die geschützte eigene Zielreferenz. Keine neuen Fixtures erzeugen oder die vorbereitete Quelle erneut initialisieren. Bei Erfolg sofort `node scripts/managed-deletion-restore.cjs cleanup`, tatsächliche API-Abwesenheit belegen und Automation pausieren. Bei nicht behebbaren Fehlern/Kostenabweichung oder spätestens geplantem Abbruch gilt dieselbe Bereinigung. Das 5-USD-Gesamtlimit und die frühere 48-Stunden-Grenze bleiben bestehen.


## Zügiger Abschluss im bestehenden Wegwerfprojekt

Der Betreiber verlangt am 01.10. abschließende Durchführung und stimmt nötigen weiteren rund 0,15 USD zu. Die reguläre Wiederherstellung im ausschließlich synthetischen Testprojekt ist mit derselben Schutzgrenze möglich: kein Produktiv-/Familien-QA-Eingriff, kein Anwendungszugriff, keine ausgehenden Jobs oder Secrets, unabhängiges Register bleibt außerhalb des Backups. Deshalb wird **kein zweites Projekt** angelegt. Dies ist ein tatsächlicher physischer Supabase-Restore **im bestehenden Wegwerfprojekt**, kein Nachweis eines separaten Dashboard-Klons. Der Klon-Dialog wurde abgebrochen.

Vor Restore: genau ein verbleibendes Kontrollkonto; gelöschte Identität/Profil/Storage-Metadaten fehlen; Quell-Löschbeleg `retention_pending`, RLS aller Anwendungstabellen aktiv, null Anwendungsgrants, null Vault-Secrets, kein Cronbestand. Physischer Backupstand 1833695425 liegt nach Fixture-Anlage und vor Annahme des extern registrierten Löschauftrags. Der Management-API-Endpunkt hat HTTP 400 `This endpoint is unavailable at the moment` zurückgegeben, ohne den Bestand zu ändern. Anschließend wurde derselbe Backupstand im regulären Dashboard unter Scheduled backups gewählt und freigegeben. **Anbieter zeigt Restoration in progress**, Referenz ukpxoxvxxgyvlotntvdl; Nachweise `managed-inplace-restore-selected.png` / `managed-inplace-restore-started.png`.

Der Lifecycle hat eine zusätzliche frühere Bereinigungsfrist auf höchstens **eine Stunde ab Restore-Vorbereitung**. Sobald `ACTIVE_HEALTHY` und der erwartete alte Bestand (zwei markierte Auth-Konten/Profile, null neue Löschbelege) zurück ist:

```sh
/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-transform-types scripts/managed-deletion-restore-runner.mjs restored-source
```

Dieser Modus unterscheidet Quell- und Restore-Registerphase trotz gleicher Projektref. Die Alias-Korrektur wird erneut angewendet, weil der Restore sie zurückgesetzt hat. Nach unabhängigem Abgleich das wiedererschienene Testkonto tatsächlich erneut löschen, frisches altes Token sperren, Kontrollkonto/ursprüngliche Datei mit gleichem Hash erhalten. Anschließend unmittelbar `cleanup`, Abwesenheit über Anbieter-API belegen und Automation beenden. Bei Fehler/Fristüberschreitung ebenfalls bereinigen. Keine neue Passwortfrage; keine weiteren Fixtures oder Projekte erzeugen.


## Abschlussnachweis

- Reale Wiederherstellung am 01.10. vor 05:48:30 UTC abgeschlossen: Auth=2, Profile=2, Storage-Metadaten=2, aktuelle Löschaufträge=0. Der ursprüngliche außerhalb des Backups gehaltene Quellbeleg existierte im wiederhergestellten Bestand nicht.
- Erneuter tatsächlicher Worker-Replay um 05:49:06 UTC bestanden. Gelöschte Auth-/Profil-/Storage-Metadaten=0; Kontroll-Auth/Profil=1; fremde Nachricht mit abgetrennter Empfängerreferenz=1. Altes frisches Token verweigert; ursprüngliche Kontroll-Datei HTTP 200 mit unverändertem Hash, ursprüngliche gelöschte Datei HTTP 400. Nach dem Restore wurde die Alias-Korrektur erneut angewendet.
- Eigene Quelle ukpxoxvxxgyvlotntvdl um 05:51 UTC gelöscht. Anbieter-API bestätigte tatsächliche Abwesenheit unmittelbar und bei separatem Nachabruf. Ein zweites Projekt wurde nie angelegt. Wegwerfpasswörter, Fixture-Sitzungen und privates Testregister entfernt. Produktion ACTIVE_HEALTHY; Familien-QA-Branch weiterhin vorhanden und per read_only-SQL erreichbar. Der Branch-Provisionierungsstatus MIGRATIONS_FAILED ist separat im Anbieterbefund dokumentiert und kein hier behobener oder neu verursachter Befund.
- Geschätztes stundenweise gerundetes Micro-Compute: 12 Stunden × 0,01344 USD = 0,16128 USD insgesamt. Kein bestätigter Rechnungsbetrag, sonstige Nutzung nicht eingerechnet. Keine Test-Compute-Instanz läuft weiter; einmalige Automation gelöscht.

Der synthetische Löschauftrag blieb bis zur Projektentfernung korrekt `retention_pending`: Cachelöschannahme und einzelne URL-Prüfungen sind keine globale CDN-Frist; Anbieterlogs wurden nicht als gelöscht bescheinigt. Nativer App-Test, vollständiges Produktionsschema, Aufbewahrungsfreigabe sowie gezielte QA-/Produktionsbereitstellung und Aktivierung bleiben gesondert offen.
