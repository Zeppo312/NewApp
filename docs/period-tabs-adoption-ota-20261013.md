# Gemeinsame Zeitraumauswahl – Planer und Mama Self Care

Stand: 13. Oktober 2026.

`components/ui/period-tabs.tsx` ist die bereits aktive Tag-/Woche-/Monat-Auswahl
von Unser Tag und Schlaf. Planer (`app/planner/index.tsx`) und Mama Self Care
(`app/(tabs)/selfcare.tsx`) verwenden nun dieselbe Komponente: flache Glas-Pills,
zentrierte Textrollen, violette Auswahl und mindestens 44 Punkte Touchfläche.
Helle/dunkle Darstellung und Vergrößerung der Systemschrift kommen ebenfalls
aus dieser einen Komponente.

Die neue optionale `style`-Übergabe betrifft den Gruppencontainer. Beide neuen
Aufrufer haben bereits 20 Punkte Bildschirm-Padding und setzen deshalb die
horizontale Außenmarge auf null. Die bisherigen Aufrufer behalten ihre Defaults.
Die lokalen alten Tab-Renderings und nicht mehr verwendeten Tab-Stile entfallen.

Die Screens bestimmen weiterhin die Auswahl und ihre Labels. Planer verwendet
seinen bisherigen State-Setter. Self Care verwendet unverändert `handleSelectTab`
einschließlich Wochen-/Monatsoffset und Datenladen. Die bisherigen Monatssperren
von Unser Tag und Schlaf bleiben in deren Aufrufern; neue Sperren werden nicht
eingeführt. 51 bestehende Funktionen außerhalb der geänderten Renderings in
Planer und Self Care sind per AST unverändert.

Prüfung: Typprüfung für Update-Quelle und Arbeitskopie bestanden. 27 passende
Tests in sechs Suites bestanden (PeriodTabs, Selfcare-Übersetzungen, Planerfarben,
Widget-Snapshot und vorhandene Perioden-Navigationsbuttons). Keine neuen
ESLint-Warnungen oder Fehler; drei bestehende Warnungen im geprüften Umfang.

Die Komponenten-Webvorschau enthält die tatsächlichen Auswahl-JSX-Aufrufer,
eine Kopie der gemeinsamen Komponente mit Web-Testimporten, die aktuellen
Übersetzungen und Self Cares unveränderten Auswahlhandler. 48 Varianten
(Planer/Self Care, 320/390, DE/EN/ES, normale/1,6-fache Schrift, Hell/Dunkel)
passen ohne gemessene Seitenüberläufe; alle drei Tabs behalten mindestens
44 Punkte Touchhöhe. Monatsauswahl und sichtbare Auswahl-Rückmeldung sind
in beiden Modi bedient worden. Ganze authentifizierte Screens, reale
Datenabfragen und native Darstellung auf Geräten wurden dabei nicht geprüft.

EAS Update: `ea3822a6-b919-414a-b9c5-9c6b07c71a5c`, iOS und Android,
`release-candidate-20261003`, Environment `production`, Runtime `1.0.25`.
Die isolierte Quelle baut auf `7d286a4f-4726-43db-8567-fd6ea93e24a5` auf und
erhält damit auch die zuletzt veröffentlichten Formular-, Tastatur- und
Glas-Zurück-Button-Anpassungen. Nur die drei zugehörigen Quelldateien unterscheiden
sich; native Konfiguration, Pakete und übrige veröffentlichte Dateien bleiben.

[Update in EAS](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/ea3822a6-b919-414a-b9c5-9c6b07c71a5c)

Die ausgelieferten Manifeste stimmen für beide Plattformen mit Update-IDs,
Bundle-Hash und sämtlichen Asset-Hashes überein (120 iOS / 125 Android).
Kanalzuordnungen und Main-Update sind unverändert. Direkter CDN-Abruf der
Bundle-Bytes liefert HTTP 403; Byte-Auslieferung und Geräteinstallation sind
damit nicht bestätigt.

Prüfberichte: `output/period-tabs-adoption-20261013/`.
Lokale Vorschau: `/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Zeitraumauswahl/`.
