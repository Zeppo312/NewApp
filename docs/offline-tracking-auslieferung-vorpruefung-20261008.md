# Offline-Erfassung: Vorprüfung und Auslieferungsplan

Stand: 08.10.2026. Auftrag: offene Punkte prüfen und die Auslieferung konkret vorbereiten.

**Die Auslieferung ist vorbereitet, aber noch nicht freigabefähig.** Der tatsächliche Produktionskatalog wurde lesend geprüft. Zwei zusätzliche lokale Reproduktionen belegen einen bestehenden Fehler in den Kindzugriffsregeln und eine Lücke beim Vitamin-D-Konfliktabgleich. Es wurde keine Migration angewandt und kein Client veröffentlicht.

Maschinenlesbarer Nachweis: [preparation.json](../output/tracking-rollout-preparation-20261008/preparation.json). Der ursprüngliche [Umsetzungsbericht](offline-tracking-umsetzung-20261008.md) bleibt als früherer Stand erhalten.

## Tatsächliches Backend

Der verbundene Supabase-Connector verweigert den Zugriff auf `kwniiyayhzgjfqjsjcfu` und listet andere Projekte. Die vorhandene Anmeldung der lokalen **Supabase CLI 2.111.0** erreicht das richtige Projekt in Organisation `xqbmotyjxjdeqoisbgow`, Region `eu-central-1`, Status `ACTIVE_HEALTHY`. Eine erneute Connector-Anmeldung ist für diesen CLI-Weg nicht erforderlich.

Die Katalogabfragen liefen in `BEGIN READ ONLY` mit begrenzter Ausführungszeit. Es wurden keine Familienkonten, Facheinträge oder Gesundheitsdaten aus Produktion gelesen. Die privaten Katalogbelege liegen unter `.family-qa/tracking-rollout-preparation-20261008/` mit eingeschränkten Dateirechten.

| Gegenstand | Frisch belegter Stand | Bedeutung |
| --- | --- | --- |
| PostgreSQL | 15.8 | Zielversion ist bekannt; die lokale Fixture ersetzt keine Zielabnahme. |
| RPC und Empfangstabelle | `tracking_sync_operation` und `tracking_sync_receipts` fehlen | Automatischer Versand benötigt weiterhin die Migration. |
| Benötigte Tabellen und Spalten | Alle vom RPC angesprochenen Spalten vorhanden; keine zusätzlichen unversorgten NOT-NULL-Spalten in Care/Schlaf | Kein belegter Spaltenkonflikt mit der aktuellen Migration. |
| Zeitstempel | Aktive BEFORE-UPDATE-Trigger setzen `updated_at` für Care und Schlaf | Ausgangsstände können mit der vorhandenen Versionsspalte verglichen werden. |
| Vitamin D | Gültiger Unique-Index auf `(baby_id, habit_key, day)` | Das vorhandene `ON CONFLICT`-Ziel ist unterstützt. |
| Grants und RLS | Authentifizierte Rollen besitzen erforderliche DML-Rechte; RLS aktiv | Rechte vorhanden; die effektiven Kindregeln enthalten den unten beschriebenen Fehler. |
| Einwilligung | `family_allowed(uuid,text)` vorhanden und für `authenticated` ausführbar; `is_enabled=false`, `rollout_active=true` | Vorhandene Einwilligungs-/Kohortenregeln bleiben maßgeblich; keine globale Aktivierung erfolgt. |
| Löschbetrieb | `account_deletion_readiness=false`; genehmigter Fingerprint stimmt nicht mit aktuellem Inventar überein | Löschbereitschaft war bereits vor dieser Migration offen. Die Migration ergänzt eine neue Löschregel und benötigt erneute Inventarprüfung. |
| Realtime | Schlaf und Vitamin D veröffentlicht; Care, eigene Aktivitätsarten und Vorräte derzeit nicht veröffentlicht | Die aktuelle Tracking-Migration ergänzt Care. Die übrigen Tabellen brauchen eine bewusste Entscheidung anhand ihrer tatsächlichen Client-Abonnements. |
| Schlaf-Paket S | Schema `sleep_sync_private` fehlt | S bleibt ein eigener, nicht bereitgestellter Vertrag. |

Der Vergleich der gemeinsamen Zieltabellen vor und nach dieser Prüfung bestätigt unveränderte Tabellen, Spalten, Constraints, Indizes, Policies, Grants, Trigger und Realtime-Mitgliedschaften.

## Belegte Freigabepunkte

### Bestehender Care-Kindzugriff ist zu weit

Die produktiven Regeln `Baby care: select/update/delete by member` enthalten `bm.baby_id = bm.baby_id`. Die Mitgliedschaft wird dadurch nicht mit `baby_care_entries.baby_id` verglichen. Weitere solche Ausdrücke existieren in Care-, Schlaf- und Vitamin-D-Schreibregeln.

