# Gesundheits- und KI-Einwilligungen

Stand: 1. Oktober 2026, einschließlich der anschließenden Freigabe für die neue App-Version. Dieser Stand ersetzt den technischen Vorschau-Stand vom [11. September](explicit-consent-2026-09-11.md). Die bereits veröffentlichte App bleibt unverändert; neue Builds enthalten den wirksamen Einwilligungsablauf.

## Implementiertes Verhalten

- Zwei getrennte, freiwillige Entscheidungen: Gesundheitsdaten und KI. Keine Vorauswahl. Eine KI-Zustimmung setzt eine Gesundheitszustimmung voraus; reine Gesundheitsfunktionen funktionieren auch nach KI-Ablehnung.
- Zustimmung, Ablehnung und Widerruf werden mit Nutzer, Zweck, Textversion `2026-10-01.1`, Sprache, Serverzeit und Revision protokolliert. Die angezeigten Texte in Deutsch, Englisch und Spanisch sind an den serverseitigen Textstand gebunden.
- Ein Widerruf sperrt die betroffenen Funktionen sofort auf diesem Gerät. Ausstehende Widerrufe werden lokal gespeichert und nach erneuter Anmeldung/Verbindung erneut übertragen. Abmeldung entfernt die Zugangsdaten, bewahrt aber den noch unbestätigten Widerruf. Veraltete Zustimmungen können einen späteren Widerruf nicht überschreiben.
- Ein Gesundheitswiderruf widerruft auch eine bestehende KI-Freigabe. Private Bildschirmbäume werden geschlossen; lokale Chats, Gesundheitscaches, Entwürfe, Widgets, Live Activities und geplante Erinnerungen werden bereinigt. Fehlgeschlagene Bereinigung hält die betroffenen Ansichten gesperrt und lässt sich wiederholen. Ein KI-Widerruf bereinigt lokale Lotti-Chats, während manuelle Gesundheitsfunktionen verfügbar bleiben.
- Nach App-Rückkehr und spätestens bei der nächsten regelmäßigen Statusprüfung wird eine Entscheidung von einem anderen Gerät übernommen. Ohne bestätigten aktuellen Status bleiben geschützte Funktionen gesperrt. Einstellungen, Datenschutz, Support, Abo-Verwaltung, Kontolöschung und Abmeldung bleiben erreichbar.

Der Widerruf stoppt weitere Verarbeitung für den betroffenen Zweck. Er löscht vorhandene Serverdaten nicht und kündigt kein Abo. Dafür bleiben die eigenen Lösch- und Abo-Abläufe zuständig.

## Abfrage und spätere Zustimmung

Nach der Anmeldung erscheint bei fehlender Gesundheitsfreigabe die Einwilligungsseite vor den geschützten App-Bereichen. Gesundheitsdaten und KI werden getrennt erklärt und entschieden. Unter **Einstellungen → Einwilligungen** können beide Entscheidungen später geändert oder widerrufen werden.

Beim Aufruf von **Frag Lotti** ohne KI-Freigabe zeigt die App eine Erklärung mit **Einwilligung ansehen** und **Zurück**. Vor einer **Sprachaufnahme** erscheint ebenfalls ein Hinweis mit dieser Möglichkeit; ohne Freigabe startet weder die Mikrofonaufnahme noch die KI-Verarbeitung. Die Hinweise öffnen `/data-consents?scope=ai` direkt beim passenden, nicht vorausgewählten Dialog. Falls auch die Gesundheitsfreigabe fehlt, wird diese Voraussetzung zuerst abgefragt.

Nach bestätigter Zustimmung führt **Zurück zur Funktion** zurück zum aufgerufenen Bereich. Schließen oder Ablehnen erteilt keine Zustimmung und öffnet den Dialog nicht durch Statusaktualisierungen ständig erneut. Die Sprachaufnahme muss anschließend bewusst erneut gestartet werden. Bei einem noch ausstehenden Widerruf oder fehlender Statusprüfung wird keine neue Zustimmung angeboten, bis der Zustand geklärt ist.

## Technische Durchsetzung

Der neue App-Code verwendet den wirksamen Ablauf standardmäßig, auch ohne zusätzlich gesetztes Flag. Alle neun EAS-Build-Profile setzen außerdem ausdrücklich `EXPO_PUBLIC_DATA_CONSENTS_ENABLED=true`, einschließlich Produktion, Store-internal und QA. `EXPO_PUBLIC_DATA_CONSENTS_ENABLED=false` ist ausschließlich für lokale Vorschau-/Test-Arbeit vorgesehen; EAS-Builds lehnen diese Vorschau-Konfiguration ab. Damit kann der nächste normale Build nicht versehentlich wieder die wirkungslose Vorschau enthalten.

