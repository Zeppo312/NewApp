# Gemeinsame Buttons EAS Update vom 12. Oktober 2026

Die gemeinsamen kontrastfesten Buttons wurden mit den vorhandenen
Typografieänderungen auf dem bisherigen Kandidatenkanal veröffentlicht.

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`, `@janzeppi/LottiBaby`.
- Kanal und Branch: `release-candidate-20261003`.
- Environment: `production`.
- Runtime: `1.0.25`, Expo SDK 57, iOS und Android.
- Updategruppe: `240b3fc8-93c8-4f9f-9641-88b2ef67c2ef`.
- iOS: `01a12f8b-6c92-7007-81ae-993fd7b125c2`.
- Android: `01a12f8b-6c92-7563-9ae4-2bd2047f6177`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/240b3fc8-93c8-4f9f-9641-88b2ef67c2ef).

## Veröffentlichter Umfang

Der neue `ActionButton` verwendet gemeinsame Aktionsfarben, die bestehenden
Rollen `button` und `buttonSmall`, wachsende Beschriftungen sowie Busy- und
Disabled-Zustände. Die erste Anwendung umfasst Anmeldung/Registrierung,
TextInputOverlay, Definition und Eintrag eigener Aktivitäten und das Melden
einer KI-Antwort. Einzelheiten stehen in [actions.md](actions.md).

Die isolierte Quelle basiert auf dem heutigen Typografie-Update
`f662c89a-7401-4942-a21c-f7b33005aa17`. 1.048 Dateien der veröffentlichten
Quellenkette wurden per Hash geprüft. Darüber wurden zwölf Button- und
Testdateien aus dem geprüften lokalen Arbeitsstand übernommen. Bestehende
Typografie und vorherige Kandidatenkorrekturen bleiben enthalten. Paketdateien,
native Konfiguration, Assets und die Runtime der normalen Arbeitskopie wurden
nicht geändert.

## Nachweise

- App- und ausgewählte Test-TypeScript-Prüfungen bestehen in der isolierten Quelle.
- 30 gezielte Tests in vier Suites bestehen, einschließlich Busy/Disabled,
  Aktionskontrast, Anmeldung/Einwilligung, Fehler/Wiederholen und erhaltenen Entwürfen.
- ESLint: keine Fehler, dieselben vier bereits bestehenden Warnungen.
- Hermes-Exporte für beide Plattformen enthalten den neuen Buttonbaustein.
- Veröffentlichung mit `--skip-bundler` verwendet genau diese geprüften Exporte.
- Ausgelieferte Multipart-Manifeste bestätigen die Update-IDs, Runtime,
  Bundlehashes und sämtliche 120 iOS- beziehungsweise 125 Android-Assethashes.
- Die neue Gruppe ist das jüngste Update auf dem Kandidatenbranch.
- Alle Kanalzuordnungen und die bisherigen Updates auf Branch `main` sind unverändert.

Direkte CDN-Bundleabrufe antworteten mit HTTP 403. Bestätigt sind die
Veröffentlichung und die Übereinstimmung der Manifeste mit den lokalen
Prüfsummen. CDN-Bytes, Geräteinstallation und native visuelle Abnahme sind nicht
bestätigt. Es wurde kein nativer Build und keine Servermigration durchgeführt.

Die schlüsselfreien Prüfberichte liegen unter `output/buttons-ota-20261012/`:
`source-preparation.json`, `export-preflight.json`, `export-verification.json`,
`prepublish-verification.json`, `served-manifest-verification.json` und
`publication-verification.json` sowie Typecheck-/Testlogs und `lint.json`.
Die eingefrorene Quelle und private Rohantworten liegen unter
`.family-qa/buttons-ota-20261012/`.

## Update auf dem Gerät laden

Die Kandidaten-App mit Kanal `release-candidate-20261003` und Runtime `1.0.25`
vollständig beenden und mit Internet öffnen. Nach dem Download nochmals
vollständig beenden und öffnen. Dieses Verhalten ist in der
[Expo-Dokumentation zum Laden von Updates](https://docs.expo.dev/eas-update/download-updates/)
beschrieben. Anschließend Hauptaktionen, Textoverlay und eigene Aktivitäten
einschließlich Speichern, Fehler und Abbrechen auf dem Gerät prüfen.
