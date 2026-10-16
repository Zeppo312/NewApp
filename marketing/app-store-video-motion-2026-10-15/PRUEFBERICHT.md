# Prüfbericht – App-Vorschau „Motion" (de-DE), 15.10.2026

## Bisheriges Video: drei Hauptschwächen

1. **Starrer Titelbalken über der App.** Ein durchgehend gleicher Creme-Balken (≈ 290 px) liegt über jeder Szene und verdeckt den oberen App-Rand; Texte wechseln nur per Überblendung, ohne Betonung oder Rhythmus.
2. **Kaum Bewegung, keine Führung des Blicks.** Die App läuft randlos im Bild, die Aufnahmen sind über weite Strecken Standbilder (3–5 Bilder/s Aufnahmerate). Es gibt keine Berührungshinweise und keine Markierung dessen, was gerade wichtig ist – man sieht nicht, wo getippt wurde.
3. **Sprunghafte Erzählung und schwacher Schluss.** Formular → blaue Bestätigung → Tagesübersicht folgen ohne Bezug aufeinander; der gespeicherte Eintrag wird später nicht wiedergefunden. Start/Laufen/Beenden des Schlafs ist nicht als Ablauf erkennbar. Der Abschluss ist nur eine Tagesübersicht mit Titelbalken – ohne Icon, ohne Markenmoment.

## Umgesetzte Verbesserungen

- Gerät frei im Bild statt Titelbalken; Typografie als eigene Ebene darüber, pro Szene neu choreografiert (Kicker, Wort-für-Wort-Einstieg, gezeichneter Unterstrich unter dem betonten Teil, Unterzeile).
- Dramaturgie Frage → Antwort: „Wann war das letzte Fläschchen?" wird mit der markierten echten Karte „Zuletzt um 11:40 Uhr" beantwortet; „Gewickelt? Schnell festgehalten." greift das Muster auf.
- Roter Faden: Der in Szene 2 gespeicherte Eintrag (Nass, 23:00) wird in Szene 3 erst in der Kennzahl, dann in der Timeline markiert.
- Schlaf als sichtbarer Ablauf: Schritte „Starten — Läuft — Beendet" schalten synchron zu den echten Zuständen; drei Berührungs-Hotspots genau auf den echten Taps.
- Einheitliche, ruhige Übergänge (kurze Abblende über Hell) statt Doppelbildern; Wartezeiten entfernt.
- Markenabschluss mit App-Icon, Name, Unterzeile und gut lesbarem, zweizeiligem Hinweis auf Anmeldung und Abo; die App-Ansicht bleibt dabei sichtbar.
- Eigene, rechtefreie Musik mit Tipp-Geräuschen; zusätzlich Fassung mit stummer Tonspur.

## Technische Daten (gemessen)

| Merkmal | Wert | Apple-Vorgabe (geprüft 15.10.2026) |
| --- | --- | --- |
| Datei | `export/lotti-baby-vorschau-motion-de.mp4`, 36,7 MB | ≤ 500 MB |
| Dauer | 27,5 s Bild (825 Bilder), Container 27,52 s | 15–30 s |
| Auflösung | 886 × 1920, hochkant, progressiv | 886 × 1920 (iPhone hochkant) |
| Bildrate | 30/1 konstant | ≤ 30 fps |
| Video | H.264 High, Level 4.0, yuv420p, BT.709, 10,42 Mbit/s CBR | High ≤ 4.0, Ziel 10–12 Mbit/s |
| Audio | AAC-LC, Stereo, 48 kHz, 256 kbit/s, eine Spur | 256 kbit/s AAC, Stereo, 44,1/48 kHz |
| Lautheit | −19,4 LUFS integriert, Spitze −6,2 dBFS | – |
| Poster | `…-poster.png`, 886 × 1920, Bild bei 2,9 s | Standard-Poster 5 s; in App Store Connect wählbar |

