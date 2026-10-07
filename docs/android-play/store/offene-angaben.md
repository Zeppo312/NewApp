# Noch benötigte Angaben und Nachweise

Das Store-Paket ist als Entwurf prüfbar. **OFFEN bedeutet nicht, dass bereits eine falsche Antwort in der Console steht.** Es wurde nichts eingereicht. Angaben können gesammelt beantwortet werden; für die Sichtung dieser Unterlagen braucht es noch keinen freigeschalteten Play-Zugang.

## Vom Nutzer / Betreiber zu liefern oder zu entscheiden

| ID | Verständliche Frage / benötigte Angabe | Betroffene Unterlage |
| --- | --- | --- |
| U01 | Betreiberangaben aus dem Impressum und ggf. Händlerstatus bestätigen. Live geprüft: persönliches Konto „Lotti Baby“, erstellt 10.09.2026; Identität am 11.09.2026 bestätigt; Telefonbestätigung freigeschaltet, SMS-Code angefordert und Eingabe offen; App-Anlage noch gesperrt. Kontotypzulässigkeit für Gesundheitsfunktionen ungeklärt; Kontaktpostfach auf Supportantwort prüfen. [Schritt 7](../step-07.md) | Console, Datenschutz, Testerfrist |
| U02 | Ist `support@lottibaby.de` betreut? Wer antwortet, in welchen Sprachen, und welche Antwortzeit ist realistisch? Öffentliche Telefonnummer nur falls gewünscht/erforderlich liefern | Support |
| U03 | Soll sich die App ausschließlich an Erwachsene richten, oder bewusst auch an minderjährige Eltern? Vorschlag: Erwachsene, Kategorie Eltern, Standardsprache Deutsch | Zielgruppe/Store |
| U04 | In welchen Ländern soll getestet und später veröffentlicht werden? Kostenloser Download mit Abo-Zugang bestätigen; Google-Preise, Laufzeiten und Angebote liefern, sobald festgelegt | Store/Produkte; keine Werte geraten |
| U05 | Geeignete Demo-Konten R1–R4 bzw. freigegebene Testadressen bereitstellen; sichere Übergabe der Passwörter und zuständige Person für Erreichbarkeit festlegen | Reviewer, Schritt 5 |
| U06 | Wer stellt die öffentliche Löschseite bereit und bearbeitet Anfragen? Bestätigte Bearbeitungs-, Lösch- und Aufbewahrungsfristen je Kategorie liefern | Löschseite/Datensicherheit |
| U07 | Welche Regionen, Verträge/Empfängerrollen und Aufbewahrungsfristen gelten tatsächlich für Supabase, Sentry, OpenAI, Expo/FCM, RevenueCat, Wetter, E-Mail/Resend und Shop/Checkout? Welche Dashboardintegrationen sind aktiv? | Dateninventar/Datenschutz |
| U08 | Gibt es Anzeigen, Affiliate-/bezahlte Empfehlungen oder externe Werbe-/Analysedienste in App, Inhaltsverwaltung oder Shop? Nicht mit Abo-Käufen gleichsetzen | Werbeangabe/Datensicherheit |
| U09 | Gesundheitliche Zweckbestimmung und vorhandene fachliche/regulatorische Bewertung oder Nachweise nennen. Es wird keine medizinische/rechtliche Zulassung angenommen | Gesundheitsformular und erforderliche Hinweistexte |
| U10 | Wer koordiniert Tester und über welchen privaten Kanal laufen Zugangsdaten/Feedback? Mindestens zwölf geeignete Interessierte suchen; keine Kontaktdaten öffentlich ins Repo schreiben | Tester-Unterlagen |
| U11 | App-Name und Texte prüfen; Rechte am vorhandenen Icon und an späteren Bildern bestätigen. Tablet-/Chromebook-Verfügbarkeit entscheiden | Store-Assets |

## Technisch zu belegen, nicht durch eine Schätzung zu ersetzen

