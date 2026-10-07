# Lotti Baby · kurzer Android-Tester-Leitfaden

**Vorbereitung:** Android-Gerät, Google-Konto für die spätere Play-Teilnahme und ein freigegebenes Lotti-Testkonto. Verwende ausschließlich erfundene Familien- und Gesundheitsdaten. Testzugang, Downloadlink und Feedbackkanal folgen vom Organisator; derzeit ist kein offizieller Test gestartet.

**Erster Durchlauf: etwa 20–30 Minuten.** Notiere App-Version, Gerätemodell und Android-Version. Markiere nicht verfügbare Aufgaben als „blockiert“, statt erfolgreiche Tests zu vermuten.

| Aufgabe | So testest du | Was sollte passieren? |
| --- | --- | --- |
| 1. Start und Anmeldung | Installieren, starten, mit Testkonto anmelden; App schließen und erneut öffnen | Kein Absturz; Zugang bleibt dem richtigen Konto zugeordnet |
| 2. Einrichtung | Nur mit freigegebener neuer Testadresse: Registrierung, Zustimmung, Baby-/Schwangerschaftsdaten; bei Tastatur und Datum Zurück drücken | Daten bleiben beim Zurückgehen erhalten; kein unerwarteter Startbildschirm |
| 3. Alltag | Stillen, Flasche mit 120 ml und Windelwechsel anlegen; einen Eintrag ändern und einen löschen | Zeiten/Mengen stimmen, Änderungen bleiben nach Neustart bestehen |
| 4. Schlaf | Timer starten, App zwei Minuten in Hintergrund legen, zurückkehren und stoppen; gespeicherte Zeit korrigieren | Keine doppelte Phase, plausible Dauer; Datum/Uhrzeit korrekt |
| 5. Netz und Kontowechsel | Netz kurz ausschalten, einen Testeintrag versuchen; wieder verbinden. Abmelden und anderes Testkonto öffnen | Verständliche Rückmeldung; kein falscher Speichererfolg, keine Duplikate oder Daten einer fremden Testfamilie |
| 6. Gemeinsam | Nur mit zugeteilter Testperson verknüpfen; Eintrag ändern; Freigabe wieder aufheben | Berechtigte Person sieht Änderung; nach Entzug kein weiterer Zugriff auf geschützte Daten |
| 7. Berechtigungen | Kamera, Mikrofon, Fotos, Standort, Kalender und Benachrichtigungen je Funktion zunächst ablehnen, später gezielt erlauben | Kein Absturz; verständlicher Hinweis/Alternative; nur gewollte Aufnahme/Übertragung |
| 8. Alltagshilfen | Testtermin und Einkaufsartikel anlegen; lokale Erinnerung wenige Minuten später prüfen, sofern einstellbar | Anzeige und Zustellung nachvollziehbar; bei Ausbleiben Zeitpunkt/Batteriesparmodus notieren |
| 9. KI | „Welche Schlafzeiten habe ich gestern erfasst?“ fragen; Antwort mit deinen Einträgen vergleichen. Optional kurzen Testeintrag sprechen und Vorschlag vor Speicherung prüfen | Keine erfundenen persönlichen Werte, keine ungefragte Speicherung; medizinische Fragen nicht als Diagnose beantworten |
| 10. Bedienbarkeit | Dunkelmodus, große Systemschrift, Tastatur und Android-Zurück ausprobieren | Texte/Buttons bleiben erreichbar, nichts Wesentliches verdeckt |
| 11. Hilfe und Datenschutz | Support öffnen, vorbereitete Mail nur ansehen und verwerfen; Datenschutz öffnen | Erreichbare Infos; Mail zeigt, welche Angaben ergänzt wurden |
| 12. Löschung, gesonderter Test | Nur das ausdrücklich dafür zugeteilte Wegwerfkonto löschen | Erfolg oder klarer Fehler; nach Erfolg kein erneuter Zugang. Organisator prüft Server-/Medienreste separat |

Community nur in freigegebener Testgruppe testen: Testbeitrag/Nachricht, Melden/Blockieren und Aufräumen. Keine fremden Nutzer anschreiben. Schwangerschaftskonto: Countdown, Test-Arztfrage und Checkliste bearbeiten.

**Käufe:** Für normale Funktionstests ist kein Kauf erforderlich. Kauf/Restore nur nach gesonderter Zuteilung als Play-Lizenztester; wenn der Kaufdialog keinen erkennbaren Testkauf ausweist, abbrechen. Fehlende Preise/gesperrte Kaufbuttons als Befund melden. Keine Shopbestellungen, echten Abbuchungen oder öffentlichen Bewertungen verlangen.

**Über mehrere Tage:** Wiederholt kurze Alltagseinträge anlegen, Timer/Erinnerungen prüfen und nach einem Update frühere Fehler erneut testen. Einmal zur Mitte und am Ende [Feedback](tester-feedback.md) geben. Ernsthafte Datenverlust-/Zugriffsprobleme sofort über den vereinbarten Kanal melden; bei Daten anderer Familien keine weiteren Daten öffnen.

## Für den Organisator: Rekrutierung und offizieller Zeitraum

Mindestens **zwölf geeignete erwachsene Tester** können schon gesucht werden; etwa 15–20 Interessierte schaffen freiwillige Reserve. Verschiedene Geräte, Android-Versionen, kleine Displays und große Schrift sowie mindestens zwei Testpaare sind hilfreich. Teilnahme darf ehrlich kritisch sein und setzt keine positive Bewertung voraus.

Für persönliche Entwicklerkonten, die nach dem 13.11.2023 erstellt wurden, nennt Google einen **geschlossenen Test mit mindestens zwölf Testern, die mindestens 14 Tage ununterbrochen angemeldet teilnehmen**. Kontotyp/Anlagedatum und konkrete Console-Anforderung bestätigen. Eine Kontaktliste, Einladung, Emulatorprüfung, APK-Installation oder ein interner Test startet/ersetzt diese Frist nicht. Qualifizierend ist der entsprechende geschlossene Play-Test mit Opt-in; bei Aus-/Wiedereintritt zählt die geforderte kontinuierliche Teilnahme neu. [Google-Testanforderungen](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Erst mit vorhandenem Track Teilnehmerliste/Google-Gruppe, Opt-in-Link und Store-Link bereitstellen. Testende frühestens aus den tatsächlichen ununterbrochenen Opt-ins der benötigten zwölf Personen ableiten; Console-Status ist maßgeblich. Reale Nutzung und Feedback mit dem leeren [Teilnahmeprotokoll](tester-teilnahme.csv) dokumentieren. Kontaktadressen separat und zugriffsbeschränkt aufbewahren, im Repository nur Tester-Kürzel.

Für den späteren Produktionsantrag vorbereiten: tatsächliche Rekrutierungswege, aktive Funktionen, Beteiligung, Feedback, gefundene Fehler, vorgenommene Verbesserungen und erneute Prüfungen. Nicht vorab behaupten, dass Tests oder 14 Tage absolviert wurden. Das Erreichen der Mindestzeit allein garantiert keine Produktionsfreigabe.