Wenn das Backend noch nicht für den Release aktiviert ist, bleibt die neue App bei den erreichbaren Einwilligungs-/Support-/Kontofunktionen und erlaubt keine Gesundheits- oder KI-Verarbeitung. Sie zeigt in diesem Fall keine Vorschau-Zustimmungen und übernimmt keine scheinbare Freigabe. Bei einem Abfragefehler bleibt die Verarbeitung ebenfalls gesperrt.

Die erste Migration `20261001170732_data_consent_records.sql` ergänzt ausschließlich die private Einwilligungsverwaltung und drei eigene RPCs. Alle privaten Tabellen besitzen RLS und keine direkten Tabellenrechte für App-/Service-Rollen. Entscheidungen gelten nur für den authentifizierten Nutzer. Die serverseitige Einstellung startet mit `enabled=false` und `activated_at=null`; die erste Migration allein kann keine wirksame Aktivierung zulassen.

Die separate Migration `20261001170812_data_consent_enforcement.sql` ergänzt restriktive RLS-Regeln und Schreibprüfungen für 44 Gesundheits-/Verarbeitungstabellen sowie einen PostgREST-Hook für bestehende RPCs. Bestehende Mitgliedschafts- und Zugriffsregeln gelten weiter. Geteilte Daten erfordern auch die Einwilligung der jeweiligen Quelle; ein Partner kann einen Widerruf nicht umgehen. Anonyme Gesundheits-/Gast-RPCs werden nach Aktivierung gesperrt und benötigen einen entsprechend aktualisierten Ablauf mit Anmeldung.

Der bestehende Kontolösch-Hook wird unter Beibehaltung seines kanonischen Namens komponiert. Löschbereitschaft und Löschannahme bleiben nach einem Widerruf nutzbar. Die Aktivierung verlangt dokumentierte Client-/Edge-Releases, einen geprüften Textstand sowie vorhandene Datenbank-Sperren. Nach erstmaliger Aktivierung öffnet ein Abschalten des Rollout-Schalters bereits widerrufene Verarbeitung nicht wieder.

`ask-lotti` und `voice-log-parse` prüfen vor Verarbeitung und vor weiteren OpenAI-Aufrufen erneut. `advisor-generate` benötigt Gesundheit und verwendet bei fehlender KI-Freigabe die vorhandene regelbasierte Fürsorge. Betroffene Gesundheits-Push-Funktionen prüfen Sender/Quelle und Empfänger vor Versand. Fehlgeschlagene Consent-Prüfungen erlauben keine Verarbeitung; Administrator- oder Premium-Rechte ersetzen keine Zustimmung.

## Produktionsstand

Die additive Einwilligungsverwaltung wurde isoliert auf dem Produktionsprojekt `kwniiyayhzgjfqjsjcfu` angelegt und anschließend nachgeprüft. Ergebnis: `enabled=false`, `activated_at=null`, keine Nutzerentscheidungen oder Audit-Ereignisse, keine direkten App-/Service-Tabellenrechte, kein installierter Consent-Hook. Die bestehenden öffentlichen Funktionen, Tabellenrechte, RLS-Regeln und der PostgREST-Hook besitzen vor und nach dem Schritt denselben geprüften Fingerabdruck. Der Deployment-Nachweis liegt in `output/consent-implementation-20261001/production-records-staged.json` und `production-records-verified.json`.

Der App-Ablauf ist für die neue Version eingeschaltet. Die Durchsetzungsmigration und die geänderten Edge-Funktionen müssen mit deren Release veröffentlicht und freigegeben werden. Die laufende Produktion bleibt bis dahin ausgeschaltet und wurde erneut gegen die unveränderten bestehenden Zugriffsregeln geprüft. Ein Einschalten der globalen Backend-Sperren vor Verfügbarkeit der neuen App würde auch bisherige Nutzer betreffen, deren alte Version den echten Zustimmungsablauf noch nicht enthält. Ebenso darf die neue App nicht öffentlich freigegeben werden, solange ihr Backend noch ausgeschaltet ist.

