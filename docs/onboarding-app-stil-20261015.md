# Onboarding im App-Stil – 15.10.2026

Das Onboarding spricht jetzt dieselbe Bildsprache wie die App. Ablauf,
Fragen, gespeicherte Antworten und Zielrouten bleiben unverändert; geändert
sind Darstellung, Orientierung und einzelne Bedienelemente.

## Änderungen

- **Lotti-Illustrationen statt alter Grafiken.** Die Figuren im grünen Strampler
  (`BabyThinking`, `MamaPapaBaby`, `BabyBirth`, `babyborn`) sind durch die
  Lotti-Babys aus dem Wochenmoment ersetzt. `components/onboarding/lotti-medallion.tsx`
  zeigt sie als runde Medaillons mit Halo, sanftem Einfedern und optionalem
  Schweben. „Bewegung reduzieren" schaltet beides ab. Die alten Bilddateien
  liegen weiter in `assets/images` und werden von anderen Stellen noch genutzt.
- **Kapitel statt eines 18-Schritte-Balkens.** `getOnboardingChapters` in
  `lib/onboarding-flow.ts` fasst die Schritte zu „Über dich", „Euer Baby",
  „Dein Befinden", „Euer Alltag" und „Dein Start" zusammen. Jedes Kapitel hat
  ein eigenes Segment, das sich animiert füllt; darunter steht der Kapitelname.
  Der Partnerflow zeigt nur das Kapitel „Über dich". Auf dem Willkommensschirm
  bleibt die Leiste unsichtbar. VoiceOver liest „Euer Baby · Kapitel 2 von 5".
- **Willkommen:** Lotti als großes Hero-Medaillon, zentrierter Titel, die
  Beispielkarten ohne zusätzliche Schnellaktionen.
- **Befinden:** Statt Emoji-Platzhalter reagiert Lotti auf die Antwort. Schwere
  Antworten zeigen tröstende Motive (Kuscheltier), nie ein trauriges Baby.
- **Einladung:** Klare Hierarchie – Code-Feld, violetter „Code einlösen"-Button,
  QR-Scan als Glas-Button, „Ohne Code weiter" als Textlink. Vorher standen
  zwei gleich aussehende graue Buttons nebeneinander.
- **Lebensphase:** Auswahlkarten als Zeilen mit Medaillon, Text und Auswahlkreis.
- **Wochenansicht:** Der Kreis füllt sich als Fortschrittsring mit der
  Schwangerschaft (wie im Schwangerschafts-Home).
- **Entlastung/Gemeinsam:** Der Alltagsgedanke steht als Sprechblase neben der
  nachdenklichen Lotti; „Du" und „Verknüpfte Person" sind über Lotti verbunden.
- **Kleinere Angleichungen:** Titel auf 32 pt (Textrolle `display`), Icon-Kreise
  in allen Auswahlkarten, Glas-Zurück-Button, Footer-Button mit Schatten und
  Ladeindikator. Android-Mappings für `arrow.left`, `arrow.right`, `arrow.down`
  und `qrcode.viewfinder` ergänzt; diese Icons fehlten dort bisher.

Neue Texte (Kapitelnamen) sind in Deutsch, Englisch und Spanisch angelegt.

## Prüfung und Grenzen

- Im iOS-Simulator (Debug-Build, iPhone 17) alle Schritte des Schwangerschafts-
  pfads durchlaufen; Endschirm bewusst nicht abgeschickt, um das Testkonto nicht
  zu überschreiben. Baby-geboren-Pfad, Partnerflow nach eingelöstem Code,
  Android und große Systemschrift nicht visuell geprüft.
- 74 Onboarding-Tests in sechs Suites (inkl. zwei neuer Kapitel-Tests) erfolgreich,
  App-/Test-Typecheck erfolgreich, ESLint ohne Fehler.
- Nicht veröffentlicht (kein OTA).
