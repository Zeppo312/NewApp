# Sanftes Frostglas für Home, Unser Tag und Schlaf

Stand: 13. Oktober 2026. Gewählte Richtung: sichtbarer Hintergrund, ruhige
Frostglas-Flächen und klare Texte. Die vorher fast deckenden weißen Karten
bekommen wieder Tiefe; die warme Textsprache und fachlichen Farbakzente bleiben.

## Gemeinsame Grundlage

- `constants/Colors.ts`: `ContentColors` enthält helle/dunkle Lesekarten,
  dichtere Formularflächen, Reflexverläufe, Lichtkanten und die blaue Schlafuhr.
  Lesekarten haben 50 % Grundtönung, Formulare 74/76 %, robuste Leseflächen 94 %.
- `constants/Materials.ts`, über `DesignGuide.tsx` exportiert: gemeinsame
  Unschärfe (Lesekarten mindestens 40, Formulare 70), dezente Reflexe und Radius.
- `GlassMaterial` in `components/ui/GlassCard.tsx` teilt die vorhandenen
  Unschärfe-/Reflexschichten mit dem Onboarding. Dessen explizite Materialwerte
  und Layout bleiben erhalten. Kein zusätzliches natives Framework erforderlich.
- `ContentGlassMaterial` wählt das Material; `ContentCard` und die bisherigen
  `GlassCard`-/`LiquidGlassCard`-Wrapper verwenden es. Bestehende neutrale
  `GLASS_OVERLAY`-Aliases werden nicht doppelt als weiße Zusatzschicht aufgetragen.
- Home verwendet `ContentCard` für Begrüßung, Übersicht, Empfehlung und
  Schnellzugriff. Unser Tag und Schlaf übernehmen das Material über ihre bereits
  aktiven `ContentCard`-Verwendungen, einschließlich Wochen-/Monatskarten.
- `SleepTimerFace` verwendet dieselbe Glasbasis mit blauer Grundtönung.
  Uhr als Startknopf, flachere Zeitraum-Pills und bisherige Datenabläufe bleiben.
- `GlassSheetSurface` verwendet dichtere Frostglas-Flächen mit gemeinsamem
  Reflexverlauf. Eingabefelder bleiben dicht und lesbar. Die separat vorhandene
  Avatar-Material-Übergabe und Lavendel-Variante werden beibehalten.

Der Inhalt liegt außerhalb der nativen Unschärfeschicht. Android verwendet den
vorhandenen Hintergrund-BlurTarget ab API 31; ohne verfügbaren BlurTarget werden
dichtere Leseflächen angezeigt. Eigene Fotos bekommen ebenfalls eine dichtere
Kartenbasis. Unter iOS wird „Transparenz reduzieren“ für die neuen gemeinsamen
Karten und Standard-Formularflächen berücksichtigt. Alle Karten teilen eine
Systemabfrage und einen Listener; veraltete Abfragen überschreiben keine neueren
Ereignisse.

## Prüfung und Grenzen

- Typprüfung für isolierte Update-Quelle und Arbeitskopie bestanden; neuer
  Accessibility-Test separat typgeprüft.
- 73 Tests in 10 Suites bestanden: Timerstart, Schlafsynchronisierung,
  Tageswerte, Mahlzeiten, Übersetzungen, Zeitraum-Auswahl, Aktionen, Formulare
  und gemeinsame Transparenzpräferenz.
- ESLint: keine Fehler und keine zusätzlichen Warnungen gegenüber der
  veröffentlichten Ausgangsquelle; 12 bestehende Warnungen im geprüften Umfang.
- 34 Daten-/Timer-Callbacks in Home, Unser Tag und Schlaf per AST unverändert.
- Webvorschau aus tatsächlichen Komponenten und extrahiertem Screen-JSX:
  72 Varianten (320/390 Breite, DE/EN/ES, normale/1,6-fache Schrift, hell/dunkel).
  Keine gemessenen Seiten-/Textüberläufe; Zeitraum-Touchflächen mindestens 44.
  Uhrstart im Web-Test beobachtet. Vier weitere Materialfälle prüfen dichtere
  Flächen auf synthetischem kontrastreichem Hintergrund und bei reduzierter
  Transparenz. Das Formularmaterial und beide bisherigen Wrapper visuell geprüft.
- Die Webvorschau verwendet Expo-Web-Unschärfe, Beispieldaten, simulierte
  Schriftvergrößerung und vereinfachte Icons. Sie prüft keine realen Anmeldungen,
  Tastaturen oder Gerätespeicherung. Materialwirkung, Scrollleistung und native
  Unschärfe auf iPhone/Android bleiben am Gerät zu prüfen. Kein Simulator war
  gestartet. Eigene gemischte Fotos erfordern außerdem Prüfung von Texten, die
  außerhalb einer Karte liegen.

Prüfberichte liegen unter `output/soft-glass-20261013/`. Die Komponenten-Vorschau
liegt unter `/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Frostglas/`.

## EAS Update

- Kanal/Branch: `release-candidate-20261003`; Environment: `production`.
- iOS und Android; Runtime `1.0.25`; native Konfiguration und Pakete unverändert.
- Ausgangsgruppe: `02e6418e-d03e-4e65-aea7-46b04e696bf3` einschließlich der zuletzt
  veröffentlichten Baby-Auswahl. Isolierte Quelle mit 1.073 geprüften Datei-Hashes;
  ausschließlich 14 zugehörige Quell-/Testdateien unterscheiden sich vom Ausgang.
- Update-Gruppe: `94033b0f-83dd-4da7-a59c-e9931d194548`.
- iOS: `01a13406-f7e4-7557-9456-b2b1336ddcd9`.
- Android: `01a13406-f7e4-7578-8c0b-dae733b9a5e4`.

[Update in EAS](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/94033b0f-83dd-4da7-a59c-e9931d194548)

Der Export behält Hermes-Format und sämtliche bisherigen Assets (120 iOS,
125 Android) bei. Die ausgelieferten Manifeste stimmen für beide Plattformen mit
Update-IDs, Bundle-Hash und allen Asset-Hashes überein. Kanalzuordnungen und das
bisherige Main-Update sind unverändert. Direkter CDN-Abruf der Bundle-Bytes liefert
HTTP 403; die Byte-Auslieferung und Installation auf einem Gerät sind damit nicht
bestätigt.
Vorhandene lokale Änderungen bleiben erhalten. Parallel veränderte Avatar-Dateien
werden nicht aus der Arbeitskopie in dieses Update übernommen.
