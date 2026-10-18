# Phase A und Schlaf-Paket S: lokaler Umsetzungsnachweis

Stand: 08.10.2026. Basis: `9cc9ed8`, ergänzt um uncommittierte lokale Änderungen. Beide Auftragspläne wurden vollständig gelesen; die Partnerregeln haben Vorrang. Die drei vorgefundenen Offline-Planungsdokumente wurden nicht geändert.

## Vier getrennte Zustände

| Bereich | Tatsächlicher Stand |
| --- | --- |
| Lokale Umsetzung | Phase-A-Lesewege/Entwürfe und S-Clientvertrag umgesetzt und nachgeprüft. 300 Clienttests, lokale DB-Konkurrenzprüfungen, beide Hermes-Bundles und iOS-Simulator-Appbuild bestanden. Geräteabnahme fehlt. |
| Serverbereitstellung | Migration/RPCs lokal vorbereitet und auf echtem lokalem PostgreSQL getestet. Nicht auf QA oder Produktion bereitgestellt. Aktueller Zielkatalog nicht verifiziert: Der read-only Supabase-Katalogzugriff war durch Connector-Berechtigungen gesperrt. |
| Clientkompatibilität | Versionierte Service-/Screen-/Split-/Merge-Wege vorbereitet. Bei aktiviertem Serververtrag sind unbedingte Legacy-Writer gesperrt. Mindestversion, verbleibende Writer und Caretaker-Unterstützung sind eine offene Rolloutentscheidung. |
| Zwei-Geräte-Abnahme | Offen. Ein iPhone 16 Pro ist aktuell erreichbar, das zweite registrierte iPhone nicht; kein Android-Gerät angeschlossen. Ein iOS-Simulator läuft. Keine mit diesen Änderungen installierte Version und kein Partner-/Native-Empfang nachgewiesen. |

**S bleibt geschlossen:** `EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED` ist ohne explizites `true` aus. Zusätzlich verlangt der Server Capability-Version 1, `enabled=true` und gesperrte Legacy-Writer. Die Migration legt `settings.enabled=false` an. Keine Umgehung auf einen unbedingten Schreibpfad. Das unabhängige Lesepaket A benötigt keine S-Serverbereitstellung.

Keine Produktionsmigration, Veröffentlichung, Push, Merge oder neuer Commit. Keine neuen Pakete und keine allgemeine Offline-Datenbank.

## Lokales Verhalten

### Phase A

