# Familien-QA: Modus und Register angewendet, weiter ausgeschaltet

Der echte native Worker-Test auf den sechs bisherigen Löschmigrationen ist bestanden und bereinigt. Anschließend hat Root die beiden neuen Migrationen gezielt in der bestehenden Familien-QA angewendet und geprüft. QA hat jetzt acht effektive Löschmigrationen, bleibt aber `ACCOUNT_DELETION_ENABLED=false`, Modus `unapproved`, Freigabe und Fristen `NULL`, Readiness false. Ein echter externer Registerlauf samt erneutem Lauf in einem getrennten Prozess ist für ausschließlich den bekannten markierten Testauftrag B bestanden. Produktion enthält weiterhin weder Löschschema noch Produktionsregister; am 01.10. zusätzlich unabhängig lesend bestätigt.

## Tatsächlicher Altstand

Lesend überprüft: Elternprojekt `kwniiyayhzgjfqjsjcfu`, Organisation `xqbmotyjxjdeqoisbgow`; QA-Branch-ID `917136d3-49fb-463b-9026-30e62b9533a5`, Name `family-subscription-qa`, Referenz `ggyonianphloycmqrwvj`, keine Default-Branch, Preview `ACTIVE_HEALTHY`. Der historische Branchstatus `MIGRATIONS_FAILED` wird nicht umgeschrieben und ist keine Aussage über die geprüften aktuellen SQL-Bodies.

Die ursprüngliche Jobmigration `20260911065615` hat weiterhin **keine Historienzeile**. Die fünf späteren alten und die zwei neuen Löschmigrationen sind registriert: sieben Zeilen für acht effektive Migrationen. Der Bootstrap wurde weder wiederholt noch nachträglich registriert. Alle sechs alten und die zwei neuen lokalen Quelldateien wurden gegen ihre festgelegten SHA-256-Werte geprüft. Fünf von der Änderung berührte alte Functions wurden vorab mit dem lokal ausgeführten Sechs-Migrations-Stand abgeglichen. Nach Apply und Writerlauf wurden unabhängig acht effektive Function-Bodies einschließlich Export/Ack/Digest gegen die geprüften Acht-Migrations-Quellen abgeglichen; alle stimmen exakt überein. Beide neuen gespeicherten Historienquellen stimmen mit den Dateihashes. Altstand, 118 Schutzpolicies/-trigger und 136 Regeln sind privat gesichert.

## Erfüllte Voraussetzungen und bewachter Ablauf

Die endgültigen Nachweise `native-backend-worker-20261001.json` und `native-backend-cleanup-20261001.json` belegen denselben tatsächlichen iPhone-Testauftrag B: deployed Worker bestanden, eigene Auth-/Profil-/Dateibestände entfernt, altes frisches Token gesperrt, sechs Kontrollidentitäten/-profile unverändert. Der unverarbeitet entfernte Android-Testauftrag A bleibt im eigenen archivierten Testnachweis; es wird keine gemeinsame Geräte-Auftrags-ID behauptet.

Der frisch gelesene QA-Stand enthielt und enthält exakt einen Auftrag B in `providers`/`needs_attention` ohne Lease, sechs Authkonten und null Storageobjekte. Seine zwölf Pflichtanbieterzeilen bleiben erhalten: RevenueCat `completed`, elf Fälle weiterhin `pending`. Sämtliche ursprünglichen Settings sind zurückgesetzt, Freigabe und beide Fristen `NULL`, Endpointflag false und temporäre Geräte-Einschränkung entfernt. Workercron bleibt inaktiv; bestehender Alarmcron und alle übrigen Scheduler sind unverändert.

Nach bestandenem Gate wurde die reine Vorbereitung mit folgendem Befehl ausgeführt. Sie wird nicht erneut gegen den bereits migrierten Stand aufgerufen:

```sh
node scripts/prepare-deletion-qa-registry.cjs --prepare-after-native-cleanup
```

Das Skript prüft das genaue Konto/Branch-Ziel über die Management-API, liest den Zustand transaktional `READ ONLY`, vergleicht aktuelle Sources/Historie und speichert die Sicherheits-Advisors vor der Änderung. Keine versteckten Browser-Zugangsdaten und kein direkter Produktionszugriff werden verwendet. Rohdaten der sechs Kontrollkonten werden nicht exportiert; ihre Erhaltung wird durch innerhalb PostgreSQL berechnete Hashes geprüft.

## Genau zwei Änderungen, weiter ausgeschaltet

Die private SQL-Datei `.family-qa/deletion-production-preparation-20261001/qa-stage-seven-eight.local.sql` wurde bei bestandenem Gate erzeugt, mit `0600`, Quelle/Digest im öffentlichen Vorbereitungsmanifest. Die angewendete Datei und die beiden Quellen stimmen unabhängig geprüft mit dem Applybeleg überein. Eine äußere Transaktion mit Advisory-Lock und kurzen Timeouts prüfte unmittelbar vor DDL erneut Altquellen, Historie, Settings, exakten Auftrag und unveränderte Zustands-Hashes. Ausschließlich angewendet und registriert wurden:

