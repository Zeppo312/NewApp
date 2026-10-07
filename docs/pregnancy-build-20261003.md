# Schwangerschaft: QA-Builds vom 3. Oktober 2026

Der neue Wochenbegleiter mit 42 Wochen, 24 Artikeln und zwölf Illustrationen ist in die aktuelle App-Quelle übernommen. Die native Konfiguration stammt aus dem zuletzt erfolgreich gebauten QA-Stand iOS 1.0.78 / Android 22. Alle vorhandenen Änderungen des aktuellen App-Codes und das bestehende Home-Design sind enthalten.

## Buildstatus

| Plattform | App / Build | Profil | Status |
| --- | --- | --- | --- |
| iPhone | 1.0.24 / 1.0.79 | `family-qa-ios` | [FINISHED](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/cf737c36-1565-421f-84a1-d36322eee200) |
| Android | 1.0.23 / 23 | `family-qa-play` | [FINISHED](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/43103bb6-59ac-49a1-910a-0eaf5b7f2282) |

Beide EAS-Builds sind abgeschlossen und die signierten Artefakte heruntergeladen. Native Version und Buildnummer stimmen mit den Build-Metadaten überein. QA-Backend, Consent, Google-Rückkehr und die neuen Schwangerschaftsrouten sind enthalten; alle zwölf Motive sind in beiden Dateien bytegleich zur vorbereiteten Quelle. iOS besteht `codesign --verify --deep --strict`; Android besteht Bundletool-Validierung und Signaturprüfung, das Upload-Zertifikat stimmt mit dem zuletzt unabhängig bestätigten EAS-Zertifikat überein. Android ist kein Debug-Build, verwendet Ziel-SDK 36 und enthält 70 native 64-Bit-Bibliotheken mit 16-KB-konformen Segmenten.

## Vorab geprüft

- Tatsächliche EAS-Archive: jeweils 1.073 bytegleich gebundene Dateien. Alle zwölf Bilder und App-Services enthalten; private lokale Quellen und Serverordner ausgeschlossen.
- Hermes-Export für iOS und Android erfolgreich; alle zwölf Motive bytegleich im Export enthalten. QA-Backend, Consent und neue Schwangerschaftsrouten im Bundle vorhanden.
- Aktueller Arbeitsordner unverändert; die Builds entstehen aus der ausgeschlossenen Kopie `.family-qa/pregnancy-build-20261003/source`.

Die Profile verwenden das bestehende QA-Backend und die vorhandenen Signierungsdaten. QA-OTA bleibt deaktiviert. Store-Einreichung und Geräteabnahme sind noch nicht erfolgt.

Nachweise: `output/pregnancy-build-20261003/source-preparation.json`, `source-manifest.json`, `archive-verification.json`, `candidate-export-verification.json` und `build-tracking.json`.

## Fertige Artefakte

- iPhone-IPA: `.family-qa/pregnancy-build-20261003/app.ipa`, SHA-256 `f31cf87e5b6e82183756b577d3827e35a564a3f4c1032a5a17fca1a41a129d3f`.
- Android-AAB: `.family-qa/pregnancy-build-20261003/app.aab`, SHA-256 `f0373d44e4daca38829fbeafd5f719cef30df9d404a642fc2942ec618ab34881`.

Zusätzliche Nachweise: `ipa-verification.json`, `aab-verification.json` und `pregnancy-artifact-verification.json`. Die vorhandene Schwangerschaftsumsetzung im Arbeitsordner ist nach dem Build weiterhin bytegleich. Eine Einreichung in TestFlight bzw. im internen Play-Test ist nicht Teil dieses Build-Auftrags und wurde nicht ausgeführt.
