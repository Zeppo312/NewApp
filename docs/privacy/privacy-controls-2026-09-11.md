# Datenschutz-Korrekturen vom 11. September 2026

## Bereits produktiv: tägliche Fürsorge stillgelegt

Die veröffentlichte Funktion `advisor-daily` enthielt die Verarbeitung für tägliche Serverläufe. Eine Abfrage von `cron.job` fand zum Prüfzeitpunkt keinen passenden Zeitplan; ein tatsächlich aktiver automatischer täglicher Lauf war damit nicht belegt. Externe Zeitgeber lassen sich daraus nicht ausschließen.

Am 11. September 2026 wurde ausschließlich `advisor-daily` im Projekt `kwniiyayhzgjfqjsjcfu` durch einen wirkungslosen Endpunkt ersetzt. Dieser greift weder auf Nutzerdaten noch auf OpenAI, Wetterdienste oder Push-Zustellung zu. Ein produktiver POST mit `{"force":true}` lieferte `{"disabled":true,"processed":0,"reason":"foreground_only"}`. Sicherung der zuvor veröffentlichten Funktion: `output/privacy-controls-20260911/backend-before/`.

Die Migration `20260911083129_disable_advisor_daily_schedule.sql` deaktiviert ausschließlich passende Cron-Einträge, falls vorhanden. Sie ist für zukünftige Datenbank-Bereitstellungen vorbereitet und wurde nicht pauschal mit den anderen offenen Migrationen auf Produktion angewendet. Der bereits veröffentlichte Endpunkt verhindert auch unabhängig davon die Verarbeitung durch alte/externe Aufrufe.

## Lokaler App-Code: mit dem nächsten App-Update wirksam

- Sentry: Replay-Integration entfernt, beide Aufzeichnungsraten null. Fehlerdiagnose und freiwilliges Feedback bleiben aktiv. Kein App-Build oder OTA-Update wurde hier veröffentlicht; ältere Installationen können weiter aufzeichnen. Bestehende Aufzeichnungen wurden nicht gelöscht.
- Fürsorge: Neue KI-Anfragen nur bei aktiver App; laufende Client-Anfragen werden beim Wechsel in den Hintergrund abgebrochen und verspätete Ergebnisse verworfen. Daten, die der Server/OpenAI bereits erhalten hat, können dort noch fertig verarbeitet werden. Die Bildschirm-Logik verwirft auch überholte Ladevorgänge.
- Einstellungen: automatische tägliche Fürsorge-Mitteilungen und deren Frequenzauswahl entfernt. Keine neuen Standort-/Zeitzonen-Uploads zur Vorbereitung des täglichen Jobs. Das Speichern der Einstellungen setzt dessen Push-Flag auf false. Vom Nutzer selbst gesetzte lokale Erinnerungen sind davon unabhängig.
- App-Datenschutz: de/en/es an diese neue Fassung angepasst und HTML-Dateien synchronisiert. Die live veröffentlichte Datenschutzerklärung unterscheidet sich bewusst bei Sentry, solange ältere App-Versionen noch betroffen sind.

## Store-Texte und Website

Die vorbereitete deutsche Play-Store-Beschreibung enthält keine Community-/Chat-Werbung mehr. Screenshot-Vorgaben und Play-Console-Entwürfe wurden entsprechend angepasst; private Familienfreigaben bleiben in der Bewertung berücksichtigt. Keine Play-Console-Angaben wurden eingereicht.

Die sechs Website-Dateien wurden am 11. September 2026 über den angemeldeten Hostinger-Webeditor gezielt bearbeitet und veröffentlicht. Website-Bearbeitung und abschließende Live-Nachweise liegen im Verzeichnis `output/privacy-controls-20260911/website/` aufbewahrt. Die Änderungen betreffen `app.php`, `default.php`, die drei Sprachdateien und den Hinweis zur abgeschalteten täglichen Verarbeitung in `datenschutz.php`. Community-Bilder selbst werden nicht gelöscht; sie werden nicht mehr in der App-Werbung eingebunden. Die gesonderte Social-Media-Seite beschreibt weiterhin die tatsächlichen Instagram-/TikTok-Kanäle.

## Verifikation und offene Grenzen

- 3 Jest-Suites, 40 Tests erfolgreich, einschließlich Hintergrund-Sperre, Abbruch, verspäteter Antwort, Listener-Aufräumen und erzwungenem Aufruf des stillgelegten Endpunkts.
- App-TypeScript (`npx tsc --noEmit`) und Datenschutz-Synchronitätsprüfung erfolgreich.
- Zusätzliche Test-TypeScript-Prüfung (`tsconfig.tests.json`) scheitert in unveränderten Testdateien: `account-linking-qr-modal.test.tsx:50` und `shopping.test.ts:293,317,329,580,589` mit nicht passenden Argumentzahlen. Diese Dateien wurden hier nicht bearbeitet.
- PHP-Syntax der sechs vorbereiteten Webseiten-Dateien erfolgreich geprüft. Die beabsichtigten Änderungen sind als `website/changes.patch` gesichert.
- Alle neun öffentlichen Kombinationen aus `/`, `/app`, `/datenschutz` und `?lang=de|en|es` am 11. September 2026 um 10:55 Uhr Europe/Berlin erfolgreich geprüft (HTTP 200, keine PHP-Fehler, keine Community-Screenshots; neue App-Texte und Fürsorge-Hinweise vorhanden; Löschanker, Kontakt und Anbieterangaben erhalten). Nachweise: `output/privacy-controls-20260911/website/live-checks.json`.
- Keine Emulator-/Geräteprüfung oder Store-Auslieferung dieser Änderungen erfolgt.

**Nachtrag:** Auf Wunsch des Nutzers ist aktuell ausschließlich eine unverbindliche UI-Vorschau der Einwilligungsdialoge enthalten. Die anschließend entwickelte technische Durchsetzung wurde wieder entfernt; siehe [aktueller Stand](explicit-consent-2026-09-11.md). Die erforderliche wirksame Einwilligung und die übrigen produktiven Lösch-/Meldeabläufe sowie abschließenden Play-Nachweise bleiben offen.