- `localReadSnapshots.ts` und `localHealthStorage.ts`: versionierte, validierte AsyncStorage-Daten mit Backend/Konto/Kind/lokalem Datum und Bestätigungszeit. Sieben lokale Tage beziehungsweise höchstens sieben Tage seit Bestätigung; keine Vorabladung anderer Tage. Cleanup sperrt neue Writes, entwertet alte Generationen und wartet begonnene Writes ab.
- Home erhält Pflege, Schlafminuten und Timer bei einem Teilfehler getrennt. Nur erfolgreiche Antworten bestätigen Leere/Null und neue Zeitstempel. Schlaf-Rohwerte bleiben bestätigt gespeichert; der lokale S-Stopp wird für die Anzeige separat darübergelegt. Heute wird nicht aus dem gestrigen Scope gelesen.
- Einzelne Tage in Unser Tag verwenden den neuen kontogebundenen Speicher und prüfen die aktuelle Tarifgrenze. Woche/Monat behalten ihre bisherigen Cache-Regeln. Alte Aggregatantworten aus einem anderen Scope werden nicht angewendet.
- Die vollständige Kinderliste wird nach lokaler Kontoauflösung vor der Netz-Userabfrage gelesen. Teilantworten ersetzen weder vollständige Liste noch gültige Auswahl. Ein gespeicherter Stand ist sichtbar gekennzeichnet; bestätigter Kind-Zugriffsverlust bereinigt den Scope.
- Schwangerschafts-Home stellt Name und lokal geparsten Termin wieder her, berechnet das Schwangerschaftsalter neu und übernimmt erfolgreiche Hintergrundantworten in den aktuellen Screen. Ein fehlgeschlagener Refresh löscht den Termin nicht und meldet keinen Erfolg. Einzelne Termin-/Profilinvalidierungen betreffen auch den neuen Speicher.
- `activityDrafts.ts`, `useActivityDraft.ts` und das gemeinsame `ActivityInputModal`: genau neue abgeschlossene Flasche/Windel, einschließlich Rohstrings, Notizoverlay, Uhrzeit und Vorratsauswahl. Fortsetzen/Verwerfen ist bewusst; Home und Tag teilen denselben Entwurf. Fehlerhafte/entfernte Vorratsauswahl verlangt erneute Auswahl. Kein automatischer Upload.
- Ein Pflege-Save wird vor Dispatch als `sending` gesichert und unterscheidet bestätigten Insert, sichere Ablehnung und unklare Bestätigung. Doppelklick wird synchron gesperrt. Nach unbekannter Antwort oder Neustart ist direktes erneutes Senden gesperrt, bis der Nutzer den **frisch abgerufenen Verlauf des Originaldatums** kontrolliert hat. Ein Cache reicht nicht. Die aktuelle Tarifgrenze gilt auch in dieser Klärungsansicht. Einträge werden nicht nach Ähnlichkeit automatisch zugeordnet oder zusammengeführt.
- Nur ein bestätigter Eintrags-ID-Erfolg entfernt die passende Entwurfsrevision. Bestehende Vorratswirkung bleibt am einen bewussten Save; Phase A macht Insert und Vorrat nicht nachträglich zu einer Servertransaktion. Bei Antwortverlust bleibt deren Wirkung manuell zu prüfen.
- Consent-/Konto-/Kindgrenzen, wartende Widerrufe und bestehende Auth-/Abo-Grenzen bleiben bestehen. AI-Widerruf allein erhält manuelle Entwürfe und Schlafaktionen. Leseversuche werden dedupliziert und bei transienten Fehlern höchstens zweimal wiederholt; Autorisierung/Consent/Validierung werden nicht als Netzfehler wiederholt.

Frischemetadaten: Tagesdaten 2 Minuten, Schwangerschaft 10 Minuten; Home und Kinderstand werden bei Fokus/Vordergrund/manueller Aktion erneuert. Diese Auslöser dürfen auch einen noch jungen Stand neu bestätigen. Ein versuchter Refresh erhöht die Bestätigungszeit nicht.

Notwendige begrenzte Anpassungen: Der Tages-Read schließt veraltete Pflegetimer nicht mehr durch Schreibnebenwirkungen. `pregnancy-briefing.tsx` bleibt auf dem dafür vorhandenen Terminloader, damit die geänderte Home-Cache-Schnittstelle diesen anderen Screen nicht kalt leer lässt. `AuthContext` erhielt ausschließlich den S-Logout-Hinweis vor dem vorhandenen Logoutweg.

### Schlaf-Paket S

