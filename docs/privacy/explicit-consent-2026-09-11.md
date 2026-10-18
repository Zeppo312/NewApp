# Einwilligungen: aktueller Stand nur UI-Vorschau

Historischer Stand. Die neue Implementierung und ihre ausgeschalteten Produktionsgrenzen sind im [Stand vom 1. Oktober 2026](data-consents-implementation-20261001.md) beschrieben. Die folgenden Angaben dokumentieren weiterhin die damalige Vorschau.

Stand 11. September 2026, nach Änderung des Auftrags durch den Nutzer.

Die zuvor vorbereitete technische Durchsetzung wurde aus dem aktiven Arbeitsstand entfernt. Aktuell gibt es ausschließlich eine optionale Vorschauseite unter Einstellungen → Einwilligungen · Vorschau, mit getrennten Dialogen für Gesundheitsdaten und KI in Deutsch, Englisch und Spanisch.

Die Auswahl lebt nur im Zustand der geöffneten Seite. Sie wird weder gespeichert noch übertragen, sperrt keine Nutzer oder App-Funktionen und beendet keine Datenverarbeitung. Die Oberfläche benennt diese Grenze ausdrücklich. Zustimmung, Ablehnung, Zurücksetzen und Schließen lassen sich dort ausprobieren. Das ist noch kein wirksamer Einwilligungs- oder Widerrufsablauf.

## Zurückgenommen

- Start-Gate und Abhängigkeiten in Auth, Supabase-Fetch, KI-/Spracheingabe und Hintergrundaufgaben.
- Neue Consent-RPCs, RLS-/PostgREST-Sperren, Gastzugriffs- und Push-Prüfungen: Die Migration `20260911090047_explicit_health_ai_consents.sql` und der gemeinsame Edge-Helper sind aus dem Deployment-Verzeichnis entfernt.
- Eingriffe in die Anmeldenavigation bzw. private Provider-Unmounts aufgrund einer Consent-Entscheidung und die zugehörige Gerätebereinigung.
- Datenschutzzusagen über eine bereits wirksame Einwilligungssperre oder einen Widerruf über diese Oberfläche.

Bestehende Authentifizierung, Familien-Zugriffsrechte, Premium-Prüfungen und der separat vorbereitete Löschablauf wurden nicht entfernt. Die vorherige produktive Stilllegung der täglichen KI-Fürsorge bleibt erhalten. Keine Backend-, Website- oder App-Veröffentlichung in diesem Schritt.

## Veröffentlichungsstand

Eine öffentliche Play-Store-Freigabe ist damit noch nicht belegt. Wo eine Einwilligung erforderlich ist, muss sie vor der betreffenden Verarbeitung wirksam sein; eine wirkungslose UI-Auswahl ersetzt das nicht. Eine pauschale Nutzersperre ist dafür nicht vorgeschrieben. Später kann die Verarbeitung der jeweiligen Funktion gezielt an eine echte Entscheidung gekoppelt werden.

Weitere noch zu bestätigende Punkte laut Projektunterlagen: produktive Ende-zu-Ende-Prüfung des In-App-Löschablaufs und der KI-Meldungen, finales signiertes Android App Bundle einschließlich Geräte-/Kauf-/Berechtigungstests sowie die passenden Datensicherheits-, Gesundheits- und sonstigen Play-Console-Angaben. Der bestehende Android-JavaScript-Export ist kein Nachweis eines vollständig geprüften Store-Bundles.

Quellen: [Google Nutzerdaten](https://support.google.com/googleplay/android-developer/answer/10144311?hl=de), [Gesundheitsformular](https://support.google.com/googleplay/android-developer/answer/14738291?hl=de). Ergänzend gelten [Löschablauf](deletion-runbook.md), [KI-Meldungen](../ask-lotti-reporting.md) und der ursprüngliche Prüfbericht.

Die älteren 81-/28-Testnachweise unter `output/explicit-consent-20260911` beschreiben die inzwischen zurückgenommene Durchsetzung. Sie sind keine Nachweise für deren aktuelle Aktivierung. Aktuelle Prüfungen stehen unter `output/consent-ui-preview-20260911`.

## Aktuelle Prüfung der Vorschau

- 8 Jest-Suites / 69 Tests bestanden: Vorschauauswahl ohne Netzwerkzugriff oder persistierten Zustand, beide Dialoge, App-Start, Anmeldung, Onboarding und Fürsorge.
- App-TypeScript, Datenschutz-Synchronitätsprüfung und Deno-Typprüfung der sechs betroffenen Edge-Funktionen bestanden.
- Keine Consent-RPCs oder Consent-Zugriffssperren mehr in den aktiven App-/Backend-Quellen und Migrationen; bestehende Schutzregeln anderer Funktionen bleiben erhalten.
- Android-JavaScript-/Hermes-Export der aktuellen UI-Fassung erfolgreich: `/tmp/lotti-consent-ui-export-20260911`. Protokoll in `output/consent-ui-preview-20260911/android-export.log`; kein signiertes Store-AAB und kein Upload.
