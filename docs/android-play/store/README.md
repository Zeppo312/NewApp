# Schritt 6 · Store-Paket und Tester-Vorbereitung

Stand: **10.09.2026 · prüfbarer Entwurf, nicht eingereicht**. Grundlage sind der aktuelle lokale Arbeitsbaum, [Schritt 1](../step-01.md), die Produktmatrix und [Schritt 5](../step-05.md). Schritt 5 ist ausdrücklich nur teilweise abgeschlossen. Dieses Paket kann schon geprüft werden; finale Android-Aufnahmen und Betriebsnachweise folgen.

| Unterlage | Inhalt |
| --- | --- |
| [Store-Texte](store-texte-de.md) | Deutsche Texte, Funktionsbelege und Grenzen; kopierbare Texte in `listing/de-DE/` |
| [Screenshot-Plan](screenshots.md) | Acht konkrete Motive, Bildtexte, Aufnahmedaten und Exportvorgaben |
| [Materialübersicht](material/index.html) | Lokale Vorschau der unveränderten QA-Bilder aus Schritt 5 und des vorhandenen Icons; keine fertigen Store-Assets |
| [Dateninventar](dateninventar.md) | Tatsächliche Speicherung, Empfänger, KI, SDKs, Shop und Quellen |
| [Datensicherheitsentwurf](datensicherheit.md) | Antworten pro Play-Datentyp, Zwecke, Pflicht/optional und noch ungeklärte Weitergaben |
| [Berechtigungen](berechtigungen.md) | Quellmanifest und lokales Debug-Merge; Nachprüfung des finalen AAB |
| [Support und Löschen](support-und-loeschung.md) | Kontaktfelder, Webseitenentwürfe, bestehende Löschwege und deren Grenzen |
| [Reviewer-Zugang](reviewer-zugang.md) | Kontoplan, Zugang ohne Zahlung und englischer App-Access-Entwurf |
| [Play-Console-Angaben](play-console.md) | Zielgruppe, Gesundheit, Werbung, Altersfreigabe und übrige Erklärungen |
| [Tester-Leitfaden](tester-leitfaden.md) | Kurze konkrete Testaufgaben; Start der offiziellen Testdauer |
| [Feedbackvorlage](tester-feedback.md) | Kopierbare Fehlermeldung und Abschlussfeedback |
| [Einladungstexte](tester-einladung.md) | Vorab-Rekrutierung und spätere Einladung zum Play-Test; nicht versendet |
| [Offene Angaben](offene-angaben.md) | Was der Nutzer liefern oder entscheiden muss; technische Nachweise separat |
| [Quellen und Prüfung](quellen-und-pruefung.md) | Offizielle Quellen, Prüfgrenzen und Dateinachweise |

**Statusbegriffe:** BELEGT = im genannten Code/Artefakt vorhanden; ENTWURF = vorgeschlagener Text oder Auswahl; OFFEN-NUTZER = Angabe/Entscheidung fehlt; OFFEN-TECHNIK = Laufzeit-, Konfigurations- oder Releaseprüfung fehlt. Codebelege sind kein Nachweis des derzeit deployten Backends.

Die App nutzt Supabase und weitere Dienste. Weder „ausschließlich lokale Speicherung“ noch pauschale Aussagen zu vollständiger Löschung, Werbefreiheit, medizinischer Zulassung oder rechtlicher Konformität werden als Tatsache übernommen. Keine Store-Formulare ausgefüllt oder abgesendet, keine Konten angelegt, keine Tester eingeladen und keine Produktionsdaten geändert.

**Zuerst prüfen:** [offene-angaben.md](offene-angaben.md). Rekrutierung von mindestens zwölf geeigneten Testpersonen kann schon beginnen. Die qualifizierende Play-Testdauer beginnt dadurch noch nicht.