- Bestätigter aktiver Originalschlaf und eigenes Journal sind getrennt. Eine stabile UUID, Original-ID/Kind/Backend/Konto, Eintrags- und Scope-Revision, Originalzeit, gewählte Zeit, Eingaben und Policy werden **vor lokalem Erfolg und Dispatch** dauerhaft gesichert. Pro Original gibt es einen Pending-Vorgang. Bei Speicherfehler bleibt die erste Stoppzeit im laufenden Prozess für den ausdrücklichen Retry erhalten.
- Nach Neustart darf ein passender erlaubter aktiver Snapshot als letzter bekannter Stand erscheinen. Er erzeugt keine neue Live Activity. Ein Pending-Stopp bleibt beendet angezeigt, auch wenn ein Read scheitert.
- Der appweite Runner reagiert auf Start, Vordergrund, Realtime-Rejoin, erfolgreichen API-Kontakt und manuelles Abgleichen. Er läuft einmal je Konto, versioniert lokale Zustände und wiederholt ausschließlich den festgeschriebenen idempotenten S-Request begrenzt.
- Unverändertes Original: automatische Übernahme der ursprünglichen Endzeit und gespeicherte kurze Bestätigung. `ask_always` bleibt pro ungesendetem Vorgang möglich.
- Partneränderung: Originalbeginn/Datum, eigene ursprüngliche und gewählte Endzeit/Dauer, frischer gemeinsamer Beginn/Ende/Dauer, Notiz, Bewertung und relevante weitere Segmente/aktive IDs erscheinen im Dialog. Eigene Zeit, gemeinsamen Stand oder später wählen. Notiz/Bewertung des Partners werden beim eigenen Zeitentscheid standardmäßig erhalten; deren Übernahme verlangt eine zusätzliche bewusste Wahl.
- Entscheidungen benutzen die **angezeigten** Revisionen. Ändert der Partner währenddessen erneut, erfolgt keine alte Wirkung; der Dialog bleibt mit neuerem Stand offen. Später bleibt dauerhaft zugänglich. Ein möglicherweise versendeter Payload kann nicht durch Zurücknehmen oder Zeitänderung umgedeutet werden.
- Ein neuer Schlaf ist niemals Ersatzziel. Auch ein Bewertungsdialog mit alter ID darf den inzwischen neuen aktiven Schlaf nicht stoppen. Split, Merge und gruppierte Löschung verwenden online einen atomaren Batch aus den angezeigten Versionen. Neue Starts/Pause/Fortsetzen/Split/Merge/Löschung bekommen keine allgemeine Offline-Queue.
- Die Bewertung des S-Stopps betrifft ausdrücklich nur dieses Segment. Eine nachträgliche pauschale Nachtbewertung und deren zusätzliche Trainings-/Gruppenwirkungen werden nicht blind nachgeholt.
- Ein Receipt beweist die Ausführung; anschließend wird der aktuelle Stand gelesen. Spätere Partnerkorrekturen werden nicht mit dem alten Receipt überdeckt. Bestätigter Verlust des Lese-/Kindzugriffs entfernt betroffene lokale Inhalte und hinterlässt nur einen nicht-inhaltlichen Hinweis.
- Der Provider verwaltet im S-Modell Widget/Live Activity aus dem bestätigten Snapshot plus Pending-Overlay. Eine gespeicherte Zuordnung Original-ID → native Activity-ID erlaubt das gezielte lokale Beenden auch nach Neustart. Eine verspätete native Antwort beendet/löscht keinen neuen Activity-Identifier. Ohne sichere Zuordnung wird keine beliebige aktuelle Activity als Original angenommen. Widget-Cleanup wartet laufende Writes ab; neue Pending-Felder sind im Swift-Modell optional.
- Native Stop-/Pause-Deeplinks enthalten bisher keine Server-Eintrags-ID. Im S-Modell öffnen sie deshalb die Prüfung des aktuellen Schlafs und führen keine automatische Mutation aus. Das ist eine bewusste Blockierung bis zu einem eindeutig gebundenen nativen Einstieg.

## Serververtrag und Grenzen der lokalen Evidenz

Migration: `supabase/migrations/20261008101424_offline_sleep_contract.sql`.

Öffentliche RPCs: `sleep_sync_capability`, `sleep_sync_snapshot`, `sleep_sync_stop`, `sleep_sync_mutate`, `sleep_sync_keep`, `sleep_sync_receipts`. Actor kommt aus `auth.uid()`; ein zusätzlicher erwarteter Actor verhindert Versand unter einer inzwischen gewechselten Sitzung. Eintrags- und Kind-Scope-Revision sind echte serverseitige Bigints und werden im Client als Strings übertragen.

Ein BEFORE-Trigger zählt Revisionen und blockiert nach Aktivierung unticketierte Legacy-DML; ein AFTER-Trigger zählt auch neue/gelöschte/verschobene Scopezeilen. Commit sperrt Sleep-DML und die entscheidenden Rechte-/Consenttabellen, prüft aktuelle Erlaubnis und Version und speichert Wirkung/Receipt in einer Transaktion. Scope-Lock erkennt auch einen neuen aktiven Eintrag. Split/Merge validieren den vollständigen Batch vor der ersten Mutation. Kein Upsert eines verschwundenen Originals.

Receipts enthalten Actor/Operation/Kind, Payload-Digest, Outcome und Commitzeit, keine Kopie von Notizen oder Schlafpayload. Wiederholung mit geänderten Eingaben wird abgelehnt. Der Digest für die Stoppzeit ist UTC-kanonisch und bleibt bei wechselnder DB-Verbindungszeitzone stabil. Private Tabellen haben RLS und keine direkten Clientrechte; EXECUTE ist begrenzt. Export liefert nur eigene minimale Receipts. Health-Widerruf entfernt Actor-Receipts; Auth-/Kindlöschung kaskadiert, die neue Tabelle ist im Löschinventar registriert.

