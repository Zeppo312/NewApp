# Einheitliche Popup-Aktionen und rundes Plus – EAS Update vom 12. Oktober 2026

Das runde Plus ersetzt wieder die beschriftete Hinzufügen-Aktion. Die
Speicherbestätigung der Aufnahmeformulare sitzt einheitlich unter dem
scrollbaren Inhalt. Die vorhandenen Typografieänderungen und bisherigen
Kandidatenkorrekturen sind erhalten.

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`, `@janzeppi/LottiBaby`.
- Kanal und Branch: `release-candidate-20261003`.
- Environment: `production`, Runtime `1.0.25`, Expo SDK 57, iOS und Android.
- Updategruppe: `44ea2579-bdc6-46d2-be5d-5b0902256d6c`.
- iOS: `01a1302d-01eb-7fa4-9871-4e2268cbe368`.
- Android: `01a1302d-01eb-751b-bf72-975a47ca0770`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/44ea2579-bdc6-46d2-be5d-5b0902256d6c).

## Umfang

`components/ui/dialog-actions.tsx` bietet eine gemeinsame Aktionsleiste mit
Umbruch, Mindesthöhen, gemeinsamen Textrollen/Farbpaaren, Busy-/Disabled-
Zuständen und optionalem Safe-Area-Abstand. Standard: Abbrechen links,
Speichern rechts. Kontextlabels für Fertig, Übernehmen, Timerstart und
Archivieren bleiben erhalten. Der Header übernimmt keine Speicherbestätigung.

Angebundene Dateien:

- `app/(tabs)/weight-tracker.tsx` und `app/(tabs)/size-tracker.tsx`:
  Aufnahme/Bearbeitung; obere Speicherhaken entfernt, Footer unter ScrollView.
  Leerwert und Vorschau deaktivieren Speichern, Busy sperrt die Footeraktionen.
- `app/(tabs)/sleep-tracker.tsx`: manuelle Aufnahme/Bearbeitung und beide
  iOS-Zeitpicker; Bestätigung unten.
- `components/SleepQuickAddModal.tsx`: Schnelleingabe und TimePickerField.
- `components/ActivityInputModal.tsx`: Mahlzeiten/Windeln und beide iOS-
  Zeitpicker; bestehende Draft-/Bestätigungsgrenzen bleiben bestehen.
- `app/tooth-tracker.tsx` und `app/(tabs)/index.tsx`: Zahn- und Wehenaufnahme.
- `app/baby-names.tsx`: Einzel-/Sammeleingabe im Namenseditor.
- `components/planner/PlannerCaptureModal.tsx`: Erfassung und Zeitraum.
- `components/modals/IOSBottomDatePicker.tsx` und `TextInputOverlay.tsx`:
  Bestätigungsleiste mit bestehenden Labels und Entwurfswerten.
- `components/CustomActivityDefinitionModal.tsx` und
  `CustomActivityEntryModal.tsx`: gemeinsame Footeranordnung.
- `components/planner/FloatingAddButton.tsx`: rundes Plus, 56 Punkte,
  gemeinsame opake Normal-/Pressed-Farbpaare und unveränderter
  Accessibility-Name. Gilt auch für Gewicht/Größe und weitere Aufrufer.

Abbrechen des Planer-Zeitraums stellt die vorherigen Zeiten und den Ganztags-
modus wieder her. Die verschachtelten Schlaf-/Aktivitäts-Zeitpicker übernehmen
Entwürfe ausschließlich über Fertig; Abbrechen und Hintergrund-/Systemschließen
verwerfen den Entwurf. Auswahlhaken, Fachfarben und Navigation bleiben bestehen.

## Nachweise

Die Quelle basiert auf Updategruppe `4c0cb1a8-434d-45c4-992e-53cf7430e5f6`.
1.053 bestehende Dateien wurden per Hash bestätigt. Die lokalen Ausgangsstände
aller überlagerten Dateien entsprechen diesem Kandidaten. 18 geprüfte
UI-/Testdateien wurden übernommen; 1.055 vorbereitete Dateien sind geprüft.

- 69 Tests in neun Suites und App-/ausgewählte Test-Typechecks der eingefrorenen
  Quelle bestehen. Geprüft: separate Abbruch-/Save-Callbacks, Busy/Read-only,
  Gewicht-/Größe-Footer, Pickerabbruch, Serienbestätigungen und erhaltene Entwürfe.
- Die Betreuungseingabe-Tests sind mit Auth/Billing/Storage-Fixtures isoliert;
  so blockiert der bekannte Billing-ESM-Importfehler diese UI-Prüfung nicht mehr.
- 17 fachliche Save-/Delete-/Commit-Callbacks und bestehende Textstile in
  13 Formular-Dateien sind gegenüber dem vorherigen Kandidaten unverändert.
- Die vorhandenen Typografiedateien und alle übrigen lokalen Änderungen sind
  per Hash erhalten. Pakete, native Konfiguration und Assets sind unverändert.
- ESLint: keine Fehler, 116 bestehende Warnungen. Ein weiterer Purity-Hinweis
  zeigt auf den schon vorher vorhandenen `Date.now()`-Ausdruck der Wehenauswertung;
  dieser Quelltext ist unverändert.
- 202 Nachher-Webvarianten bestehen: 320/390 Punkte, DE/EN/ES, hell/dunkel,
  normale und simulierte 1,6-fache Aktionsschrift; zusätzlich 320×568 für
  kleine Displays. Kein abgeschnittener Aktionsname oder Footer außerhalb
  des Viewports in den geprüften Varianten.
- Hermes-Exporte enthalten die neuen Footeraktionen. Assets und Hermes-Format
  entsprechen dem vorherigen Kandidaten.
- Veröffentlichung mit `--skip-bundler` verwendet exakt diese geprüften Exporte.
- Ausgelieferte Multipart-Manifeste bestätigen Update-IDs, Runtime,
  Bundlehashes und alle 120 iOS-/125 Android-Assethashes.
- Die neue Gruppe ist das jüngste Update des Kandidatenbranches.
  Kanalzuordnungen und das jüngste Update auf Branch `main` sind unverändert.

Nach der Veröffentlichung wurden lokal ausschließlich Einrückungsleerzeichen
in acht Leerzeilen der beiden Picker-Dateien entfernt. Der eingefrorene
veröffentlichte Stand bleibt erhalten; der lokale Stand ist abgesehen von
leeren Zeilen identisch. `git diff --check` besteht. Es gab keinen Git-Push.

Direkte CDN-Bundleabrufe antworteten mit HTTP 403. Bestätigt sind Manifeste und
lokale Prüfsummen; CDN-Bytes und Installation auf dem iPhone sind nicht geprüft.
Die Web-Prüfansicht nutzt echte Komponenten beziehungsweise originales
Formular-JSX mit Beispieldaten, Auth-/Blur-/Picker-Fixtures. Sie belegt Layout,
keine native Blendwirkung, Systemschrift, Tastatur oder Pickerdarstellung.

Schlüsselfreie Nachweise liegen unter `output/popup-actions-ota-20261012/`,
unter anderem `source-preparation.json`, `source-preservation.json`,
`export-preflight.json`, `export-verification.json`, `prepublish-verification.json`,
`served-manifest-verification.json`, `publication-verification.json`,
`postpublication-formatting.json`, `layout-verification.json` und Typecheck-/Test-
und Lintlogs. Quelle und private Rohantworten: `.family-qa/popup-actions-ota-20261012/`.

## TestFlight und Vergleich

Live geprüft: Store-Build `fdd3dabd-ae10-41db-9e70-925d775402c4`, App `1.0.25`,
Build `1.0.80`, SDK 57, Kandidatenkanal und Runtime `1.0.25`. Android-Kandidat:
App `1.0.25`, Build `24`, gleiche Runtime und gleicher Kanal.

Vergleichsansicht außerhalb des Repositorys:
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Popup-Aktionen/Vorher-Nachher.html`.

Die App vollständig beenden, mit Internet öffnen, den Download abwarten und
nochmals vollständig neu starten. Ein EAS Update verändert die TestFlight-
Buildnummer nicht. Die native Abnahme am Gerät bleibt offen.