Es wurde weder eine App-/OTA-Veröffentlichung noch eine globale Backend-Aktivierung ausgeführt. Es wird kein pauschales `supabase db push` auf den umfangreicheren Arbeitsstand ausgeführt. Das eingeschränkte Skript `scripts/data-consent-rollout.mjs` wendet ausschließlich die verifizierte erste Migration an und vergleicht bestehende öffentliche Funktionen, Tabellenrechte, RLS-Regeln und den PostgREST-Hook vor und nach dem Schritt.

## Nachweise und verbleibender Rollout

Die automatisierten Nachweise liegen unter `output/consent-implementation-20261001`:

`new-version-verification.json` und die `new-version-*.log`-Dateien belegen die anschließende Aktivierung im neuen App-Code und in den Build-Profilen. Die älteren Verifikationsdateien dokumentieren den vorherigen, ausgeschalteten Vorbereitungsstand; die Produktionsmigration wurde anschließend nicht verändert.

Der anschließend ergänzte direkte Dialog aus einer gesperrten Funktion ist in `context-review-verification.json` und den `context-review-*.log`-Dateien nachgewiesen: 18 bestandene UI-Tests, 8 Backend-/Textbindungsprüfungen, App-/Test-TypeScript sowie aktuelle Android-/iOS-JavaScript-Exporte. Die Anzeige, die vorausgehende Gesundheitsentscheidung, die spätere KI-Zustimmung, die Rückkehr zur Funktion und ein Schließen ohne erneute Aufforderung sind geprüft. Es wurde kein App-Update veröffentlicht.

- 14 Jest-Suites mit 83 bestandenen App-Tests, einschließlich Vorschau ohne Persistenz, getrennten Entscheidungen, Offline-Widerruf, Login-/Onboarding- und Lösch-Regressionsprüfungen. Die neue Standardaktivierung, die tatsächliche Provider-Reaktion auf ein noch inaktives Backend und die ausbleibende Vorschau-Freigabe werden ebenfalls geprüft.
- 16 bestandene Build-Konfigurations-/Isolationsprüfungen: alle Profile enthalten den echten Ablauf, Builds können die Vorschau nicht einschalten, und das QA-Backend bleibt isoliert.
- 13 bestandene SQL-Prüfungen mit echtem PostgreSQL-Verhalten, einschließlich RLS, Rollenrechten, Textversion, Revisionen, Quell-/Familien-Widerruf und Zusammenspiel mit den tatsächlichen Kontolöschmigrationen.
- 8 bestandene Backend-/Integrationsprüfungen der tatsächlichen AI-Endpunkte vor privaten Datenzugriffen, bei Ablehnung und bei fehlgeschlagener Consent-Abfrage, einschließlich UI-/Textbindung.
- TypeScript für App und Tests sowie Deno-Typprüfung aller sechs geänderten Edge-Endpunkte bestanden.
- Android- und iOS-JavaScript-/Hermes-Exporte mit eingeschaltetem Consent-Code und isoliertem QA-Backend erfolgreich. Kein Upload und kein Store-Artefakt.

Die Datenbank-Migrationen wurden zusätzlich gegen den tatsächlichen Schema-Stand des isolierten QA-Projekts in einer vollständig zurückgerollten Transaktion geprüft, einschließlich des bestehenden Lösch-Hooks für authentifizierte und Service-Anfragen. Dabei wurden keine echten Nutzerentscheidungen erzeugt und keine QA-Konfiguration dauerhaft geändert.

Vor der wirksamen Aktivierung sind die Einwilligungs-App und die betroffenen Edge-Funktionen gemeinsam im isolierten QA-Projekt zu veröffentlichen und auf Android/iPhone abzunehmen: Ablehnung beim Start, getrennte Freigaben, Offline-Widerruf mit Abmeldung/Neuanmeldung, App-Rückkehr, Widerruf auf einem zweiten Gerät, Familien-/Quell-Widerruf, laufende Sprachaufnahme/Anfrage sowie weiterhin erreichbare Löschung und Abo-Verwaltung. Direkte authentifizierte, anonyme und Service-Aufrufe müssen dieselben Sperren nachweisen. Gäste mit bisherigen anonymen Gesundheitspfaden benötigen vor Aktivierung den aktualisierten Zugang. Die endgültigen Einwilligungstexte und Datenschutzhinweise benötigen die fachliche Freigabe für diesen Release.

JavaScript-/Hermes-Exporte und automatisierte Tests belegen die Implementierung; sie ersetzen weder die Geräteabnahme noch ein signiertes Store-Artefakt. Die laufende Produktion besitzt nach der ausgeschalteten Vorbereitung weiterhin keinen neu aktivierten Einwilligungsablauf.