Die Tests verwenden echten PostgreSQL mit zwei unabhängigen Connections und synthetischen Daten, Auth-/Consent-/Löschfunktionen sowie dem **historisch am 06.10. erfassten QA-Permission-Trigger** aus `scripts/tests/fixtures/sleep-owner-partner-trigger-20261006.sql`. Die übrige RLS-Testfixture ist bewusst permissiv, damit die neuen RPC-Prüfungen selbst geprüft werden. Das beweist weder aktuelle Produktions-RLS noch den vollständigen produktiven Löschjob.

Offene Bereitstellungsgates:

1. Read-only Zielkatalog mit `scripts/offline-sleep-preflight.sql` erheben; tatsächliche Tabellen, Spalten, Trigger, RLS, Funktionssignaturen/Rechte und Writer gegen diesen Kandidaten prüfen. NULL-/Share-only-Scopes ohne vollständige Kind-Autorisierung werden bewusst nicht zertifiziert.
2. Kandidat zuerst auf separat freigegebener QA testen, einschließlich realer Consent- und Kontolöschungsinfrastruktur. Der neue Löschinventareintrag verändert den Readiness-Fingerprint; dessen Freigabe wurde nicht erneuert.
3. Kompatibilität/Mindestversion und Caretaker-Wege entscheiden. Danach etwaige weitere Adapter bauen, keine Schutzregel für deren Bequemlichkeit öffnen.
4. Laufzeit-/Lock-Verhalten auf dem Zielsystem messen: Der lokale Kandidat verwendet globale Sleep-Tabellensperren für die kurze Committransaktion. Die lokalen Konkurrenztests sind kein Lastnachweis.
5. Neue passende native Builds und Zwei-Geräte-Abnahme. Erst danach eine gesondert autorisierte Aktivierung/Bereitstellung.

## Writerinventar und Clientkompatibilität

| Schreibweg | Behandlung im S-Modell |
| --- | --- |
| `SleepEntriesService` Start/Edit/Delete | Capability und angezeigte Version; kein unbedingter Fallback. |
| Sleep-Screen Stopp | Dauerhaftes Journal + atomarer/idempotenter Stoppvertrag. |
| Sleep-Screen Pause/Fortsetzen | Online-Serviceadapter; offline nicht als ausgeführt ausgegeben. |
| `sleepNightSplit.ts`, Screen Merge/gruppierte Löschung | Versionierter atomarer Batch; kein veralteter Kompensations-Rollback. |
| `lib/sleepData.ts`, `lib/improvedSleepSync.ts` | Direkte Legacy-DML/Automatiken sind beim aktivierten Servergate blockiert; noch keine neue allgemeine Offlineunterstützung. |
| `lib/sleepSharing.ts` Share-/Unshare-RPCs und Legacy-Feldupdates | Unticketierte Sleep-Feldwrites blockiert. Separate Share-Daten beeinflussen die aktuelle Autorisierungsprüfung; Clientumstellung/QA offen. |
| Home manuelles Sleep-Insert, `lib/voiceLog/api.ts`, Debug-Writer | Beim aktivierten Gate blockiert. Vor Rollout umstellen oder ausdrücklich aus dem unterstützten Umfang nehmen. |
| Caretaker-/Guest-/Shared-Input-/Editing-/Premium-RPCs aus den `20260909…`/`20260910…`-Migrationen | Schreiben bisher unbedingte Sleep-DML. Absichtlich kein Bypass; Gate würde sie sperren. Aktuell nicht als kompatibel abgenommen. |
| Historische Sleep-RPCs und ältere Appversionen | Versionszähler erkennen ihre Änderungen bei geschlossenem Gate; bei aktiviertem Gate ist unbedingte DML gesperrt. Unterstützte Mindestversion und alle tatsächlich installierten SQL-Writer erst am Zielkatalog bestätigen. |
| Native Stop/Pause ohne Original-ID | Prüfung öffnen; automatischen Write blockieren. |
| Read-only Lotti-/Export-/Reminder-Abfragen | Kein eigener Sleep-Writer; bestehende Lese-/Consentgrenzen bleiben. |

