# Wehen-Tracker: gemeinsame Zeitraum-Auswahl – 13.10.2026

Der aktive Wehen-Tracker ist `app/(tabs)/index.tsx` (Tab `index` in
`app/(tabs)/_layout.tsx`). Seine eigene Tag/Woche/Monat-Zeile wurde durch
`PeriodTabs` aus `components/ui/period-tabs.tsx` ersetzt, Fundstelle Zeile 943.
Die vorhandenen Übersetzungen und `setSelectedTab` bleiben erhalten. Der
Scrollcontainer liefert bereits 20 Punkte Rand; deshalb ist die horizontale
Außenmarge der Komponente hier null.

Damit gelten dieselben Glas-Pills, Textrolle, Ausrichtung, Rundungen,
Auswahlfarben, Druckrückmeldung und Touchhöhe wie in Unser Tag, Schlaftracker,
Planer und Self Care. Größen-/Gewichtskurve und Meilensteine verwenden denselben
Kern über `SelectionTabs`. Sichtbare Mindesthöhe: 38 Punkte; Touchhöhe: 44 Punkte.
Die sechs alten lokalen Tab-Styles wurden entfernt. Timer, Statistik, Navigation,
Datumsfilter und Erfassung sind nicht Gegenstand dieses Pakets.

## Prüfung

- 21 Tests in drei Suiten grün: PeriodTabs, PeriodNavigationButton,
  DailyUseTranslations einschließlich Wehen-Übersetzungen.
- Typprüfung im Arbeitsverzeichnis und isolierten Update-Quellstand grün.
  Keine neuen Lint-Diagnosen.
- 34 benannte Callbacks ohne JSX sind per TypeScript-AST unverändert gegenüber
  dem veröffentlichten Ausgangsstand. Manuell geprüfter Diff: nur Import,
  Zeitraum-Auswahl-JSX und die zugehörigen lokalen Styles.
- 24 Webvarianten: 320/390 Punkte, Deutsch/Englisch/Spanisch, Schriftfaktor
  1/1,6, Hell/Dunkel. Auswahltexte passen, kein horizontaler Überlauf,
  Touchhöhe mindestens 44 Punkte. Alle sechs lokalen Auswahlwechsel zwischen
  Tag, Woche und Monat in beiden Farbmodi erfolgreich.
- Die Komponenten-Vorschau verwendet tatsächliche JSX und Übersetzungen,
  React Native Web, Expo Blur Web sowie simulierte Systemschrift. Sie prüft
  weder vollständige authentifizierte Screens noch native Glaswirkung,
  VoiceOver/TalkBack oder Installation auf einem Gerät.

Belege: `output/contraction-period-tabs-20261013/`. Vergleichsbild:
`/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Wehen-Auswahl/vergleich.png`.

## Update-Quelle

Basis ist der zuletzt veröffentlichte Kandidat
`7e007cd6-c3f6-47bc-8e4d-f25c119e7f39`. Von 1081 per Hash geprüften Quelldateien
ändert sich nur `app/(tabs)/index.tsx`. Bestehende Änderungen im Arbeitsverzeichnis
wurden vorab erfasst und bleiben erhalten. Native Abhängigkeiten, Konfiguration
und Assets bleiben unverändert. Beide Hermes-Exporte sind erfolgreich:
120 iOS- und 125 Android-Assets, Runtime `1.0.25`, Umgebung `production`,
Kanal `release-candidate-20261003`.

Veröffentlichtes [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/b08fa5b0-cbe4-4493-812b-633fdd042fb6):
Gruppe `b08fa5b0-cbe4-4493-812b-633fdd042fb6`,
iOS `01a135ac-605b-76b4-9b64-ead99ff42a92`,
Android `01a135ac-605b-7c78-ba30-bd23a72677a4`.

Beide ausgelieferten Manifeste liefern HTTP 200 und die erwarteten Update-IDs,
Runtime, Bundle- und Asset-Hashes. Kanalzuordnungen und Main-Update sind
unverändert. Der direkte CDN-Bundleabruf liefert hier HTTP 403; Bundlebytes und
Installation auf einem Gerät sind nicht verifiziert. Die Metadaten-Hashes passen
zum geprüften Export.
