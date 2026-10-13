# Geburtsvorbereitungs-Karte im Premium-Look – 13.10.2026

Die Geburtsvorbereitungs-Karte auf `app/(tabs)/pregnancy-home.tsx` (ab SSW 34)
nutzt jetzt denselben Hintergrund wie das Lotti-Premium-Panel: dunkle Glasfläche
plus halbtransparenter Lila-Verlauf. Titel und Icon sind gold, Text weiß, der
Button glasig-weiß. Verlauf und Gold kommen als `PREMIUM_PANEL_GRADIENT` und
`PREMIUM_GOLD` aus `components/PremiumHighlights.tsx`. Die ungenutzte Variable
`accentPurple` wurde entfernt.

## Prüfung und Grenzen

- Isolierter Quellstand: neuester Kandidat `a14b3eb5-6fce-4d0a-8d3a-1274a6cb527f`
  (Skia-Entfernung) plus genau diese zwei Dateien. Alle 1081 Quell-Dateihashes
  wurden geprüft. Native Abhängigkeiten und Konfiguration sind unverändert.
- Typprüfung grün; 35 Tests in drei Suiten grün; keine neuen Lint-Diagnosen
  (20 statt 21 Warnungen).
- Export beider Plattformen mit der Umgebung `production`, Laufzeit `1.0.25`.
  Assets unverändert (120 iOS / 125 Android), Hermes-Format unverändert. Metro
  meldete für iOS 3635 Module statt 3615 beim Vorgänger (Android identisch: 3638).
  Die Änderung fügt keine Imports hinzu. Wahrscheinlich ist das eine Cache-Abweichung in der Zählung.
- Ausgelieferte Manifeste: HTTP 200, Update-IDs, Laufzeit, Bundle- und Asset-Hashes
  stimmen mit dem Export überein. Kanalzuordnungen und Main-Update sind unverändert.
  CDN-Bundlebytes antworten mit HTTP 403 und sind nicht direkt verifiziert.
  Installation und Darstellung am Gerät sind nicht verifiziert.

Belege: `output/birth-prep-premium-bg-20261013/`, `.family-qa/birth-prep-premium-bg-20261013/`.

## Veröffentlichung

[EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/bdd31e97-7236-43b4-9a11-204784df62e4)
auf Kanal `release-candidate-20261003`:

- Gruppe: `bdd31e97-7236-43b4-9a11-204784df62e4`
- iOS: `01a13573-370b-7ed5-b47b-f75a216c424c`
- Android: `01a13573-370b-7d6b-92b8-c97c84733e17`