Das Inventar basiert auf dem aktuellen Checkout und den vorhandenen Migrationen, nicht auf einem behaupteten aktuellen Cloud-Katalog. Die gesperrten Wege sind eine **brechende Rolloutgrenze**. Es besteht noch keine vollständige Kompatibilität mit alten Clients/Caretaker-Clients.

## Vollständige Partner-Fallmatrix

`DB` = echter lokaler PostgreSQL-Test; `Jest` = lokale Client-/Integrationsregression. Jede Gerätewirkung bleibt zusätzlich offen.

| Pflichtfall | Lokaler Nachweis oder bewusste Grenze |
| --- | --- |
| Original unverändert, Uhr läuft weiter | Jest Recovery: ursprüngliche Endzeit, automatischer Commit, ein Runner. DB bedingter Original-Stopp. |
| Identische Partner-Endzeit | Jest strikter Vergleich von Start/Ende/Notiz/Bewertung/Scope; kein erfundenes Receipt. Abweichende Felder fragen. |
| Partner stoppt früher/später | Jest Endzeitänderung → `needs_decision`; eigener/shared/später Entscheid. Kein Zeitgewinner. |
| Start/Notiz/Bewertung geändert | Jest vier Feldfälle; eigene Zeit erhält geänderte Partnerfelder. DB stale Decision wirkungslos. |
| Original beendet und neuer Schlaf | DB und Jest: nur alte Original-ID; neuer aktiver Eintrag bleibt unverändert. Zusätzlicher Screen-Test schützt alten Bewertungsdialog. |
| Pause/Fortsetzen | DB atomare Segmentänderung/neue ID, Jest Overlay und vorhandene Screen-Pause-/Resume-Regressionen. Kein Offline-Resume. |
| Split/Merge | DB vollständiger Split-/Merge-Batch, entfernte Segment-ID wird nicht wieder angelegt; Jest vorhandene Split-/Mutationsregressionen. |
| Gelöscht/nicht verfügbar | DB/Jest: kein Insert/Upsert; bewusst gemeinsame Version übernehmen oder später. Fehlende Autorisierung nicht als Löschung behauptet. |
| Anderes Kind/Legacy-NULL | DB/Jest Scopeisolation; NULL/mangelnde vollständige Autorisierung blockiert. Keine Umzuordnung. |
| Zwei verschiedene Offline-Stopps | Zwei echte DB-Connections: erster wirkt, veralteter zweiter erhält Konflikt. Keine timestampbasierte Gewinnerwahl. |
| Neue Änderung während Dialog/Read-Commit | DB stale own/keep; Jest neuer Stand bleibt zur erneuten Entscheidung im Dialog. |
| Unter einer Minute | DB versionierte Löschung + Receipt-Replay; reiner Read löscht nicht. UI erklärt Verwerfen vorab. |
| Tatsächlicher 24h-Abschluss | DB Revision geändert → Konflikt; vorheriger Read hat keine Automatikwirkung. |
| Falsche Uhr/Dauer/Datums-/Zeitzonenwechsel | Client-/DB-Validierung blockiert negative, zukünftige oder >24h-Ende; Snapshottests prüfen lokale Tage/UTC-Grenze; DB-Replay bleibt bei Zeitzonenwechsel identisch. Zeitkorrektur ausdrücklich. |
| Nachtqualität für andere Segmente | Bewusst nur Originalsegment; keine pauschale Nachtpropagation im S-Modell. Breitere Bewertung/Training ist keine behauptete Wirkung. |
| Timeout/verlorene Antwort nach Commit | DB parallele identische Operation: ein Receipt/eine Revision. Jest frozen Payload, Neustart und aktueller Read nach Receipt. |
| Neustart/Flattern/doppelte Ereignisse/mehrere Flächen | Persistenz-/Hook-/Recovery-Tests: ein Journal/Runner, ein Formularowner, unbekanntes Sending nach Neustart; Rejoin/Fokus/Metadaten lösen Reads aus. |
| Abgelaufener Token/Kontowechsel | Bestehende Auth-Recovery unverändert getestet; lokale Generation/Identität sperrt. DB erwarteter Actor verhindert Ausführung unter anderem gültigen Partnertoken. |
| Freigabe/Partner/Membership/Read-only | DB aktuelle Rechte verweigern; Jest Payloadbereinigung bei Leseverlust. Realtime-Metadatenbinding getestet. Share-only ohne kompletten Kindscope bewusst blockiert. |
| Health-Widerruf/Kontolöschung | Lokaler langsamer Write/Cleanup/Generationen und Consent-/Account-Cleanup-Suiten; DB Actor-Health/Löschstatus sperrt, Receipt-FK kaskadiert. Vollständiger Ziel-Löschjob offen. |
| AI-Widerruf allein | Bestehende Consent-Cleanup-Suite und DB Receipt-Erhaltung; manueller Abgleich folgt Health. |
| Logout mit Pending | Jest Anzahl/Zurück/ausdrückliches Verwerfen; Health-Widerruf wartet nicht auf Dialog. |
| Storage voll/fehlerhaft | Echter Journal-Persistenzfehler → kein gesicherter Stopp; Screen-Integration erhält erste Uhrzeit für Retry. Formularfehler testet Dispatchsperre. |
| Alte/neue Clients | DB unticketierte DML/GUC-Fälschung abgewiesen. Aktivierung ohne Kompatibilitätsbeleg scheitert. Installierte Altclientkompatibilität offen, Feature geschlossen. |
| Unbekannter Konflikt/mehrere aktive IDs | Jest Strukturkonflikt und exakter Overlay; DB ungültiger Multiaktiv-Batch rollt zurück. Keine automatische Wahl einer anderen ID. |
| Home/Widget/Live Activity/Native-Einstiege | Home-Gesamtwerte und Overlay getrennt getestet; Widgetmodell/Swift geprüft; native verspätete Start-/End-/Clear-Antworten getestet. Ungebundene native Mutationen blockiert. Physische Geräte-/Fernempfangsabnahme offen. |

