# Aufpasser-Modus

Stand: 9. September 2026. Die Aufpasser-Struktur und beide öffentlichen RPCs sind inzwischen auf dem verbundenen Supabase-Projekt installiert. Über die angemeldete CLI wurden alle vier Funktionskörper mit den lokalen SQL-Dateien verglichen: identisch. Die Ausführungsrechte und der leere search_path sind korrekt. Die zusätzliche Migration 20260909200824_caretaker_shared_tracking_inputs wurde ebenfalls eingespielt und der Funktionskörper danach auf Übereinstimmung geprüft. Sie behebt den Schlafstart auf dem Live-Schema ohne created_by und erlaubt zeitlich begrenzte manuelle Einträge. Der Gast-Endpunkt ist über die Data API erreichbar und weist eine ungültige Sitzung erwartungsgemäß mit invalid_guest_session zurück. Der vollständige Eltern-/Gastablauf wurde damit noch nicht live durchgespielt.

## Ablauf

- Einstieg unter **Mehr → Aufpasser-Modus** oder über **Accounts verbinden**.
- Einladende Eltern wählen ein Baby, einen Namen für die Einladung, Beginn und Ende sowie 0, 1 oder 2 zusätzliche Tage Rückblick.
- **Mitlesen und Eintragen** ist vorausgewählt; ausschließliches Mitlesen bleibt wählbar.
- **Betreuung freigeben** öffnet sofort die bestehende QR-Ansicht mit QR-Code und gruppiertem Einladungscode darunter. Offene Einladungen lassen sich später erneut anzeigen oder teilen. In der Elternverwaltung gibt es keinen Bereich zum Annehmen einer Betreuung mehr.
- Auf der Login-/Registrierungsseite führt **Ich passe nur auf** direkt zum bestehenden QR-Scanner aus „Accounts verbinden“. **Code von Hand eingeben** ist jederzeit als Alternative verfügbar. Weder E-Mail, Passwort, Elternkonto noch Baby-Onboarding sind erforderlich.
- Pro Person/Gerät gibt es eine eigene Einladung. Beim ersten Einlösen bindet sie sich an einen separaten Gastzugang auf diesem Gerät. Weitere Geräte benötigen eine eigene Einladung.
- Die aktive Betreuung zeigt ausschließlich **Schlaf** und **Unser Tag**. Der Gastzugang wird beim nächsten App-Start ohne Elternanmeldung fortgesetzt. Über Zurück gelangt man zur Codeansicht und kann dort fortsetzen, eine neue Einladung verwenden oder den Gastzugang verlassen. Nach dem Verlassen ist eine neue Einladung erforderlich.
- Einladende können die Freigabe vorzeitig beenden. Nach Ende des Zeitraums ist keine zusätzliche Aktion erforderlich.

## Daten und Rechte

Zugriff beginnt zum festgelegten Beginn und endet zum festgelegten Ende (exklusiv). Der optionale Rückblick erweitert dann den sichtbaren Datenzeitraum um 24 oder 48 Stunden; er gewährt keinen früheren Zugang zur App-Ansicht.

Die separate Freigabe erstellt weder `auth.users` noch `account_links` oder `baby_members`. Es wird auch kein anonymer Supabase-Auth-Account angelegt. Empfänger erhalten keinen direkten neuen Zugriff auf Babyprofil, Fotos, Tagebuch, Kalender oder andere Familienbereiche. Eine eingeschränkte RPC liefert nur ausgewählte Felder aus `sleep_entries` und `baby_care_entries` für genau dieses Baby und den erlaubten Zeitraum. Bestehende eigene Berechtigungen eines Empfängers werden dadurch nicht verändert.

Während der Betreuung sind Schlaf starten/beenden, manuell nachgetragene Schlafphasen sowie Fläschchen mit Menge, Beikost und Windeleinträge mit optionaler Notiz möglich. Manuell gewählte Zeiten müssen innerhalb der Betreuungszeit liegen und dürfen nicht zukünftig sein. Individuelle Aktivitäten werden aus vorhandenen Einträgen angezeigt. Zeiten vor Betreuungsbeginn bleiben unveränderbar; insbesondere wird ein bereits vor Betreuungsbeginn gestarteter Schlaf nur angezeigt. Selbst über denselben Gastzugang erfasste Einträge lassen sich während der aktiven Betreuung bearbeiten und nach Bestätigung löschen. Einträge anderer Personen sowie Zeiträume vor Betreuungsbeginn bleiben geschützt.

Die Einträge werden im Datenbestand des einladenden Elternaccounts gespeichert, damit der Gast über die bestehenden Eigentümerregeln keinen unbegrenzten Zugriff auf selbst erstellte Einträge erhält. Es gibt derzeit keine separate Autorenanzeige „eingetragen von Oma/Opa“ in der Elternansicht.

