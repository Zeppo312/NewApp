# Weiße Schrift in den Home-Übersichten – 13.10.2026

Die Baby- und Schwangerschaftsübersicht verwenden im dunklen Modus reines
Weiß für Überschrift, Werte und Beschriftungen. Die Schwangerschaftskarte
setzt `useOverviewColors().text` und `.accent` auf `Colors.dark.textPrimary`;
ihre Beschriftungen haben im dunklen Modus volle Deckkraft.

Die weiße Baby-Übersicht ist bereits in der zuletzt veröffentlichten Basis
`b08fa5b0-cbe4-4493-812b-633fdd042fb6` enthalten. Darauf ergänzt dieses Update
ausschließlich `components/pregnancy-guide/overview-card.tsx`. Die übrigen
1080 Quelldateien entsprechen der veröffentlichten Basis. Die isolierte Quelle
liegt unter `.family-qa/overview-white-text-20261013/source`.

## Prüfung

- Alle 1081 Quell-Dateihashes geprüft; genau eine geänderte Datei.
- App- und Test-Typprüfung im isolierten Quellstand erfolgreich.
  Vorhandene Backend-Testdateien sind dafür über einen lokalen Link erreichbar.
- ESLint der geänderten Komponente: keine Fehler oder Warnungen.
- Komponenten-Webvorschau mit 390 Punkten: Überschrift, SSW, Trimester und
  Fortschritt einschließlich aller Werte sind im dunklen Modus weiß und
  vollständig deckend. Die hellen Werte bleiben lila und die Beschriftungen braun.
  Die Vorschau verwendet die tatsächliche Komponente mit Beispieldaten und
  vereinfachten nativen Icons und Glasflächen.
- Beide Hermes-Exporte erfolgreich; native Konfiguration und Abhängigkeiten
  entsprechen der Basis. Assets identisch: 120 iOS und 125 Android.
- Ausgelieferte Manifeste: HTTP 200, erwartete Update-IDs, Runtime,
  Bundle- und sämtliche Asset-Hashes. Kanalzuordnungen und Main-Update geprüft.

Belege: `output/overview-white-text-20261013/`.
CDN-Bundlebytes antworten hier mit HTTP 403 und wurden nicht direkt verifiziert.
Installation und native Darstellung auf einem Gerät sind nicht verifiziert.

## Veröffentlichung

[EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/db7c5b83-2d4f-49e4-88c8-37ccd04a8679)

- Gruppe: `db7c5b83-2d4f-49e4-88c8-37ccd04a8679`
- iOS: `01a13615-ec7a-7ba0-9e74-87ca2f52b98f`
- Android: `01a13615-ec7a-75a6-b929-bc79293cf1ca`
- Kanal und Branch: `release-candidate-20261003`
- Umgebung: `production`; Runtime: `1.0.25`
- Projekt: `@janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`

In einer kompatiblen Installation die App online vollständig beenden und
neu öffnen, das Update herunterladen lassen und anschließend nochmals
vollständig beenden und neu öffnen.