Die **unveränderten Care-Policy-Ausdrücke aus dem frischen Produktionskatalog** wurden in einem isolierten PostgreSQL mit ausschließlich synthetischen Konten und Kindern ausgeführt. Ein Konto mit Mitgliedschaft nur bei Kind A konnte den Care-Eintrag von Kind B lesen, ändern und löschen, obwohl das Konto Kind B selbst nicht sehen konnte. Ein Kontrollkonto ohne Mitgliedschaft konnte den fremden Eintrag nicht sehen. Die Einwilligungs- und Löschbedingungen wurden für diesen Test als erfüllt modelliert: gültige Einwilligungen, kein laufender Löschauftrag.

Das ist eine lokale Reproduktion der erfassten Policies, kein Zugriff auf einen echten fremden Eintrag in Produktion. Es ist ein bereits bestehender Produktionsfehler; die additive Outbox-Migration behebt ihn nicht.

Vor Freigabe müssen die effektiven Regeln jedes betroffenen Schreib-/Lesewegs an das konkrete Kind gebunden und mit eigenen, Partner-, Betreuer- und unbeteiligten Konten geprüft werden. Permissive Policies wirken zusammen: Ein einzelner korrigierter Ausdruck genügt nicht, wenn eine weitere Regel den Zugriff wieder öffnet. Beabsichtigte bestehende Zugriffswege einschließlich zulässiger Altzeilen ohne `baby_id` benötigen eigene Kontrollen.

Beleg: [care-rls-reproduction.json](../output/tracking-rollout-preparation-20261008/care-rls-reproduction.json). Lokales Wiederholen mit dem erhaltenen Katalog:

```sh
node .family-qa/tracking-rollout-preparation-20261008/reproduce-care-rls.mjs
```

### Vitamin D überschreibt bei erster Zustellung eine neuere Partnerkorrektur

Der Vitamin-Zweig der aktuellen Migration prüft keinen gespeicherten Ausgangsstand. Ein erstmalig übertragener Offline-Haken von 08:00 wird mit `applied` bestätigt, nachdem der Partner den Haken um 09:00 gesetzt und um 10:00 entfernt hat. Der ältere Haken erscheint wieder; der RPC meldet keinen Konflikt.

Die Reproduktion verwendet die tatsächliche aktuelle Migration im synthetischen PostgreSQL-Testschema. Der vorhandene Vertragstest für die Wiederholung eines **bereits bestätigten** Vitamin-Vorgangs besteht weiterhin. Ein Empfangsbeleg verhindert dessen doppelte Anwendung, schützt aber nicht die erste Zustellung einer älteren, bisher unbekannten Aktion.

Vor Freigabe ist entweder eine atomar geprüfte Ausgangsversion mit nachvollziehbarem Zustand nach Entfernung erforderlich oder eine ausdrücklich beschlossene, entsprechend kommunizierte abweichende Vitamin-Regel. Die im Auftrag beschriebene Entscheidung bei Partneränderungen ist für diesen Fall derzeit nicht umgesetzt. Bestehende direkte Vitamin-Writer müssen in die gewählte Lösung einbezogen werden.

Beleg: [vitamin-conflict-reproduction.log](../output/tracking-rollout-preparation-20261008/vitamin-conflict-reproduction.log). Wiederholen:

```sh
node --test --test-name-pattern 'stale first delivery' .family-qa/tracking-rollout-preparation-20261008/reproduce-vitamin.mjs
```

## Vorbereitetes Migrationspaket

Das isolierte Arbeitsverzeichnis `.family-qa/tracking-rollout-preparation-20261008/migration-workdir/` enthält die **39 frisch aus der Zielhistorie gelesenen Migrationen** und genau eine zusätzliche lokale Migration: `20261008183517_tracking_offline_outbox.sql`. S und weitere offene Migrationen aus der normalen Arbeitskopie sind nicht hinzugefügt worden.

Der normale Trockenlauf verweigerte die ältere neue Versionsnummer, weil die Zielhistorie bereits höhere, teilweise auf 2027 datierte Nummern enthält. Im isolierten Verzeichnis zeigt der Trockenlauf mit `--include-all` **genau diese eine** zusätzliche Migration; Seeds und Rollen sind leer. `--include-all` ist nur für dieses abgeglichene Paket vorgesehen. Der Paketinhalt und die geprüfte Quelldatei stimmen anhand SHA-256 überein; der Hash steht im Nachweis.

```sh
supabase db push --linked --include-all --dry-run \
  --workdir .family-qa/tracking-rollout-preparation-20261008/migration-workdir
```