Der Server prüft das geheime Gasttoken, die Freigabe, das Schreibrecht und die Zeit bei jedem Datenaufruf. Verliert der einladende Elternaccount seine Berechtigung für das Baby, wird auch die Betreuung ungültig. Ein Widerruf sperrt nachfolgende Serveraufrufe sofort. Die Ansicht aktualisiert alle 15 Sekunden; bereits abgerufene Daten werden höchstens 30 Sekunden ohne neue Bestätigung gezeigt, bei Ablauf spätestens nach dem nächsten 250-ms-Prüftakt. Beim Hintergrundwechsel werden die angezeigten Daten gelöscht und beim Zurückkehren neu geprüft. Betreuungsdaten werden nicht in AsyncStorage gespeichert, nur das Gasttoken mit Freigabe-ID. Vor dem ersten Einlösen wird das zufällig erzeugte Token zusammen mit dem Code gespeichert, damit ein erneuter Versuch nach einer verlorenen Netzwerkantwort dieselbe Sitzung wiederherstellt. Eltern-Anmeldedaten werden weder mitgesendet noch verändert.

## Einheitliche Oberfläche

- `Header` mit dem üblichen Zurück-Button.
- Dieselbe `AccountLinkingQrModal`-Komponente für QR-Anzeige, Kamera, Berechtigungen und manuelle Alternative. Nur Texte und Codeparser werden für die Betreuung angepasst; bestehende Partnercodes bleiben unverändert.
- `BabySwitcherButton`; die neue optionale Einstellung `navigateOnSelect={false}` hält die Freigabe beim Babywechsel offen. Das bisherige Verhalten anderer Screens bleibt Standard.
- Dasselbe `TimePickerField` wie in `SleepQuickAddModal`, einschließlich iOS-Spinner und Abbrechen/Fertig. Android fragt nacheinander Datum und Uhrzeit ab.
- `LiquidGlassCard`, zentrale Designfarben/Abstände und `AnimatedButton`.
- Die vorhandenen `DailyQuickAction`-Kreise aus „Unser Tag“ öffnen denselben `ActivityInputModal`. Gastmodus blendet Stillen/Pumpen/Wasser, Vorräte, Rezepte, Medikamenten-/Fieberfelder und Fütterungstimer aus. Elternabhängige Zusatzdaten werden nicht geladen.
- Der Schlafbereich verwendet `SleepTimerFace`, die mit dem normalen Tracker geteilten `SleepCaptureButton`-Karten und `SleepQuickAddModal`. Die gemeinsame Schlafmaske hat eine feste Panelhöhe, damit ihr Scrollinhalt auf iOS nicht zusammenfällt.
- Die Timeline nutzt `ActivityCard`. Bearbeiten und Löschen werden nur für serverseitig als eigene Einträge ausgewiesene Datensätze freigeschaltet. Die Tagesnavigation ist auf den freigegebenen Zeitraum begrenzt.
- Texte auf Deutsch, Englisch und Spanisch. Keine zusätzliche native Abhängigkeit.

## Aktivierung

Bei einer neuen Installation alle vier Migrationen in dieser Reihenfolge anwenden. Auf dem verbundenen Projekt sind die Funktionen bereits vorhanden; die Dateien dort nicht erneut ausführen:

1. `supabase/migrations/20260909183546_caretaker_access.sql`
2. `supabase/migrations/20260909191149_caretaker_guest_access.sql`
3. `supabase/migrations/20260909200824_caretaker_shared_tracking_inputs.sql`
4. `supabase/migrations/20260909204107_caretaker_entry_editing.sql`

Die zweite ersetzt den anfänglichen kontogebundenen Betreuungszugang durch den Zugang ohne Registrierung. Es muss kein Anonymous-Auth-Schalter aktiviert werden.

Die erste setzt die bestehende Multi-Baby-Struktur mit `baby_info`, `baby_members` und den `baby_id`-Spalten der beiden Trackingtabellen voraus. Im Repository existieren ältere Änderungen mit zukünftigen Dateinamen; für eine bestehende Installation gezielt diese Migration nach der bereits vorhandenen Multi-Baby-Struktur anwenden, nicht ungeprüft alle lokalen Migrationen veröffentlichen.

Die Migrationen sind Transaktionen. Das Schema `caretaker_private` bleibt außerhalb der exponierten Data-API-Schemas. Tabellenzugriff ist entzogen und RLS aktiviert. `caretaker_access` erlaubt authentifizierten Eltern ausschließlich Erstellen, Auflisten und Widerrufen ihrer Freigaben. `caretaker_guest` ist auch für die `anon`-Rolle ausführbar, akzeptiert aber nur die festgelegten Gastaktionen. Die öffentlichen Wrapper verwenden `SECURITY INVOKER`; die privaten Funktionen `SECURITY DEFINER` mit leerem `search_path`.

Der Einladungscode hat 32 Hexzeichen; das Gasttoken wird mit `expo-crypto` aus 32 zufälligen Bytes erzeugt. Nur dessen SHA-256-Hash liegt in der Datenbank. Die Codeannahme ist atomar und bei gleichem Token wiederholbar. Auslesen von Grants, freie Tabellenabfragen oder Aufrufe der alten Account-Annahme sind Gästen nicht erlaubt. Trackingdaten werden mit einer festen Feldauswahl und serverseitigen Zeit-/Babyfiltern ausgeliefert. Eine beliebige im Payload mitgesendete Baby- oder Nutzer-ID erweitert den Zugriff nicht.