| ID | Nachweis / Folgeschritt | Erledigt, wenn |
| --- | --- | --- |
| T01 | Schritt 5 abschließen | Anmeldung, Kerntracking, Partner-/Schwangerschaftspfade, Berechtigungen und Neustart mit Testkonten geprüft; finale deutsche Screenshots aufgenommen |
| T02 | Finales signiertes Play-AAB prüfen | Version/Hash, echte Manifestrechte/SDKs/Netzwerkziele dokumentiert; Debug-/unnötige Rechte beurteilt, FGS-Nutzung belegt oder separat entfernt |
| T03 | Daten-/Kontolöschung vollständig testen | Datenbank, Auth/Sitzung, Medienobjekte, Familienfreigaben, lokale Caches und Dienstleisterwege geprüft; Backup-/Restfristen dokumentiert |
| T04 | Datenschutzhinweise vervollständigen | Website und In-App-Texte erklären tatsächlich Backend, KI, Standort, Replay, Push, Kauf/Shop und Löschung; lokale-Speicherungsbehauptung korrigiert |
| T05 | Empfänger-/SDK-Prüfung | Sentry-Events/Maskierung/IDs, OpenAI-Anbieterfristen, RC-Integrationen, Resend-/Push-Konfiguration und externe Inhalte abgeglichen |
| T06 | Shop im Android-WebView prüfen | Formularfelder, Cookies/IDs, Analytics, Checkout/Zahlungsanbieter und Browserübergänge ohne echte Bestellung erfasst; Datentypen ergänzt |
| T07 | Premium-/Reviewer-Zugang | R1/R2 können auch serverseitige KI ohne Zahlung nutzen; kein OTP-/Ablaufhindernis; R3 sieht ausschließlich Testfreigaben |
| T08 | Store-Abos und Benachrichtigungen | Google-Angebote/RC-Zuordnung/Backend und echter Lizenztest aus späteren Schritten abgeschlossen; FCM und Zustellung geprüft |
| T09 | Gesundheits-/Inhaltsprüfung | Vollständiger Gesundheitshinweis aus dem Store-Text übernommen; [Gesundheitsfunktionen](play-console.md#gesundheitsfunktionen) mit dem Release abgeglichen und in der Console gespeichert. Erreichbare Tracker, Vitamin D, Selfcare einschließlich möglichem Rückbildungszweck, Arztorganisation, KI, Zyklus/Wehen und UGC/Medien gegen tatsächliche Console-Fragen geprüft; keine erfundene IARC-Stufe |
| T10 | Play-Test tatsächlich einrichten | Kontovoraussetzungen erfüllt, Track verfügbar, reale Opt-ins und Beteiligung dokumentiert; noch kein Startdatum gesetzt |
| T11 | KI-Meldeweg — erledigt durch manuelle Betreiberabnahme am 01.10.2026 | Betreiber bestätigt den getesteten KI-Melde-/Moderationsfluss als abgeschlossen; Backend-Fix vom 11.09.2026 bereits technisch geprüft. [Abnahme und Nachweisgrenzen](../../ask-lotti-reporting.md#abnahme-vom-1-oktober-2026) |
| T12 | Kontotyp für öffentliche Veröffentlichung klären | Schriftliche Google-Antwort für den tatsächlichen Gesundheitsfunktionsumfang ausgewertet und erforderlicher Kontotyp umgesetzt; Kontoerstellung/App-Anlage allein genügt nicht. [Status/Entwurf/Umstellungsweg](../step-07.md) |

**Für dieses Paket bereits erledigt:** Texte und Vorlagen vorhanden, Codebelege dokumentiert, QA-Material unverändert übernommen, offene Antworten markiert. **Nicht erledigt:** Einreichung, Veröffentlichung, Kontoanlage, echte Kauf-/Lösch-/Checkouttests und Einladungsversand. Diese Tätigkeiten wurden hier nicht ausgeführt.