Beleg: [migration-dry-run-isolated.log](../output/tracking-rollout-preparation-20261008/migration-dry-run-isolated.log). Der Trockenlauf prüft die Auswahl, **nicht** die Ausführbarkeit der DDL oder den authentifizierten RPC. Das Paket ist ein Prüfstand und nach jeder Korrektur neu zu erzeugen.

Die aktuelle Migration ergänzt inzwischen auch `baby_care_entries` zur vorhandenen Realtime-Publikation und sendet `NOTIFY pgrst, 'reload schema'`. Sie lässt S deaktiviert. Die erneuten sieben Vertragstests beziehen sich auf diese aktuelle Datei.

## Reihenfolge der späteren Auslieferung

1. Kind-RLS und Vitamin-Konfliktregel korrigieren und die entsprechenden negativen Tests bestehen lassen. Änderungen an bestehenden Zugriffsregeln gesondert abgleichen; nicht als bereits durch die additive Tracking-Migration erledigt behandeln.
2. Zielidentität, Migrationshistorie und Katalog erneut lesen. Das isolierte Paket mit der endgültigen Tracking-Datei und allen ausdrücklich vorgesehenen Korrekturmigrationen neu aufbauen. Die vollständige Liste des Trockenlaufs prüfen. Löschinventar, Einwilligungsregeln, Timestamp-Trigger und Realtime-Abonnements erneut abgleichen.
3. Nach gesonderter Auslieferungsfreigabe das geprüfte Paket anwenden. S nicht zusätzlich provisionieren oder einschalten. Bei einem unklaren Ausgang zuerst Migrationshistorie und RPC lesen; die nicht idempotente DDL nicht blind erneut senden.
4. [Postflight](../scripts/tracking-offline-postflight.sql) ausführen: RPC vorhanden und SECURITY INVOKER, Execute für `authenticated`, kein Execute für `anon`, Receipt-RLS und eigene Policy, aktiver Withdrawal-Trigger, genau eine Receipt-Löschregel und Care-Realtime prüfen. Löschbereitschaft und genehmigten Fingerprint separat abnehmen; keine Freigabe durch bloßes Setzen eines Fingerprints vortäuschen.
5. Den Ziel-RPC über echte authentifizierte Familien-Testkonten prüfen: ursprüngliche UUID/Operations-ID, verlorene Antwort, unveränderte Wiederholung, abweichende Nutzlast abweisen, Start/Stop-Reihenfolge, Partneränderung/-löschung, Vorrat genau einmal, Transaktionsrollback, anderes Konto, fremdes Kind und Einwilligungsentzug. Katalogzugriff als `postgres` ersetzt diese Prüfung nicht.
6. Danach den kompatiblen Client als Kandidat ausliefern und die unten aufgeführten Gerätefälle abnehmen. Die bestehende Kandidatenbasis mit ihren übrigen Korrekturen erhalten.

Die lesenden Vor-/Nachprüfungen sind ausführbar:

```sh
supabase db query --linked --file scripts/tracking-offline-preflight.sql --output json
supabase db query --linked --file scripts/tracking-offline-postflight.sql --output json
```

Vor dem Aufruf muss `supabase/.temp/project-ref` nachweislich `kwniiyayhzgjfqjsjcfu` enthalten. Der Postflight wurde bereits vor Auslieferung ausgeführt und meldet den fehlenden RPC korrekt; das ist keine bestandene Nachprüfung einer Installation.

## Clientziel und Geräteabnahme

Frische EAS-Abfragen bestätigen Projekt `d7120520-e4ff-4967-a797-627a2cb3680b`, Kandidatenkanal `release-candidate-20261003`, Environment `production` für diesen bestehenden Backendpfad sowie folgende fertige Builds:

| Plattform | Appversion | Native Buildnummer | Runtime | Expo SDK |
| --- | --- | --- | --- | --- |
| iOS | 1.0.25 | 1.0.80 | 1.0.25 | 57 |
| Android | 1.0.25 | 24 | 1.0.25 | 57 |