SHA-256: Film `78b02ab6…3353116`, stumme Fassung `65166b91…a91669`, Poster `49bef491…5a96`. Herkunft der Aufnahmen: `projekt/assets/clips/quellen.sha256`.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `hyperframes check` (Lint, Laufzeit, Layout, Bewegung, Kontrast) | bestanden; 0 Fehler; 25/25 Texte WCAG AA; 6 Lint-Hinweise nur zur Projektstruktur (eine Datei statt Unterkompositionen) |
| Vollständige Dekodierung | fehlerfrei |
| Schwarze Bilder (`blackdetect`) | keine |
| Harte Bildwechsel (`scdet`) | 4 – alle aus der App selbst (8,3 s Bestätigung → Unser Tag, 15,2 s „Nachtschlaf läuft", 16,7 s Timer-Ansicht, 18,9 s Dialog) |
| Nahezu stehende Bilder (`freezedetect`) | nur bewusste Lesepausen ≤ 1,4 s auf statischen App-Zuständen; Hintergrund bewegt sich weiter |
| Abgeschnittene Inhalte | keine; Texte max. 789 px von 790 px Satzbreite – nach Umformulierung Szene 2 alle Zeilen ≤ 683 px |
| Alte Titel durchscheinend | nein; Textebenen steigen vollständig aus, bevor die nächste einsteigt |
| Lesbarkeit klein | Kontrolle bei 300 px Breite: Überschriften, Unterzeilen, Schritte und Hinweis lesbar |
| Start / läuft / beendet | 14,15 s Tippen „Schlaf starten" · 15,2 s „Nachtschlaf läuft" · 16,7–18,9 s Timer 0:04 → 0:18 · 22,2 s beendete Ansicht (23:05, „Schlaf starten") |
| Ton | Spektrogramm ohne Knackser (nur die drei beabsichtigten Tipp-Geräusche) |
| Kontoname „Jan Zeppenfeld" / Startseite | nicht im Film |

## Apple-Inhaltsregeln

- Ausschließlich echte Simulator-Aufnahmen der App; keine nachgebaute Oberfläche, keine erfundenen Werte, Benachrichtigungen oder Abläufe. Alle in Texten genannten Werte (11:40 Uhr) stammen aus der gezeigten Ansicht.
- Grafische Ergänzungen nur in den von Apple genannten Formen: Berührungs-Hotspots auf echten Taps, Markierungen, Texte; Übergänge ausschließlich Abblenden/Überblendungen. Kein Hereinzoomen in die Oberfläche (Gerät wird nur verkleinert).
- Keine Hände, Personen, Bewertungen, Preise, saisonalen Bezüge oder Heil-/Schlafversprechen im Text.
- Anmeldung und Abo-Abhängigkeit am Schluss 3,4 s lesbar offengelegt.
- Musik: in diesem Projekt synthetisch erzeugt (`werkzeuge/musik-erzeugen.mjs`), keine Samples oder fremden Werke. Schrift Inter (SIL OFL), GSAP (Standard-Lizenz, kostenfrei).

## Verbleibende Einschränkungen

- **Version:** Aufnahmen aus Version 1.0.24 (Build 1.0.51). Übereinstimmung mit einer neueren einzureichenden Version ist nicht geprüft.
- **Aufnahmerate:** Die Simulator-Aufnahmen haben nur 3–5 Bilder/s. Die gescrollte Tagesübersicht wird deshalb per Abblende statt per (ruckelnder) Scrollbewegung gezeigt; App-eigene Animationen erscheinen als harte Wechsel. Neue Aufnahmen heute würden leere Tagesansichten zeigen, da die Demo-Daten auf den 14.10. datiert sind.
- **Daten in der App-Oberfläche:** Die App zeigt „Mittwoch, 14. Oktober" und „14.10., 23:00". Apple rät von Datumsangaben im Vorschautext ab; die Einblendungen enthalten keine, die App-Ansicht selbst schon.
- **Nicht im Material:** Das Auswählen von „Nass" (war bei Aufnahmebeginn gewählt) und welche Schlafqualität im Dialog gewählt wurde. Dort deshalb kein Berührungs-Hotspot.
- **Zeitsprung:** Der Timer springt per Abblende von 0:06 auf 0:18 (Wartezeit entfernt).
- **Musik nicht von einem Menschen abgehört.** Pegel bewusst ruhig; bei Nichtgefallen die Fassung `…-ohne-musik.mp4` verwenden.
- **Schrift:** Der Film nutzt Inter (frei lizenziert); die 63 Store-Screenshots nutzen SF Pro. Beide wirken sehr ähnlich, sind aber nicht identisch.
- **App Store Connect (15.10.2026):** Fassung mit Musik vollständig hochgeladen; Apple hat das Video der Spezifikation `a7adff12-330a-5fa5-97d4-c5c7953edb0c` (886 × 1920, 23–30 fps, 15–30 s, Tonspur erforderlich) zugeordnet. Poster bei `00:00:02:27`: **COMPLETE**. Video separat eingereicht: **WAITING_FOR_REVIEW**. Als einzige deutsche iPhone-Vorschau im Store-Entwurf **1.0.25** eingebunden. Dieser Entwurf ist noch ohne zugeordneten Build und nicht eingereicht; öffentlich bleibt 1.0.23. Nachweis: `export/app-store-upload.json`.
