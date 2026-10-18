# Planer-Aktionen EAS Update vom 12. Oktober 2026

Die Planer-Aktionen wurden auf den gemeinsamen kontrastfesten ActionButton
umgestellt. Die vorhandenen Typografieänderungen und bisherigen Kandidaten-
korrekturen sind enthalten.

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`, `@janzeppi/LottiBaby`.
- Kanal und Branch: `release-candidate-20261003`.
- Environment: `production`.
- Runtime: `1.0.25`, Expo SDK 57, iOS und Android.
- Updategruppe: `4c0cb1a8-434d-45c4-992e-53cf7430e5f6`.
- iOS: `01a13001-f74a-716a-b5c3-d79b93f09796`.
- Android: `01a13001-f74a-7198-b750-c8ab91ad6bec`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/4c0cb1a8-434d-45c4-992e-53cf7430e5f6).

## Umfang

- `components/planner/PlannerCaptureModal.tsx`: Speichern, Abbrechen, Löschen,
  Datum hinzufügen/entfernen, Serienende hinzufügen/entfernen, Endzeit
  hinzufügen/entfernen und Zeitraum übernehmen. Leerer Titel und erforderliche
  Serienzeit werden sichtbar deaktiviert. Bestätigungen bleiben erhalten.
- `components/planner/FloatingAddButton.tsx`: beschriftete Hauptaktion Hinzufügen.
- `app/planner/index.tsx`: kompakte manuelle Apple-Kalender-Synchronisierung
  mit gemeinsamem Busy-Zustand.
- `components/modals/IOSBottomDatePicker.tsx`: gemeinsame Aktionen
  Abbrechen/Fertig unter dem Datumsrad. Gilt ebenfalls für seine weiteren
  Aufrufer; Labels, Grenzen und Entwurfs-/Bestätigungswege bleiben erhalten.
- `lib/plannerTranslations.ts`: DE/EN/ES-Beschriftungen für Hinzufügen und Sync.
- `lib/__tests__/plannerActions.test.tsx`: gezielte Ablaufregressionen.

Fachfarben, Auswahlfelder und Navigation behalten ihre bisherigen Rollen.
Der umfassendere Formularrahmen ist weiterhin ein eigener Arbeitsschritt.
Einzelheiten zum Buttonbaustein und den Prüfungen stehen in [actions.md](actions.md).

## Nachweise

Die eingefrorene Quelle basiert auf Updategruppe
`240b3fc8-93c8-4f9f-9641-88b2ef67c2ef`. 1.052 Quelldateien der bisherigen
Veröffentlichung wurden per Hash bestätigt und darüber sechs geprüfte
Planer-/Picker-/Testdateien übernommen. Die vorbereitete Quelle enthält
1.053 geprüfte Dateien. Die vorhandenen Typografiedateien, alle übrigen lokalen
Änderungen, Paketdateien, Assets und native Konfiguration sind erhalten.

- App- und ausgewählte Test-Typechecks bestehen in der eingefrorenen Quelle.
- 47 Tests in sechs Suites bestehen, einschließlich Datumsentwurf/-übernahme,
  erforderlicher Serienzeit, Vorkommen-/Serienspeichern und bestätigtem Löschen.
- ESLint: keine Fehler und keine neuen Diagnosen; neun vorhandene Warnungen.
- 72 Web-Layoutvarianten bestehen: 320/390 Punkte, DE/EN/ES, hell/dunkel,
  normale und simuliert 1,6-fache Aktionsschrift. Kein Textüberlauf in den
  geprüften Aktionen. Native Picker und Blur sind in dieser Ansicht Fixtures.
- Beide Hermes-Exporte enthalten die neuen Planer-Aktionen; Assets und
  Hermes-Format entsprechen dem bisherigen Kandidaten.
- Veröffentlichung mit `--skip-bundler` verwendet genau die geprüften Exporte.
- Ausgelieferte Multipart-Manifeste bestätigen Update-IDs, Runtime,
  Bundlehashes und sämtliche 120 iOS-/125 Android-Assethashes.
- Die neue Gruppe ist das jüngste Update des Kandidatenbranches. Alle
  Kanalzuordnungen und das jüngste Update auf Branch `main` sind unverändert.

Direkte CDN-Bundleabrufe antworteten mit HTTP 403. Bestätigt sind die
Veröffentlichung und die Übereinstimmung der ausgelieferten Manifeste mit
lokalen Prüfsummen. CDN-Bytes, Installation auf dem iPhone und native visuelle
Abnahme sind noch nicht bestätigt.

Die schlüsselfreien Nachweise liegen in `output/planner-buttons-ota-20261012/`:
`source-preparation.json`, `export-preflight.json`, `export-verification.json`,
`prepublish-verification.json`, `served-manifest-verification.json`,
`publication-verification.json`, `layout-verification.json` und Typecheck-/Test-
und Lintnachweise. Die eingefrorene Quelle und private Rohantworten liegen in
`.family-qa/planner-buttons-ota-20261012/`.

Die Vergleichsansicht mit echten Komponenten und Beispieldaten liegt außerhalb
des Repositorys unter
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Planer-Buttons/Vorher-Nachher.html`.

## TestFlight-App

Live geprüft wurde der fertige Store-Build
`fdd3dabd-ae10-41db-9e70-925d775402c4`: App-Version `1.0.25`, Build `1.0.80`,
SDK 57, Kanal `release-candidate-20261003`, Runtime `1.0.25`. Dieses Update ist
mit dem bekannten TestFlight-Kandidaten kompatibel; die tatsächlich auf dem
iPhone installierte Buildnummer wurde in diesem Schritt nicht ausgelesen.
Android-Kandidat: App `1.0.25`, Build `24`, gleiche Runtime und gleicher Kanal.

Die App vollständig beenden und mit Internet öffnen, den Download abwarten,
dann nochmals vollständig beenden und öffnen. So wird das beim Start
asynchron geladene Update angewendet; siehe
[Expo-Dokumentation zum Laden von Updates](https://docs.expo.dev/eas-update/download-updates/).
Ein EAS Update ändert die TestFlight-Buildnummer nicht. Auf dem Gerät insbesondere
Speichern/Abbrechen, Datumspicker, Notizoverlay und Serienbestätigungen prüfen.
