# Gemeinsame Auswahl für Wachstum und Meilensteine – 13.10.2026

Die Größenkurve, Gewichtskurve und Meilensteine verwenden jetzt die vorhandene
Glas-Auswahl aus `components/ui/period-tabs.tsx`. `SelectionTabs` nimmt beliebige
Optionen entgegen; `PeriodTabs` bleibt der Adapter für Tag/Woche/Monat. Die
Gestaltung der bisherigen Zeitraumauswahl bleibt erhalten.

## Umfang

| Stelle | Optionen und Verhalten |
| --- | --- |
| `app/(tabs)/size-tracker.tsx:471` | Woche, Monat, Jahr, Gesamt; bestehendes `setSelectedRange` |
| `app/(tabs)/weight-tracker.tsx:639` | dieselben Zeiträume; bestehendes `setSelectedRange` |
| `app/milestones.tsx:448` | Alle, Motorik, Ernährung, Sprache, Zähne; bestehendes `setFilter` |
| `app/milestones.tsx:854` | sechs bestehende Formular-Kategorien; bestehendes `setCategory`, Rolle Button |

Alle Varianten teilen Schriftrolle, Textausrichtung, Glasfläche, violette
Auswahl, Kontur und Druckrückmeldung. Sichtbare Mindesthöhe: 38 Punkte;
Touchfläche: mindestens 44 Punkte. Bei mehr als drei Optionen sinkt das
horizontale Padding von 18 auf 14 Punkte, bei großer Schrift auf 10 Punkte.
Ganze Pills dürfen umbrechen. Auf 390 Punkten Breite passen die vier deutschen
Wachstums-Zeiträume bei Standardschrift in eine Zeile; Kategorien nutzen mehrere.
Doppelte lokale Styles und die dadurch ungenutzten Größenkurven-Variablen bzw.
Imports wurden entfernt. Farben der Kurven und weitere Screen-Inhalte bleiben
außerhalb dieses Pakets.

## Prüfung und Grenzen

- 19 Tests in vier Suiten grün: gemeinsame Auswahl, Übersetzungen für Meilensteine
  und Self Care, bestehende Zeitnavigation. Gesperrter Monat bleibt anklickbar,
  damit der Screen die vorhandene Zugangserklärung anzeigen kann.
- App-Typprüfung im Arbeitsverzeichnis und eingefrorenen Update-Quellstand grün;
  Test-Typprüfung grün. Keine neuen Lint-Diagnosen; vorhandene Hinweise bleiben.
- 78 benannte Callbacks ohne JSX im veröffentlichten Ausgangsstand sind per
  TypeScript-AST unverändert. Die Screen-Diffs beschränken sich auf Auswahl-JSX,
  die zugehörigen Styles und ungenutzte Imports/Variablen.
- 96 Komponenten-Webvarianten: vier Stellen, 320/390 Punkte, Deutsch/Englisch/
  Spanisch, Schriftfaktor 1/1,6 und Hell/Dunkel. Kein horizontaler Überlauf oder
  abgeschnittener Auswahltext; Touchhöhe mindestens 44 Punkte.
- Acht Auswahlwechsel im lokalen Webzustand geprüft, je eine Auswahl pro Stelle
  und Farbmodus. Keine Backend-Abfragen oder privaten Kontodaten in der Vorschau.
- Die Vorschau verwendet tatsächliche Auswahl-JSX, Komponente und Übersetzungen,
  mit React Native Web, Expo Blur Web und simuliertem Schriftfaktor. Sie prüft
  weder native Schriftmetriken/Glaswirkung noch vollständige authentifizierte
  Screens, Tastaturabläufe oder VoiceOver/TalkBack am Gerät.

Belege: `output/growth-selection-20261013/`. Vergleich und Einzelbilder:
`/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Kurven-Meilensteine/`.

## Update-Quellstand

Isolierter Quellstand auf zuletzt veröffentlichtem Kandidaten
`5a0a8226-868d-4753-bafb-2baa66bea200`; nur fünf freigegebene Dateien werden
gepatcht. Alle 1081 Quell-Dateihashes wurden geprüft. Native Abhängigkeiten,
Konfiguration und Assets bleiben erhalten: 120 iOS- und 125 Android-Assets.
Beide Hermes-Exporte erfolgreich, Laufzeit `1.0.25`, Umgebung `production`,
Kanal `release-candidate-20261003`.

Veröffentlichtes [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/697b2747-af1f-4cf7-b43c-b794b258ae75):

- Gruppe: `697b2747-af1f-4cf7-b43c-b794b258ae75`
- iOS: `01a1350e-432e-7fc1-b919-a6adf7435d60`
- Android: `01a1350e-432e-7d72-b198-53e21eca81d8`

Beide ausgelieferten Manifeste antworten mit HTTP 200 und enthalten die erwarteten
Update-IDs, Laufzeit, Bundle- und Asset-Hashes. Kanalzuordnungen und das Main-Update
bleiben unverändert. Der direkte Abruf der CDN-Bundlebytes antwortet hier mit
HTTP 403; diese Bytes sowie Installation und Darstellung am Gerät sind nicht
verifiziert. Die veröffentlichten Metadaten-Hashes stimmen mit dem Export überein.
