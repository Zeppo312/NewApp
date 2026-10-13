# Detaillierteres Befinden-Tagebuch

Stand: 05.10.2026, 09:44 MESZ. Umgesetzt, geprüft und als [EAS Update da1b84aa-7470-4fea-8f08-605291312bae](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/da1b84aa-7470-4fea-8f08-605291312bae) für iOS und Android auf `release-candidate-20261003` veröffentlicht. Runtime `1.0.25`, EAS-Umgebung `production`.

## Oberfläche

Die Seite „Wie fühlst du dich?“ hat einen bebilderten Einstieg, Rückmeldungen zur gewählten Stimmung und getrennte Bereiche für Magen/Verdauung, Körper/Entlastung und Ruhe/Gefühle. Rosé, Mint, Pfirsich, Lavendel und Blau kennzeichnen die Bereiche; die Farben haben eigene Dunkelmodus-Varianten. Alle zwölf vorhandenen Symptome bleiben auswählbar. Die Stärke bleibt pro Symptom einstellbar; eine Erklärung beschreibt die Skala als subjektives Empfinden.

Notizen bekommen ausführlichere Anregungen und einen Zeichenzähler. Ein Kalender für die letzten sieben Tage zeigt gespeicherte Stimmungen, fehlende Einträge und mehrfach dokumentierte Symptome. Die Historie zeigt zusätzlich Stimmung, Beschwerden mit Stärke und eine Notizvorschau. Die Zusammenfassung zählt ausschließlich gespeicherte Einträge; Lücken werden nicht als beschwerdefreie Tage gewertet.

Die vorhandene lokale Speicherung, Identitäts-/Einwilligungsprüfung, Löschung und Behandlung ungespeicherter Entwürfe bleiben erhalten. Es gibt keine neuen gespeicherten Felder, Tabellen oder Synchronisation.

## SSW und Artikel

- Der Entbindungstermin kommt aus derselben vorhandenen Datenquelle wie auf der Schwangerschafts-Home. Der neue Hook verwendet deren Cache und aktualisiert beim erneuten Öffnen/Fokussieren der Seite. Eine fehlgeschlagene Aktualisierung erhält den zuletzt geladenen Termin mit einem Hinweis; ein erster Ladefehler erzeugt keine erfundene Woche.
- Die SSW wird für den ausgewählten Kalendertag berechnet. 24+0 ist die 25. SSW; der Vortag gehört zur 24. SSW. Ein geänderter Termin verändert die Einordnung, ohne den Tagebuchentwurf neu zu laden.
- Pro SSW erscheinen die beiden vorhandenen, redaktionell zugeordneten Wochenartikel. Beschwerden und niedrige Stimmung ergänzen die Themen. Doppelte Artikel werden nur einmal angezeigt. Die allgemeinen Beschwerdeartikel bleiben bei ausgewählten Beschwerden in jeder Woche erreichbar.
- Artikel aus Tagebuch, Wochenübersicht, Wochenartikel und Stories erhalten den SSW-Kontext. Die Detailansicht zeigt dazu Körperinformationen und den Link zum Wochenbegleiter. Weiterführende Empfehlungen verwenden dann dieselbe Woche; die Quellenliste enthält auch die Wochenquellen.
- Ohne Termin oder außerhalb der Abdeckung von SSW 1–42 wird keine Wochenempfehlung behauptet. Das Tagebuch sowie allgemein passende Beschwerdethemen bleiben nutzbar. „Alle Themen“ öffnet weiterhin das vollständige Wissensarchiv.

