# Foto-Glas und ruhige Reflexe – 13. Oktober 2026

Die Nutzerbilder zeigen in beiden Modi fast deckende Karten und eine deckende
Schlafuhr auf einem eigenen Foto. Im Code löste `isPhotoBackground` bislang die
94-%-Lesefläche aus. Die sichtbaren hellen Flecken entsprechen außerdem den
zusätzlichen radialen Reflexschichten des gemeinsamen Kartenmaterials.

Die Korrektur bleibt in der vorhandenen gemeinsamen Grundlage:

- `ContentColors.photoSurface`: helle Foto-Karten mit 28 %, dunkle mit 34 %
  Grundtönung. Die Unschärfe bleibt erhalten; diese Werte beschreiben nur die
  Farbschicht, nicht die gesamte optische Deckkraft des nativen Materials.
- `photoTimerSurface`: blaue Grundtönung mit 24 % hell / 30 % dunkel.
  `SleepTimerFace` wählt die Timer-Rolle im gemeinsamen `ContentGlassMaterial`.
- Die radiale weiße Reflexschicht ist für gemeinsame Lesekarten und Uhr
  ausgeschaltet; der gleichmäßige Glanz ist von 0,28 auf 0,12 zurückgenommen.
  Glaskanten, fachliche Tönungen und bisherige Layouts bleiben erhalten.
- Die dichte Lesefläche wird nur bei „Transparenz reduzieren“ bzw. fehlender
  Android-Unschärfe verwendet. Eigene Fotos erzwingen sie nicht mehr.
- Home, Unser Tag und Schlaf sowie die bisherigen gemeinsamen Karten-Wrapper
  übernehmen die Korrektur. Formular- und spezielle Onboarding-Materialwerte
  sind nicht Bestandteil dieser kleinen Nachkorrektur.

Die fünf zugehörigen Quelldateien wurden als Delta auf die zuletzt veröffentlichte
Gruppe `94033b0f-83dd-4da7-a59c-e9931d194548` angewendet. Andere veröffentlichte
Dateien, native Konfiguration, Pakete und Assets bleiben unverändert. Vorhandene
lokale Änderungen werden nicht überschrieben oder gesammelt veröffentlicht.

Prüfung: Typprüfung für Update-Quelle und Arbeitskopie bestanden; 73 Tests in
10 Suites bestanden; keine neuen ESLint-Warnungen oder Fehler (zwei vorhandene
Warnungen in `Colors.ts`). 34 Daten-/Timer-Callbacks sind per AST unverändert.
24 Foto-Webvarianten prüfen Home/Unser Tag/Schlaf in Hell/Dunkel bei 320/390 Breite
und normaler/1,6-facher Schrift. Keine gemessenen Überläufe; keine 94-%-Foto-Karten
und keine radialen weißen Reflexschichten. Zwei weitere Fälle bestätigen den
dichten Accessibility-Fallback.

Die lokale Komponenten-Webvorschau nutzt tatsächliche Komponenten und extrahiertes
Screen-JSX mit einem vorhandenen Parkfoto aus den App-Assets, Beispieldaten,
vereinfachten Icons und Expo-Web-Unschärfe. Die Nutzerfotos dienen als Beleg für
das vorherige Ergebnis. Die neue native Wirkung, Kontrast auf beliebigen Fotos
und Gerätespeicherung sind damit noch nicht am iPhone/Android überprüft.

EAS Update: `8deb22f2-f5ee-4352-91e7-a8ccb24b2988`, iOS und Android,
`release-candidate-20261003`, Environment `production`, Runtime `1.0.25`.

[Update in EAS](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/8deb22f2-f5ee-4352-91e7-a8ccb24b2988)

Die ausgelieferten Manifeste stimmen für beide Plattformen mit Update-IDs,
Bundle-Hash und sämtlichen Asset-Hashes überein (120 iOS / 125 Android).
Kanalzuordnungen und Main-Update sind unverändert. Direkter CDN-Abruf der
Bundle-Bytes liefert HTTP 403; Byte-Auslieferung und Geräteinstallation sind
damit nicht bestätigt.

Prüfberichte: `output/photo-glass-20261013/`.
Lokale Vorschau: `/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Fotoglas/`.
