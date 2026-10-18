# Lotti Baby: erster Funktionstest des neuen QA-Stands

Dieser Leitfaden gilt für iPhone App 1.0.24 / Build 1.0.78 aus der bestehenden TestFlight-Gruppe und Android App 1.0.23 / Versionscode 22 aus dem bestehenden internen Play-Test. Beide Builds sind dort als verfügbar bestätigt. Der Status und die Nachweise stehen in [App-Teststand](app-tester-readiness-20261002.md). Installation und erster Gerätetest sind noch offen.

Vor dem Test die konkrete Buildnummer am Gerät bestätigen; ältere installierte Builds gelten nicht als Nachweis für diesen Stand. Der interne Android-Test beginnt noch nicht die vorgeschriebene Frist des geschlossenen Google-Tests.

Nur freigegebene Testkonten und erfundene Gesundheitsdaten verwenden. Die vorhandenen Testfamilien bleiben erhalten. Käufe ausschließlich mit separat zugeteilten Store-Sandbox-/Lizenzkonten; bei einem echten Zahlungsdialog abbrechen. Keine neue Kontolöschung ausführen: die abgeschlossenen Löschtests bleiben eigene Nachweise.

| Schritt | Durchführung | Erwartung |
| --- | --- | --- |
| 1 | Mit bestehendem Testkonto anmelden, App beenden und erneut öffnen | Richtige Identität; verständlicher Lade-/Fehlerzustand; keine fremden Daten |
| 2 | Ohne Gesundheitsfreigabe Support, Datenschutz und Aboverwaltung öffnen | Diese Bereiche bleiben nutzbar; Gesundheitsdaten und KI bleiben gesperrt |
| 3 | Die zwei Einwilligungsdialoge prüfen; KI ablehnen | Keine Vorauswahl. Mit ausdrücklicher Gesundheitsfreigabe bleiben manuelle Funktionen nutzbar, KI und Sprachaufnahme bleiben aus |
| 4 | Freigegebenen Testeintrag anlegen, bearbeiten und nach Neustart prüfen | Korrekte Zeit/Menge, keine Duplikate oder falsche Erfolgsmeldung |
| 5 | Netz ausschalten, Widerruf testen, ab-/anmelden und wieder verbinden | Sofortige Sperre auf dem Gerät; Widerruf wird nach Verbindung übertragen; ein alter Retry stellt keine Zustimmung wieder her |
| 6 | Entscheidung auf zweitem Gerät ändern und zur App zurückkehren | Aktueller Serverstand wird übernommen; Verarbeitung öffnet erst nach bestätigter ausdrücklicher Zustimmung |
| 7 | Mit zugeteiltem Familien-Testpartner Zugriff und Quellenwiderruf prüfen | Kein Zugriff über einen Partner, nachdem die Quelle ihre Gesundheitsfreigabe widerrufen hat |
| 8 | KI nach bewusster Freigabe nutzen, während einer Anfrage widerrufen | Keine weitere Verarbeitung nach den serverseitigen Prüfungen; Sprachaufnahme startet nach einer Zustimmung erst bei erneutem bewussten Aufruf |
| 9 | Timer und Erinnerung mit Hintergrund-/Offline-Rückkehr prüfen | Nachvollziehbarer Zustand, keine doppelte Speicherung; bei Fehlern bleiben eigene Daten dem richtigen Konto zugeordnet |
| 10 | Separat zugeteilten Kauf-/Restore-Test durchführen | Richtiges Konto und richtiger Tarif; Familienzugang nachvollziehbar; kein dauerhafter Zugriff nach Berechtigungsentzug |

Für jeden Befund festhalten: Plattform, Gerät/OS, App-Version und Buildnummer, Testkonto-Kürzel, Schritte, erwartetes/tatsächliches Ergebnis sowie Zeitpunkt. Keine Passwörter, Tokens oder echten Gesundheitsdaten in Rückmeldungen. Erfolgreich, fehlgeschlagen und blockiert getrennt erfassen.

Datenverlust, fremde Familiendaten, Consent-Umgehung, unbrauchbare Anmeldung und falscher Kauf-/Abozugang blockieren die Freigabe. Optische Unebenheiten können nach der Funktionsabnahme bearbeitet werden. Nach dem kleinen Funktionstest folgt die breitere mehrtägige Testrunde mit vorhandenen Tester-Leitfäden; Einladungen und offizielle Testzeiträume werden separat organisiert.
