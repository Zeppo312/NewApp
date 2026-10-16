# Storyboard – Lotti Baby App-Vorschau „Motion" (de-DE)

27,5 s · 886 × 1920 · 30 fps. Dramaturgie: **Frage → Aktion → Zusammenhang → Ablauf → Marke**. Jede Szene folgt demselben Muster: Kicker (Bereich) → Überschrift Wort für Wort → betonte Zeile mit Unterstrich → Unterzeile, dann ein grafischer Hinweis genau auf das, was die echte Aufnahme zeigt.

**Bewegungssprache:** Wörter steigen 42 px mit Unschärfe 10 → 0 px auf (0,62 s, `power3.out`, 60 ms versetzt); Ausstieg nach oben (0,3 s, `power2.in`). Markierungen zeichnen sich als Linie (0,7 s, `power2.inOut`) mit weichem Lavendel-Schein. Berührungen: Kontaktpunkt erscheint 0,24 s vor dem echten Tippen, Welle breitet sich im Moment des Tippens aus. Szenenwechsel im Gerät: kurze Abblende über Hell (0,16 s hinein, 0,26 s heraus); das Gerät bleibt ruhig stehen. Hintergrund: Creme → Lavendel mit drei langsam driftenden Lichtflächen.

| Zeit (s) | Szene | Aufnahme (Quelle, Zeit in der Aufnahme) | Text | Animation / Hinweis |
| --- | --- | --- | --- | --- |
| 0,0 – 4,4 | **1 Mahlzeiten** | `v1-mahlzeiten` 1,0–5,4 (statisch) | Kicker „Mahlzeiten" · **Wann war das / letzte Fläschchen?** · „Zuletzt um **11:40 Uhr** – ein Blick genügt." | Bild 1 zeigt sofort die App; Gerät schwingt 1,1 s ein. Frage ab 0,12 s, Unterstrich unter „letzte Fläschchen?". 1,25 s: Markierung um die Karte „Fläschchen · 2× · Zuletzt um 11:40 Uhr", 1,55 s Antwortzeile. |
| 4,4 | Übergang | – | Text steigt aus | Abblende über Hell (Spitze 4,4 s). |
| 4,4 – 8,3 | **2 Wickeln** | `v2-eintrag` 4,4–6,2 (Formular, „Nass" gewählt) · 6,95–8,75 (Ladeanzeige → „Wickeln gespeichert") · 10,45–… (Bestätigung → App blendet zu „Unser Tag") | Kicker „Wickeln" · **Gewickelt? / Schnell festgehalten.** · „Mit wenigen **Fingertipps** gespeichert." | 5,8 s: Berührungs-Hotspot auf „Speichern" (echtes Tippen zwischen Aufnahme 5,65 und 5,96 s). 6,54 s: echte Bestätigung der App. Entfernt: 0,7 s Ladewarten und 1,7 s Standbild der Bestätigung. |
| 8,3 – 12,85 | **3 Unser Tag** | `v2-eintrag` bis 13,05 (Tagesübersicht oben) · `v3-gemeinsam` 44,4–47,1 (gescrollt: Kennzahlen + Timeline) | Kicker „Unser Tag" · **Euer Tag. / Auf einen Blick.** · „Der neue Eintrag – in der **Timeline**." | 8,95 s: Markierung um Kennzahl „Wickeln 4 · Letzter: 23:00". 10,2 s: Abblende statt ruckeliger Scrollaufnahme. 10,35 s: Markierung zeichnet sich um den Timeline-Eintrag „Nass · Start 23:00" (der in Szene 2 gespeicherte Eintrag). |
| 12,85 | Übergang | – | – | Abblende über Hell. |
| 12,85 – 23,2 | **4 Schlaf** | `v4-schlaf-raw` 6,15–7,85 (Ausgangszustand 23:04) · 7,85–8,45 („Starte …") · 10,9–14,2 („Nachtschlaf läuft" → Timer 0:04–0:06) · 25,95–26,85 (Timer 0:18) · 27,1–27,9 (Dialog) · 31,5–… (Auswahl → beendet, 23:05) | Kicker „Schlaf" · **Schlafphasen / einfach festhalten.** · Schritte **Starten — Läuft — Beendet** | 14,15 s Hotspot „Schlaf starten" → Schritt „Starten" aktiv. 16,65 s Timer sichtbar → „Läuft" aktiv, Markierung um den Timer. 18,05 s Abblende = Zeitsprung im laufenden Timer. 18,72 s Hotspot „Nachtschlaf beenden" → Dialog „Schlafqualität". 22,16 s beendete Ansicht → „Beendet" aktiv. Entfernt: Banner-Wartezeit 8,45–10,9 s, Timer-Laufzeit 14,2–25,95 s, Dialog-Standbild 27,9–31,5 s. |
| 23,2 – 27,5 | **5 Marke** | `v4-schlaf-raw` weiter bis 39,25 (beendete Schlaf-Ansicht bleibt sichtbar) | App-Icon · **Lotti Baby** · „Euer Babyalltag an einem Ort." · Hinweis **Anmeldung erforderlich. / Funktionen je nach Abo.** | Gerät gleitet auf 74 % nach unten (1,0 s), Icon federt ein (`back.out`), Name mit Unschärfe-Einstieg, Hinweis ab 24,1 s für 3,4 s gut lesbar (36 px, zweizeilig). |

## Ton

Eigene, in diesem Projekt synthetisierte Musik (`werkzeuge/musik-erzeugen.mjs`): ruhige Flächen und weiche Mallet-Töne in F-Dur, ≈ 82 bpm, Takt 8 fällt auf den Markenabschluss. Leise „Tock"-Geräusche genau auf den drei gezeigten Berührungen, zwei helle Töne bei „Wickeln gespeichert" und beim beendeten Schlaf. Integrierte Lautheit −19,4 LUFS, Spitze −6,2 dBFS. Der Film ist ohne Ton vollständig verständlich.

## Nur für ein freieres Marketingvideo (nicht im Store-Export)

- Hereinzoomen auf Kennzahlen oder Timer (Apple: native UI-Auflösung statt Zoom).
- Hochzählende Zahlen oder nachgebaute Karten außerhalb des Geräts.
- Geteilter Bildschirm mit mehreren Aufnahmen gleichzeitig, schnelle Peitschen-/Wischübergänge.