1. `20261001122517_account_deletion_supervised_provider_mode.sql`
2. `20261001124926_account_deletion_durable_registry.sql`

Unmittelbar nach der SQL-Änderung: Modus `unapproved`, Freigabe und Fristen weiter `NULL`, Readiness false, alle drei Ack-Felder leer. Auftrag, Anbieterfälle, Ereignisse, Objektbelege, sechs Controls und sämtliche Scheduler waren unverändert. Alte Historie blieb unverändert; nur zwei neue exakte Quelldateien wurden hinzugefügt. Neue Export-/Ack-RPCs sind auch unabhängig live geprüft ausschließlich mit Service-Rolle ausführbar; `anon`/`authenticated` besitzen kein EXECUTE.

Die SQL-Nachprüfung las den neuen minimalen Export nur intern für den bereits bekannten markierten Auftrag B, prüfte Ursprung, Auftrags-/Kontokennung, Scope und Digest und gab keine Kontrollkontodaten aus. Sie setzte kein Ack und rief keinen Claim auf. Nach eigenständigem Rootreview und bestandenem QA8-Gate wurde der vorhandene externe Writer für exakt diesen Fixturefall ausgeführt. Keine Wiederherstellungsinfrastruktur, neuen Authkonten oder weiteren Provider-Löschungen gehörten zu diesem Schritt.

Sources, effektive ACL/Settings, erhaltenen Fallzustand und Flag/Scheduler sind nach Apply überprüft. Sicherheits-Advisors: 372 vorher, 372 nachher, keine neuen Identitäten oder semantischen Befunde; nur Beobachtungszeitpunkte wurden erneuert. Der Bestand enthält also weiterhin bereits vorhandene Befunde und gilt nicht als pauschal frei von Warnungen.

## Echter unabhängiger Registerlauf und Neustart

`qa-durable-registry-first-20261001.json` und `qa-durable-registry-restart-20261001.json` belegen zwei getrennte Prozesse: genau ein bekannter Auftrag exportiert, atomar dauerhaft geschrieben, geschützter Readback und gebundener Ack. Der zweite Prozess las den vorhandenen Bestand und erhielt denselben Eintrag. Zusammenfassender Nachweis: `qa-durable-registry-runtime-20261001.json`, `passed=true`.

Tatsächliche QA-Datei: `/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/durable-writer-20261001/deletion-registry-v1.json`, außerhalb Repo und Datenbankbackup. Die unabhängige lesende Prüfung bestätigt Betreiber-Eigentum, Verzeichnis `0700`, reguläre Datei `0600`, keine Symlinks/Hardlinks, genau bekannten Auftrag B und denselben canonical Digest wie der serverseitige Ack. Ein gültiger Ack ist vorhanden, keine Lease. Alle neun vorher gebundenen Fall-/Control-/Scheduler-/Altgeschichtshashes bleiben auch nach dem Ack unverändert.

Es wurde kein Claim oder weiterer Workerlauf ausgeführt. Die QA bleibt aus und `unapproved`; der Anbietercheckpoint wird nicht durch den Registertest abgeschlossen. Dieser echte QA-Nachweis beweist noch keinen dauerhaft installierten Produktionswriter. Vor globaler Aktivierung fehlen dessen tatsächlicher geschützter Pfad, Credential-/regelmäßiger Laufbetrieb und Zielnachweis; Produktion ist unverändert.

Der abschließende Operatorcheck `operator-check-final-20261001.json` läuft mit erwarteter Exitcode 2: Betrieb aus, keine Freigabe/Fristen, Workercron inaktiv; Registerbarriere vorhanden, null fehlende Acks, ein betreuter Auftrag und elf offene Anbieterfälle. Seine generische `remainingEvidence`-Liste liest keine Testartefakte und nimmt bestandene native, Restore- oder QA-Writer-Nachweise nicht zurück. Der anfängliche einmalige generische CLI-Fehler ließ sich weder durch Einzelabfragen noch den vollständigen Check reproduzieren; der erneute Lauf mit Ausgabedatei bestand. Ursache nicht belegt, keine Rechteerweiterung oder Codeänderung vorgenommen.

## Prüfungen

Vier lokale PGlite-Prüfungen beweisen die vollständige atomare QA7/8-Transaktion mit ausschließlich synthetischem nach-nativem Bestand, unverändertem Anbietercheckpoint/Controls/Scheduler/Altgeschichte und standardmäßig ausgeschaltetem Modus. Falsches Ziel, fehlender echter Worker-/Cleanup-Nachweis, geänderte SQL-Bodies, aktive Lease, Freigabe-/Kontroll-/Schedulerabweichungen werden abgewiesen. Die unabhängige Prüfung der angepassten Betriebsprüfung hat ebenfalls alle acht Tests bestanden. Die tatsächlichen QA-Schritte sind zusätzlich durch `qa-seven-eight-apply-20261001.json`, `qa-seven-eight-verification-20261001.json` und den Register-Runtimebeleg bestätigt. Die reine unabhängige Liveprüfung am 01.10. 14:06 UTC hat weder Daten verändert noch einen Worker/Claim aufgerufen.
