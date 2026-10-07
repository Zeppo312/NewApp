# Screenshot-Liste und Material

**Finale Aufnahmen: OFFEN nach Abschluss von Schritt 5.** Die vorhandenen sieben Bilder zeigen nur QA-/Onboardingzustände aus einem englischen Android-Debugbuild. Sie sind keine verwendbaren deutschen Store-Screenshots. Lokale [Materialübersicht](material/index.html), unveränderte Dateien in `material/qa-step05/`, Iconquelle in `material/source/`.

## Acht konkrete Smartphone-Motive

Deutsch, Hellmodus als einheitliche Hauptserie, echte Android-App, synthetische Testfamilie. Bildtexte sind redaktionelle Entwürfe. Motive 1–4 haben Vorrang; keine nicht funktionierende Ansicht für ein Versprechen inszenieren.

| Nr. / geplanter Dateiname | Tatsächliche Ansicht und Testzustand | Bildtext | Alternativtext |
| --- | --- | --- | --- |
| 01-tagesuebersicht.png | Start/Tagesübersicht, Baby „Mila Demo“, sichtbare Schlaf-, Milch- und Windeleinträge | Euer Tag auf einen Blick | Tagesübersicht mit gespeicherten Schlafzeiten, Mahlzeiten und Windelwechseln für ein Testbaby. |
| 02-schlaf.png | Schlaf-Tracker mit zwei gespeicherten Schlafphasen und laufendem Timer, keine leere Prognose | Schlafzeiten festhalten | Schlaf-Tracker mit Tagesverlauf und laufendem Schlaf-Timer. |
| 03-mahlzeiten.png | Mahlzeitenverlauf mit Stillen und Fläschchen aus Testdaten | Mahlzeiten im Blick | Verlauf mit dokumentierten Stillmahlzeiten und Fläschchen. |
| 04-planer.png | Planer mit „Testtermin“ und Aufgabe „Kliniktasche prüfen“, keine echten Adressen | Gemeinsam vorausplanen | Familienplaner mit einem Testtermin und einer Aufgabe. |
| 05-schwangerschaft.png | Separates Schwangerschaftskonto, Woche/Termin aus tatsächlich angelegten Daten | Deine Schwangerschaft begleiten | Schwangerschaftsübersicht mit aktuellem Abschnitt und geplantem Geburtstermin. |
| 06-meilensteine.png | Meilensteine mit zwei Demoereignissen; neutrales eigenes Motiv ohne reales Kind | Kleine Momente bewahren | Meilensteinübersicht mit Erinnerungen aus einem fiktiven Babyprofil. |
| 07-familie.png | Erfolgreich verknüpfte erwachsene Testperson, sichtbare Freigabe; kein aktiver QR/Code | Betreuung gemeinsam organisieren | Kontoverknüpfung mit einer weiteren Test-Betreuungsperson. |
| 08-frag-lotti.png | Echte Antwort auf „Welche Schlafzeiten habe ich gestern erfasst?“, passende Testdaten und sichtbarer Hinweis; Premium-Testzugang | Fragen zu deinen Einträgen | Frag Lotti zeigt eine KI-Antwort zu gespeicherten Schlafzeiten und einen Hinweis auf mögliche Fehler. |

Falls Motiv 8 im finalen Backend nicht funktioniert, durch eine funktionierende Einkaufsliste ersetzen und Beschreibung entsprechend abstimmen. Keine KI-Antwort manuell in die UI setzen. Community- und Chatbilder nicht verwenden: Diese Bereiche sind in der aktuellen App entfernt.

## Reproduzierbare Demo-Daten

- R1: Elternteil „Alex Demo“, Baby „Mila Demo“, geboren am 10.03.2026; R3 „Sam Demo“. Keine echten Fotos, Namen, Nachrichten oder Gesundheitsdaten.
- Bezugstag **D = tatsächlicher Aufnahmetag**. Auf D−1: Schlaf 09:00–09:40 und 13:00–14:10; Stillen 08:15–08:30; Flasche 11:00, 120 ml; Windel 10:00. Diese Werte sind Testdaten, keine Empfehlung.
- D: zwei Einträge anlegen; für Motiv 2 Timer real starten und nach Aufnahme wieder stoppen. D+2: „Testtermin“, 10:00, Ort „Testort“, keine Praxisadresse.
- R2: Entbindungstermin D+90 Tage, tatsächliche Appberechnung anzeigen. Diese Daten erst im autorisierten Testkonto anlegen; bisher wurde nichts gespeichert.
- Konto und Rechte, Build/Version, Sprache, Displaygröße, Aufnahmedatum und SHA-256 in `screenshots-manifest.csv` dokumentieren. Vor Screenshotaufnahme Speicherung/Neustart prüfen.

## Exportvorgaben

- Geplante Smartphone-Serie **1080 × 1920, 9:16, RGB-PNG ohne Alpha**, mindestens vier Motive als Ziel, bis zu acht pro Gerätetyp. Google verlangt mindestens zwei Screenshots; allgemeine Grenzen 320–3840 Pixel und lange Seite maximal doppelte kurze Seite. [Google-Assetvorgaben](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
- Vorhandene QA-PNGs sind **1080 × 2400 mit Alpha**: Verhältnis 2,22:1, damit außerhalb der allgemeinen 2:1-Grenze; zusätzlich englisch und mit Debugelementen. **Nicht einfach hochladen.** Am besten neue Aufnahmen in passender Emulator-/Gerätekonfiguration; nichts verzerren oder wichtige UI abschneiden.
- Deutsche UI und reale Appdaten; keine Apple-Statusleisten, Dev-Overlays, Tastatur, Permissiondialoge, fremden Benachrichtigungen oder echten Zugangscodes. Bildtexte knapp halten, UI insbesondere in den ersten drei Bildern dominieren lassen.
- **Store-Icon:** vorhandene Quelle 1024 × 1024 ohne Alpha; finaler Export 512 × 512 als 32-Bit-PNG, höchstens 1024 KB. Noch kein finaler Export vorhanden.
- **Feature Graphic:** Layoutentwurf 1024 × 500, Hintergrund aus der App-Farbwelt, Text „Mehr Überblick im Familienalltag“, ergänzend „Lotti Baby“. Schlichtes eigenes Tages-/Kalendermotiv oder später echte Appansicht; keine Gesundheitswirkung, Preise oder Bewertungen. Export als JPG oder RGB-PNG ohne Alpha. **Finale Grafik offen**, kein erfundener Screenshot.
- Vorschauvideo optional, vorerst keines. Tablets/Chromebook erst mit geprüfter Darstellung und eigenen Aufnahmen; keine Telefonbilder als Tablet-Nachweis. TV/Wear/Automotive/XR sind hier nicht geplant.

## Freigabe pro Bild

Realer finaler Build → richtige Sprache und Testdaten → beworbene Funktion erfolgreich geprüft → keine persönlichen Inhalte/Schlüssel/QRs → keine falschen Gesundheits-/Preisversprechen → Größe/Farbraum/Alpha prüfen → Alttext ≤140 Zeichen → Dateiname/Hash im Manifest → Status erst dann FINAL setzen. QA-Nachweise behalten ihren separaten Status.