## Prüfungen und reproduzierbare Evidenz

- Jest nach Review: **300 Tests in 28 Suiten**. Enthält alle 16 Pflichtregressionssuiten aus dem A-Plan, die acht ursprünglichen neuen Suiten und zusätzlich `sleepVersionGate`, `sleepConflictPicker`, `sleepOfflineProvider` sowie die bestehende `android-date-time-picker`-Suite. Die ursprünglich gemeldeten 274 Tests in 24 Suiten bleiben als früherer Prüfstand im alten Log erhalten.
- Native PostgreSQL: **18 Tests bestanden**, darunter echte gleichzeitig offene Transaktionen und doppelte UUID. `node --test scripts/tests/offline-sleep-contract.test.mjs`. Der Runner benötigt das bereits lokal vorhandene Embedded-Postgres-Modul unter `.family-qa/postgres-tools/node_modules/embedded-postgres`; es wurde kein neues Paket installiert. Frischer Checkout/CI muss diesen Test-Runtimepfad separat bereitstellen. Temporäre Datenbanken werden nach dem Lauf entfernt.
- `npm run typecheck`: App und Test-TypeScript bestanden.
- ESLint nach Review auf 59 bearbeiteten/neuen JS-/TS-Dateien: **0 Fehler, 166 Warnungen**, separat im JSON. React-Compiler-/Hooks-/Importwarnungen bestehen auch in neuen Dateien; sie werden nicht pauschal als historische Baseline ausgegeben.
- Geänderte Widget-Swift-Dateien mit `xcrun swiftc -typecheck`, iOS-Simulator-SDK/Target arm64 iOS 17: bestanden. Das ist kein kompletter Appbuild und keine Installation.
- Zusätzlicher vollständiger nativer iOS-Simulator-Appbuild: `LottiBaby.xcworkspace`, Scheme `LottiBaby`, Debug, arm64, iOS-26.2-Simulator, `CODE_SIGNING_ALLOWED=NO`: **SUCCEEDED**, 0 Buildfehler, 773 native Warnungen. Keine Installation oder Geräteabnahme. Die aktuelle Widget-Quelle wurde zusätzlich separat typgeprüft; kein Prebuild wurde ausgeführt.
- Lokaler Expo-Export mit Hermes-Bytecode für **iOS und Android** bestanden. Keine Veröffentlichung. Die Konflikt-Zeitkorrektur verwendet den tatsächlichen Pickeradapter in Tests: Android Datum→Uhrzeit und Abbruch in beiden Schritten; iOS mehrere Inlineänderungen; erst eine ausdrückliche Bestätigung sichert die vollständige Zeit.
- Vollständiger nativer Android-Appbuild weiterhin **nicht verifiziert**: keine verfügbare Java-Runtime, kein lokales Android-SDK in den geprüften üblichen Installationspfaden und kein angeschlossenes `adb`-Gerät. Der Android-Hermes-Export und die Pickerregression ersetzen keinen APK-/Gerätenachweis.
- `git diff --check`: bestanden; neue Textdateien ebenfalls auf Whitespace geprüft.