Die normale Arbeitskopie verwendet noch `1.0.24`. Ihre vorhandenen lokalen Exporte sind deshalb kein fertiges OTA-Paket für die Kandidatenruntime `1.0.25`. Eine passende isolierte Quelle muss vom überprüften Kandidatenstand aufgebaut werden; identische Runtime-Bezeichnungen allein belegen keine native Kompatibilität. Paket-/Lockdatei und native Konfiguration mit der Kandidatenbasis vergleichen. Die lokalen Swift-Widgetänderungen benötigen einen neuen nativen Build. [Expo: Runtime-Kompatibilität](https://docs.expo.dev/eas-update/runtime-versions/)

`EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED` muss beim Export ausdrücklich `false` bleiben. Das öffentliche Produktionsziel ist für diesen Vorbereitungsauftrag nicht ausgewählt. Der vorhandene `scripts/run-eas-update.js`-Wrapper akzeptiert die Kombination Kandidatenkanal/Environment `production` derzeit nicht; bei der späteren Freigabe den geprüften direkten EAS-Ablauf in der isolierten Quelle verwenden oder den Wrapper gezielt korrigieren.

Der aktuell zuletzt gelistete iOS-Update-Stand vom 08.10.2026, 20:07 MESZ, heißt `Offline restart: persisted bounded account access`. Das belegt keinen ausgelieferten Tracking-RPC und keine Tracking-Geräteabnahme. Andere bisherige Kandidatenkorrekturen müssen erhalten bleiben.

Aktuell ist kein Android-Gerät in `adb` erreichbar. Beide bei `devicectl` bekannten iPhones sind `unavailable`. Die folgende Matrix ist **vorbereitet und vollständig offen**:

| Fall | Ablauf auf Familiengerät A | Erwartung auf Gerät B und Backend |
| --- | --- | --- |
| Dauerhafte Erfassung | Online anmelden, Kind/Einwilligung laden; Flugmodus; Schlaf und Stilltimer starten; mehrere Aktivitäten/Vitamin D speichern; App vollständig beenden/öffnen | Timer und lokale Einträge bleiben erhalten; noch keine behauptete Partnerbestätigung. |
| Normaler Abgleich | Timer offline stoppen; Verbindung wiederherstellen; zunächst App aktiv lassen, danach Kaltstart | Gleiche IDs und ursprüngliche Zeiten im Partnerverlauf, keine Duplikate; Vorrat und Transaktionsprotokoll genau einmal. |
| Partnerschlaf | B startet Schlaf, bevor A seinen konkurrierenden lokalen Start überträgt | Entscheidung auf A; B bleibt aktiv. Ein abgeschlossener eigener Schlaf kann ausdrücklich als Verlaufseintrag behalten werden. |
| Partneränderung | B ändert denselben Care-/Schlafeintrag vor Rückkehr von A | A zeigt beide Stände und verlangt Entscheidung; keine stille Überschreibung. |
| Partnerlöschung | B entfernt den Eintrag; A wiederholt eine unklare ältere Antwort | Gelöschter Eintrag wird nicht neu angelegt; frischer bestätigter Verlauf bleibt maßgeblich. |
| Vitamin-Korrektur | A erfasst offline; B korrigiert denselben Tag; A kehrt zurück | Verhalten der zuvor korrigierten und ausdrücklich festgelegten Konfliktregel. |
| Konto, Zugriff, Einwilligung | Ausstehende Einträge; Logout-/Kontowechsel, Kindzugriffsentzug und Widerruf separat durchführen | Vorgesehene Warnung/Bereinigung; keine Zustellung unter anderem Konto oder ohne Zugriff. |

Die Fälle für iOS und Android sowie plattformübergreifend durchführen. Installierten Build und tatsächliche Update-ID auf jedem Gerät festhalten. Manifest, heruntergeladene Assets, ausgeführter Client, native Anzeige und tatsächlicher Partnerempfang sind getrennte Nachweise.

## Lokale Prüfung dieses Auftrags

| Prüfung | Ergebnis |
| --- | --- |
| Ausgewählte 22 Clientregressionssuiten | 196 Tests bestanden; diese Auswahl ist nicht identisch mit den 212 Tests des früheren Berichts. |
| Aktuelle Migration im temporären PostgreSQL | 7 bestehende Vertragstests bestanden. |
| App- und Test-TypeScript | Bestanden. |
| Produktions-Policies in synthetischem PostgreSQL | Zu weit gehender Care-Kindzugriff reproduziert. |
| Vitamin: ältere erste Zustellung nach Partnerkorrektur | Stille Überschreibung reproduziert; ein bestandener Reproduktionstest ist keine bestandene Konfliktabnahme. |
| Isolierter Migrationstrockenlauf | Genau eine zusätzliche Tracking-Migration; keine Seeds/Rollen/S-Migration. |
| Lesende Vor-/Nachprüfungen | Auf dem tatsächlichen Zielsystem ausgeführt; noch kein installierter Tracking-Vertrag. |
| `git diff --check` | Bestanden. |

Die Belege liegen in `output/tracking-rollout-preparation-20261008/`; die privaten Kataloge, heruntergeladene Migrationshistorie und lokalen Reproduktionsprogramme in `.family-qa/tracking-rollout-preparation-20261008/`. Die Vorprüfungsskripte und dieser Bericht sind die neuen Arbeitskopieartefakte dieses Auftrags. Der bestehende Appcode und bestehende Migrationen wurden durch diesen Auftrag nicht geändert. Kein Commit, Push, OTA, Store-/TestFlight-Build oder Produktions-DDL ausgeführt.