Vor Freigabe auf einem angeschlossenen Testprojekt alle vier Migrationen anwenden, Supabase-Sicherheitsadvisor prüfen und den vollständigen Ablauf mit Elternkonto und unangemeldetem Gastgerät durchführen. Live-RLS, vorhandene Trigger und das Scannen eines echten Einladungscodes konnten hier mangels Backendberechtigung nicht abschließend geprüft werden.

## Verifikation

Bei der ursprünglichen Prüfung des Freigabe-Buttons antworteten beide öffentlichen RPC-Endpunkte mit HTTP 404 / `PGRST202`. Das ist inzwischen behoben; die Installation wurde über die CLI geprüft (siehe Stand oben). Die Freigabe zeigt nun Ladezustand, Pflichtfeldhinweise sowie Fehler direkt am Button und als Dialog; erfolgreiche Einladungen öffnen ihren QR-Code ohne auf einen weiteren Listenabruf zu warten. Elternanfragen werden nach 25 Sekunden abgebrochen.

- **22 PostgreSQL-Integrationstests** in `scripts/tests/caretaker-access.mjs`: Eltern-/Gastrollen, Einladungsbindung ohne Auth-Account, Wiederholung bei verlorener Antwort, Tokenprüfung, direkte Tabellenzugriffe, Grenzen des Rückblicks, fremde Babys, Schreibrecht, Widerruf, Ablauf und verlorene Elternberechtigung. Ausführung in einer isolierten PGlite-Datenbank mit Testdaten, nicht auf Produktionsdaten.
- **81 Jest-Tests** für den Gastclient, Wiederherstellung nach Netzwerkfehlern, unveränderte Elternsitzung, Gast- und Partner-QR-Parser, Scanner/manuelle Eingabe, automatische QR-Anzeige nach Freigabe sowie bestehende Zugriffs-/Lebenszyklus- und Datepicker-Prüfungen.
- Native Sichtprüfung des unangemeldeten Einstiegs mit Standard-Header im vorhandenen iOS-Simulator.
- Keine neuen TypeScriptfehler in den geänderten Featuredateien. Der projektweite Typecheck bleibt wegen vorhandener Fehler in `app/_layout.tsx` und `app/frag-lotti.tsx` rot; der separate Test-Typecheck enthält ebenfalls bereits bestehende Fehler außerhalb dieses Features.

```sh
npx jest --runInBand --testPathPattern='caretaker-|account-linking-qr'
# PGlite außerhalb der App-Abhängigkeiten installieren:
npm install --prefix /tmp/lotti-caretaker-validation @electric-sql/pglite --no-audit --no-fund
NODE_PATH=/tmp/lotti-caretaker-validation/node_modules node scripts/tests/caretaker-access.mjs
```

Native Sichtprüfung: Timer und die beiden Eingabemasken wurden im iOS-Simulator mit temporären lokalen Demodaten geprüft. Die Demo-Route wurde anschließend entfernt. Der Live-Sicherheitsadvisor meldet keine Aufpasser-bezogenen Befunde; vorhandene Befunde in anderen Bereichen wurden nicht verändert.

## Eigene Gast-Einträge korrigieren

Die Migration `20260909204107_caretaker_entry_editing.sql` wurde auf dem verbundenen Projekt eingespielt. Die private Tabelle `entry_authors` ordnet neu erstellte Schlaf-/Alltagseinträge eindeutig ihrer Freigabe zu; Eltern- und Gastrollen haben keinen direkten Tabellenzugriff. Die Quelltabellen behalten den Elternaccount als Eigentümer. Fremdschlüssel räumen die Zuordnung beim Löschen des Eintrags auf.

Die Leseantwort liefert je Eintrag `can_edit`. Änderung und Löschung prüfen die Zuordnung unabhängig davon erneut auf dem Server, einschließlich Baby, laufender Freigabe, Schreibrecht und Zeitgrenzen. Andere Gastzugänge erhalten keine Änderungsrechte. Neue Zeiten dürfen nicht in den Rückblick oder die Zukunft verschoben werden. Schlafkorrekturen dürfen keinen zweiten laufenden Timer erzeugen.

Vor dieser Migration erfasste Einträge haben keine verlässliche Gastzuordnung. Es gibt bewusst keine nachträgliche Zuordnung anhand von Zeit oder Eltern-ID; solche Einträge korrigieren weiterhin die Eltern. Bestehende Gastzugänge können ihre ab jetzt neu erfassten Einträge bearbeiten, ohne eine neue Einladung anzunehmen.

Die vorhandenen Masken öffnen mit den gespeicherten Werten. Löschen ist per Wischaktion oder in der Maske möglich und verlangt eine Bestätigung. Formularwerte bleiben während Timer-/Serveraktualisierungen erhalten.