Lokale, ignorierte Logs: `output/offline-implementation-20261008/regressions-final.log`, `sql-tests-final.log`, `typecheck-final.log`, `lint-final.json`, `widget-swift-typecheck.log`. Fehlversuche liegen separat als historische Diagnosen; maßgeblich sind die finalen Logs. Jest meldet zusätzlich eine Watchman-Recrawl-Warnung, ohne Testfehler.

Aktuelle Review-Evidenz: `output/offline-review-20261008/regressions.log`, `postgres.log`, `typecheck.log`, `lint.json`, `widget-swift.log`, `ios-export.log`, `android-export.log`, `ios-native-build.json`. Der Review-Jestlauf deaktiviert Watchman und hat keine Recrawl-Warnung. Der vollständige native Buildlog ist in `ios-native-build.json` referenziert.

## Nachprüfung und lokale Korrekturen vom 08.10.2026

1. **S-Service fällt geschlossen aus.** Bei eingeschaltetem S-Client verlangt jeder Service-Read/Write den Kindscope und die Serverfreigabe. Eine fehlende Capability führt nicht mehr in Legacy-DML oder dessen automatische 24h-Schließung beim Lesen. Die aktuell deaktivierte S-Konfiguration bleibt unverändert.
2. **Bestätigter Zugriffsverlust ohne Pending-Aktion.** Sowohl der erste Scope-Read als auch der anschließende Original-Read im Provider bereinigen bei `forbidden` lokale Inhalte des betroffenen Kindes und die gebundene native Darstellung. Ein nicht-inhaltlicher Hinweis bleibt. Die Bereinigung löst keine endlose Folge eigener Provider-Neustarts aus.
3. **Neustart zwischen Journal und nativer Wirkung.** Ein bereits dauerhaft gesicherter Stopp beendet nach Coldstart auch ohne Netz ausschließlich die gespeicherte passende Activity-ID. Ohne Zuordnung wird keine andere Activity angenommen. Ein gleicher Beginn genügt beim frischen Abgleich nicht, um eine vorhandene Activity an eine andere Server-ID zu binden.
4. **Verspätete native Antworten.** Überlappende Starts beenden nur die verspätete alte Kennung; spätes `endAll`, fehlgeschlagenes Update oder Restore überschreiben keine neuere Kennung. Eine nach Kind-/Kontowechsel zurückgegebene Startkennung wird gezielt beendet. Die Stoppdauer wird für die native Anzeige als `HH:MM:SS` übertragen.
5. **Datum und Uhrzeit gemeinsam korrigieren.** Die Auswahl bleibt bis zur ausdrücklichen Bestätigung ein lokaler Dialogentwurf. Eine Datumsänderung erhöht nicht vorzeitig die Journalrevision und schließt dadurch nicht mehr den Uhrzeitschritt; iOS-Inlineänderungen bleiben bearbeitbar. Die ursprüngliche Stoppzeit bleibt erhalten.
6. **Gemeinsam genutzte Schwangerschaftsabfrage.** Netzwerkabrufe bleiben dedupliziert; jeder aktuelle Aufrufer erhält danach seine eigene bestätigte UI-Aktualisierung. Ein zweiter Screen hängt nicht mehr am Callback eines alten Aufrufers.
7. **Receipt mit fehlgeschlagenem Folge-Read.** Der bestätigte Commit bleibt bestätigt; der alte aktive Cache wird invalidiert. Der Client erfindet dafür keinen neuen bestätigten leeren Serversnapshot mit aktueller Bestätigungszeit.
8. **Android-Abbruch des Bewertungsdialogs.** Zurück/Außentap entfernt jetzt die dabei vorgemerkte Stoppzeit. Ein späterer Stopp übernimmt nicht die Zeit eines abgebrochenen Dialogs. Ein verspäteter Abbruch oder eine alte Stoppantwort entfernt keinen inzwischen neu vorgemerkten Vorgang.