Die medizinischen Texte stammen aus der vorhandenen Bibliothek; ihr redaktioneller Entwurfsstatus wird durch diese Änderung nicht zur fachlichen Freigabe. Die bestehenden Quellen zu [SSW 25–28](https://www.familienplanung.de/schwangerschaft/schwangerschaftswochen/25-bis-28-schwangerschaftswoche/), [Warnzeichen](https://www.nhs.uk/pregnancy/common-symptoms/pregnancy-symptoms-you-need-to-get-help-for/) und [Übelkeit](https://www.nhs.uk/pregnancy/common-symptoms/vomiting-and-morning-sickness/) wurden am 05.10.2026 erneut aufgerufen. Medizinische Hinweise bleiben unabhängig von der Empfehlungsreihenfolge verfügbar.

## Nachweise

Unter `output/pregnancy-feeling-detail-20261005/`:

- `tests.log`: 66 Tests in sieben Suites erfolgreich. Abgedeckt sind alle 42 Wochenzuordnungen, historische Tages-/Wochengrenzen, Datumsgrenzen, doppelte Empfehlungen, der Sieben-Tage-Rückblick, Termin-Ladefehler und Retry, verspätete Antworten nach Kontowechsel/Einwilligungswiderruf, Speichern und Retry, Entwurfserhalt sowie bestehende Story-Navigation.
- `typecheck-app.log`, `typecheck-tests.log`: beide Typechecks erfolgreich.
- `lint.log`: gezielte Prüfung aller geänderten Anwendungsdateien und Tests ohne Fehler oder Warnungen.
- `browser-build.log`: aktuelle React-Native-Komponenten erfolgreich für die lokale Browser-Prüfoberfläche gebündelt.
- `feeling-390.png`, `feeling-colors-390.png`, `dark-320-large-font.png`: visuelle Prüfung bei 390 px sowie 320 px mit 160 % simulierter Schriftgröße im Dunkelmodus. Kurzer Header verhindert abgeschnittene Seitentitel bei großer Schrift.
- `ui-verification.json`: Browserprüfung mit simuliertem Konto, Einwilligung, Termin und Navigation. Speicherung und dargestellte Komponenten sind echt. Synthetischen Eintrag gespeichert und nach Neuladen wiedergefunden, Artikelkontext geöffnet, frühe/späte Wochen und fehlenden/fehlerhaften Termin sowie englische/spanische Texte geprüft. Keine beobachteten Browser-JavaScript-Fehler.

Nicht geprüft: die vollständige angemeldete App, physische iOS-/Android-Geräte, Softwaretastatur und native Zurück-/Swipe-Gesten. Die OTA-Veröffentlichung und die tatsächlich vom Update-Server gelieferten Manifeste sind geprüft. Die Anwendung des Updates auf einem physischen Gerät ist noch nicht bestätigt.


## EAS-Veröffentlichung

Die Veröffentlichung baut auf der vorherigen Gruppe `3612ed05-566d-4fd5-bf51-b9889520d02a` auf. In einer isolierten Kopie wurden neun Anwendungsdateien und drei Tests übernommen. 1.016 sonstige Dateien, die bisherigen Story-Korrekturen, alle 30 Schwangerschaftsbilder sowie native Konfiguration, Paketversionen, Runtime und Billing bleiben erhalten.

Die Veröffentlichungskopie bestand die App-Typecheck-Prüfung, den Typecheck der ausgewählten Tests, dieselben 66 Tests und die gezielte Lint-Prüfung ohne Fehler oder Warnungen. Beide Plattform-Bundles enthalten die neue Befinden-Oberfläche, die SSW-Texte, das Produktionsbackend und dieselben Billing-Schlüssel wie die Kandidaten-Binaries. Der geprüfte Export wurde anschließend unverändert mit `--skip-bundler` veröffentlicht.

Die tatsächlichen iOS-/Android-Manifeste liefern die neu veröffentlichten Update-IDs, Runtime `1.0.25`, die geprüften Bundle-Prüfsummen und alle 30 Bilder. Ein zusätzlicher direkter Download der Launch-Bundles vom Asset-CDN wurde über urllib und curl versucht und jeweils mit HTTP 403 abgewiesen; eine unabhängige Prüfung der heruntergeladenen Bundle-Bytes ist daher nicht bestätigt. Die Manifestprüfung ist erfolgreich.

Alle fünf Kanalzuordnungen blieben unverändert. Der öffentliche Branch `main` bleibt auf Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`. Die 15 separat geschützten Dateien im Hauptarbeitsverzeichnis und die veröffentlichten Quellprüfsummen sind unverändert. Es wurde kein neuer Store-Build erstellt.

Nachweise unter `output/pregnancy-feeling-ota-20261005/`: `published-update.json`, `source-preparation.json`, `export-preflight.json`, `export-verification.json`, `served-manifest-verification.json`, `published-release-preservation.json`, `tests.log`, `typecheck-app.log`, `typecheck-tests.log` und `lint.log`.

Zum Anwenden den vorhandenen Kandidaten vollständig schließen und öffnen. Falls das Update beim ersten Start im Hintergrund geladen wird, anschließend nochmals vollständig schließen und öffnen. Das entspricht dem dokumentierten [Download- und Startablauf von EAS Update](https://docs.expo.dev/eas-update/download-updates/).
