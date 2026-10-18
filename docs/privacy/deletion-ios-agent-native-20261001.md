# iPhone – native QA, 01.10.2026

Agent: provider_retention, exklusiver Zugriff auf das bestehende iPhone/Appium. Bundle `com.LottiBaby.app`, TestFlight 1.0.24 (1.0.76). Ausschließlich das vorhandene markierte QA-Konto support@lottibaby.de; keine zusätzlichen Konten, Daten, Store- oder Produktionsänderungen.

## Erster Versuch – belegte Schritte

- Nach ausdrücklicher Zustimmung des Nutzers Checkbox links am tatsächlichen sichtbaren Kontrollfeld angekreuzt. Der Beleg zeigt den ausgewählten Zustand.
- Passwort und E-Mail privat aus der bestehenden Fixture-Datei eingegeben; native Anmeldung erfolgreich. Die iOS-Passwortmanager-Frage wurde mit „Später“ abgelehnt.
- Kontolöschseite per App-Link geöffnet. Zunächst war der sichtbare Supportweg bei deaktivierter Annahme belegt.
- Nach Backend-Aktivierung lieferte die WDA-Hierarchie eine unsichtbare Code-Schaltfläche aus einer anderen Ansicht. Eine daraus abgeleitete Koordinate traf sichtbar „Abo verwalten“. Der Hinweis wurde geschlossen; kein Code, keine Store-Änderung, keine Löschannahme. Der zunächst gemeldete Nachweis verfügbarer iOS-Annahme ist ausdrücklich zurückgezogen.
- Mit sichtbaren Elementen zurückgegangen und über das dokumentierte Appium `mobile: deepLink` neu geöffnet. Sichtbar blieb der Supportweg.
- Nach regulärem Beenden/Starten derselben App erschien die Anmeldung: Androids inzwischen erfolgreich angenommene Kontolöschung hatte die globale Sitzung beendet. Kein Datenreset.
- Der danach durchgeführte echte Passwortlogin des vorhandenen QA-Kontos mit bestätigter Checkbox endete sichtbar mit: „Die Zustimmung konnte nicht sicher gespeichert werden. Du wurdest nicht angemeldet. Bitte versuche es erneut.“

## Einordnung und Gate des ersten Versuchs

Der Quellcode ruft bei Passwortlogin immer `acceptTerms` auf (`app/(auth)/login.tsx:277`). `record_terms_consent` versucht INSERT in `terms_consents` und UPDATE auf `profiles`; `deletion_private.guard_write` verweigert diese Schreibzugriffe bei offener Kontolöschung mit `account_deletion_pending`. Das ist mit der vorgesehenen Schreibsperre vereinbar und begründet keine pauschale Fehlfreigabe. Es verhindert allerdings die ursprünglich geplante zweite native Annahme desselben Kontos nach bereits erfolgter globaler Abmeldung.

Stand des ersten Versuchs: **iOS-Mailcode wurde nicht angefordert oder bestätigt. iOS accepted=false.** Die erfolgreiche Android-Annahme a95b3989-e395-45c7-8286-366fdf1c2eed darf nicht als iOS-Erfolg gelten. Root entscheidet über eine fachlich sinnvolle Anpassung des Testgates; dieser Agent autorisiert keinen Worker und umgeht keine Sperre.

Maschinenbeleg: `output/deletion-completion-20260930/ios-agent-native-20261001.json`. Sichtbarer letzter Zustand: `output/deletion-completion-20260930/ios-agent-post-acceptance-blocked-20261001.png`. Private XML-/Zwischenaufnahmen bleiben im nicht öffentlichen Fixture-Verzeichnis.

## Trial B – nativer iPhone-Annahmeweg bestanden

Root gab den streng auf das eigene markierte Testkonto begrenzten Teardown des noch unverarbeiteten Android-Auftrags A frei: queued, inventory, attempts=0, kein Workeraufruf. Der tatsächliche Android-Receipt, der archivierte Auftrag einschließlich offener Anbieterfälle sowie das unabhängige Register bleiben erhalten. Backend bestätigte danach 0 Aufträge, 7 Auth-Konten, 6 unveränderte Kontrollkonten und die erhaltene eigene Testdatei; QA-Annahme und Cron blieben zunächst deaktiviert. Nachweis: `output/deletion-completion-20260930/native-initial-request-reset-20261001.json`. Es wurde keine reale Kontosperre gelockert und keine neue Auth-Identität angelegt.

Der echte Passwortlogin desselben vorhandenen Fixtures bestand danach. Die bereits ausdrücklich erlaubte Checkbox war frisch als ausgewählt geprüft; die Passwortmanager-Frage wurde erneut mit „Später“ geschlossen. Die neu geöffnete Löschseite zeigte zunächst korrekt den Supportweg. Nach dem separaten Root-/Backend-Gate wurde die Ansicht mit sichtbarem Zurück und dem dokumentierten `mobile: deepLink` vollständig neu geöffnet. Code-Schaltfläche und Bildschirm waren diesmal übereinstimmend sichtbar und der Screenshot wurde vor dem Tippen geprüft.

Der Agent forderte tatsächlich einen neuen Code an. Root las die neue Nachricht im eingeloggten Support-Postfach und stellte den Code ausschließlich als private Datei bereit. Der Agent gab ihn privat in das native Feld ein und tippte die sichtbare verbindliche Auftragsschaltfläche. Der tatsächliche native Dialog zeigte „Löschung beauftragt“ mit dem account-Auftrag **6434ecdb-7d04-482d-a709-fd991932c142**. Screenshot und XML enthalten keinen OTP; der Screenshot wurde visuell geprüft. Nach „OK“ war ausschließlich der Supportweg sichtbar, ohne Codefeld oder Code-Anforderung. Es folgte keine erneute Anmeldung.

- Android A: `a95b3989-e395-45c7-8286-366fdf1c2eed`, tatsächliche native Annahme, danach kontrollierter Teardown vor Worker.
- iOS B: `6434ecdb-7d04-482d-a709-fd991932c142`, tatsächliche native Annahme mit neuem Mailcode, finaler Auftrag für die getrennt durch Root freigegebene Workerprüfung.

Dies sind **zwei aufeinander folgende native Versuche mit genau einer bestehenden Auth-Identität**. Sie beweisen keinen gemeinsamen nativen Idempotenz-Receipt. Der positive Sperrbeleg nach Android A bleibt unverändert. Die Annahme belegt einen gespeicherten und gesperrten Auftrag; die erfolgreiche vollständige Löschung einschließlich aller Anbieter wird daraus nicht behauptet. Root und Backend führen den getrennten Worker-/Anbieternachweis.

Aktuelle iOS-Nachweise:

- `output/deletion-completion-20260930/ios-agent-trial-b-20261001.json`
- `output/deletion-completion-20260930/ios-agent-trial-b-disabled-20261001.png`
- `output/deletion-completion-20260930/ios-agent-trial-b-enabled-20261001.png`
- `output/deletion-completion-20260930/ios-agent-trial-b-otp-requested-20261001.png`
- `output/deletion-completion-20260930/ios-agent-trial-b-accepted-20261001.png`
- `output/deletion-completion-20260930/ios-agent-trial-b-after-ok-20261001.png`

Private Rohaufnahmen, Mailcode und tatsächlicher iOS-Receipt liegen im Fixture-Verzeichnis und werden nicht ausgegeben. Keine neue Kostenfreigabe genutzt, kein Storekonto oder Tarif geändert, keine Produktionsmutation durch diesen Agent.