Servermigration und RPC-Kandidat wurden erneut in echtem lokalem PostgreSQL geprüft, aber nicht geändert oder bereitgestellt. Zielkatalog, Legacy-/Caretaker-Rollout und Zwei-Geräte-Empfang bleiben offene Gates. Fremde Änderungen wurden erhalten; kein Commit, Push, Merge oder Release.

## Noch durchzuführende Geräteabnahme

Voraussetzung: passende lokal gebaute/installierte iOS-/Android-Versionen, separat freigegebener QA-Vertrag, zwei unabhängige Elternkonten mit bestätigtem Health-Consent und eindeutigem Kindscope. Keine produktiven Testeinträge.

1. A-Plan Abschnitt 8 vollständig auf iOS und Android: warme Ansicht/Fehler, Coldstart ohne Netz, Flaschen-/Windelrohwerte, Home↔Tag, originaler Entwurfstag, expliziter Save, Antwortverlust über Testadapter, Mitternacht/Tarif, Kind/Konto, Health/AI/Logout und bestehender Partnerstopp.
2. S-Matrix in beiden Richtungen A→B/B→A, außerdem iOS↔Android: erst unveränderter Offline-Stopp mit App-Neustart und ursprünglicher Endzeit; dann beide Geräte verschieden offline stoppen und nacheinander/gleichzeitig wiederverbinden.
3. Während A offline ist auf B Ende/Start/Notiz/Qualität ändern, pausieren/fortsetzen, splitten/mergen, löschen und einen neuen Schlaf starten. Dialog mit beiden Ständen kontrollieren, alle drei Entscheidungen prüfen; erneut auf B ändern, während A entscheidet. Neuer Schlaf muss unverändert aktiv bleiben.
4. Antwort nach tatsächlichem QA-Commit verlieren, Prozess beenden und Receipt-Recovery prüfen. Genau eine Wirkung; spätere Partnerkorrektur muss erhalten bleiben. Storagefehler/Logout/Consent-/Rechtewechsel während ausstehender Writes prüfen.
5. Pro Gerät getrennt Sleep-Screen, Home-Minuten/Timer, Widget und Live Activity kontrollieren. Nach Coldstart darf gespeicherter Stand keine neue Live Activity erzeugen. Alte lokale Aktion/native Antwort darf die neu gestartete Activity nicht beenden, auch bei zufällig gleicher Startzeit mit neuer Server-ID. Bestehenden nativen Deeplink als bewusst blockierten automatischen Write prüfen.
6. B schließen/sperren/offline lassen und später wieder öffnen. Server-Commit, tatsächlicher In-App-Empfang und native Aktualisierung getrennt mit installierter Version/Build/Plattform dokumentieren. Keine sofortige Fernbeendigung einer geschlossenen App aus Realtime ableiten.

Kein Gerät wurde für diese Abnahme als bestanden markiert. Das erreichbare iPhone und der Simulator ersetzen die fehlende zweite unabhängige Installation/Android-Paarung und den fehlenden bereitgestellten QA-Vertrag nicht.

## Zusätzlicher Aufwand für S

Nach Writer-/Rechteinventar und lokalem Vertrag: grobe technische Schätzung **7–12 Personentage für S zusätzlich zu A**, einschließlich Integration, Kompatibilitätsarbeit und Abnahme. Die ursprünglichen 4–7 Tage gelten nur für A. Für die noch offenen Zielkatalog-/QA-/Legacy-/Native- und Geräteschritte sind davon grob 3–6 Personentage einzuplanen; komplexere Caretaker-Kompatibilität kann darüber hinausgehen. Das ist eine Planungsschätzung mit den benannten offenen Voraussetzungen, keine gemessene Arbeitszeit oder Rolloutzusage.
