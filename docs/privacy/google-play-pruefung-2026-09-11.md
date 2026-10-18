# Google-Play-Prüfung: App und lottibaby.de

**Nachträgliche Korrekturen:** Siehe [Umsetzung und Veröffentlichungsstand](privacy-controls-2026-09-11.md). Die folgenden Befunde dokumentieren den Prüfzeitpunkt vor diesen Änderungen.

Stand: 11.09.2026, ca. 10:10 Uhr Europe/Berlin. Geprüft wurde der aktuelle lokale Arbeitsbaum auf Basis von Commit `0adbccd`, einschließlich uncommitteter Änderungen. Diese Prüfung ändert weder App noch Website oder Backend. Sie ist keine Bestätigung, dass jede Richtlinie im produktiven Betrieb erfüllt ist.

**Ergebnis: Wesentliche frühere Textlücken sind behoben. Eine Freigabe zur Einreichung ist noch nicht ausreichend belegt.** Konkret offen bleiben Einwilligungen, produktive Bereitstellung und Prüfung der neuen Lösch-/KI-Meldewege, veraltete Funktionsangaben und die abschließenden Play-/Android-Nachweise.

## Erneut direkt verifiziert

- [Deutsche Datenschutzseite mit Löschabschnitt](https://lottibaby.de/datenschutz?lang=de#konto-loeschen): ohne Anmeldung erreichbar; der Anker existiert. Oben stehen App-Name, Löschumfang, E-Mail-Button und eine aufklappbare Erläuterung. Der Button enthält einen passenden Betreff und eine Löschanfrage, fordert kein Passwort und benötigt keine App-Installation. Keine E-Mail wurde versendet.
- [Startseite](https://lottibaby.de/?lang=de) und [App-Unterseite](https://lottibaby.de/app): Die FAQ erklären jetzt lokale UND Cloud-Speicherung und nennen Supabase, OpenAI, Sentry und RevenueCat. Die frühere Behauptung rein lokaler Speicherung ist in den geprüften deutschen Fassungen entfernt.
- Die Live-Datenschutzseite erklärt die Dienste, Datenarten, KI-Verarbeitung, maskierte Replays, Abonnements, Standort/weitere Funktionsübermittlungen, Gesundheitsdaten und Löschung. Die grundsätzliche frühere Feststellung „Dienstleister fehlen“ ist damit überholt. Vollständigkeit aller produktiven Konfigurationen ist dadurch nicht bewiesen.
- [Support](https://lottibaby.de/support) und [Impressum](https://lottibaby.de/impressum) sind erreichbar; Betreiber-/Kontaktangaben entsprechen den gelesenen App-Texten. Tatsächliche Postfachbetreuung und die versprochene Antwortzeit wurden nicht getestet.
- Die App bindet die neuen Datenschutzhinweise über `lib/appPrivacySections.json` ein: `app/datenschutz.tsx:14`, `app/datenschutz.tsx:135`, `lib/legalTranslations.ts`. Der Generierungsabgleich für Deutsch, Englisch und Spanisch besteht. Die Live-Browserprüfung dieser Aufgabe erfolgte auf Deutsch.
- Der deutsche Store-Entwurf enthält jetzt den vollständigen Hinweis „kein Medizinprodukt“ und die Abgrenzung von Diagnose, Behandlung, Heilung und Prävention: `docs/android-play/store/listing/de-DE/full-description.txt:25`. Das behebt die vorherige Textlücke; die tatsächliche medizinische Zweckbestimmung und Inhaltsqualität sind separat zu prüfen. [Google: Gesundheitsinhalte](https://support.google.com/googleplay/android-developer/answer/16679511?hl=de).

Eine allgemeine Datenschutzseite kann als externer Löschweg dienen, wenn der Abschnitt deutlich auffindbar ist und die Löschung darüber angefordert werden kann. Ein separates Formular oder eine eigene `/konto-loeschen`-Seite ist nicht zwingend. Der geprüfte Sprunglink ist hierfür grundsätzlich geeignet. Die Bearbeitung der Anfragen muss tatsächlich funktionieren. [Google: Kontolöschung](https://support.google.com/googleplay/android-developer/answer/13327111?hl=de).

## Konkrete verbleibende Befunde

### 1. Hohe Priorität: Sitzungsaufzeichnungen starten vor gesonderter Einwilligung

`app/_layout.tsx:88` initialisiert Sentry auf Modulebene. Die Replay-Raten stehen auf 10 % der Sitzungen und 100 % bei Fehlern (`:98`/`:99`); eine davor wirksame Einwilligungsprüfung wurde nicht gefunden. Die neue Live-Datenschutzerklärung sagt ausdrücklich, dass optionale Replays eine gesonderte Einwilligung benötigen. Maskierung und abgeschaltete Standard-PII sind sinnvolle Schutzmaßnahmen, ersetzen die Einwilligung aber nicht.

Vor Einreichung Replays bis zur aktiven Zustimmung deaktivieren oder ausbauen; Ablehnung und Widerruf müssen technisch wirken. Normale Fehlerdiagnose separat beurteilen. Für unerwartete Erhebung sensibler Daten verlangt Google eine deutliche Information im normalen App-Ablauf und vorherige aktive Zustimmung; eine Datenschutzerklärung allein genügt nicht. [Google: Nutzerdaten](https://support.google.com/googleplay/android-developer/answer/10144311?hl=de).

### 2. Hohe Priorität: Gesundheits-/KI-Einwilligung ist nicht als eigener Ablauf belegt

`lib/termsConsent.ts:11` dokumentiert weiterhin die Nutzungsbedingungen-Version `2026-08-17`. `components/moderation/TermsConsentGate.tsx:65` und `lib/moderationTranslations.ts:82` erfassen eine gemeinsame Zustimmung zu Nutzungsbedingungen und Datenschutz. Ein gesonderter, dokumentierter Ablauf für Gesundheitsdaten und deren KI-Verarbeitung wurde in den geprüften Einstiegspunkten nicht gefunden.

Besonders relevant ist die tägliche Fürsorge: `lib/advisor/advisorStorage.ts:79` aktiviert sie standardmäßig; `supabase/functions/advisor-daily/index.ts:517` lässt KI-Verarbeitung zu, solange `ai_enabled` nicht ausdrücklich `false` ist. Das beweist keine konkrete produktive Übertragung, zeigt aber, dass dieser Pfad nicht auf nachgewiesene KI-Zustimmung prüft. Mikrofonfreigabe bei Spracheingaben ist ebenfalls kein Nachweis der Zustimmung zur weiteren Verarbeitung von Gesundheitsinhalten.

Die neue Erklärung selbst verlangt ausdrücklich eine zusätzliche Grundlage für Gesundheitsdaten und stellt klar, dass die allgemeine Zustimmung sie nicht ersetzt. Konkrete Hinweise und erforderliche Einwilligungen vor Erhebung/Weitergabe, einschließlich Verarbeitung bei geschlossener App, ergänzen und auf Client und Server durchsetzen. [Google: Nutzerdaten](https://support.google.com/googleplay/android-developer/answer/10144311?hl=de), [Gesundheitsinhalte](https://support.google.com/googleplay/android-developer/answer/16679511?hl=de).

### 3. Veröffentlichung noch offen: Lösch- und KI-Meldewege sind lokal implementiert

Die frühere Aussage „Frag Lotti hat keine Meldefunktion“ gilt für den aktuellen Code nicht mehr. `app/frag-lotti.tsx:638` bindet `ReportAnswerButton` ein; `lib/askLotti/reporting.ts:25` übermittelt die ausgewählte Antwort an `report_lotti_answer`. Im Moderationsbereich wird `ai_answer` verarbeitet. Fehler führen nicht zu einer falschen Erfolgsmeldung. Die Migration und aktualisierte Benachrichtigungsfunktion müssen tatsächlich bereitstehen; siehe `docs/ask-lotti-reporting.md:23`. [Google: KI-Inhalte](https://support.google.com/googleplay/android-developer/answer/13985936?hl=de).

Auch die frühere Beschreibung des alten Lösch-RPC ist überholt. `lib/profile.ts:158` verwendet jetzt `requestAccountDeletion`; es gibt einen gemeinsamen Bildschirm, OTP-Prüfung, dauerhafte Aufträge, Storage-Bereinigung, Anbieter-Nachweise und lokale Cache-Bereinigung. Der Request-Handler verweigert ohne aktive Konfiguration die Annahme (`supabase/functions/request-account-deletion/handler.ts:29`).

`docs/privacy/deletion-runbook.md:3` bezeichnet das Backend ausdrücklich als lokal getestet, aber nicht produktiv freigegeben. Die eigene read-only-Abfrage des zugeordneten Supabase-Projekts wurde mit fehlender Berechtigung abgewiesen. Daher kein unabhängiger Live-Nachweis für Migrationen, Funktionen, Scheduler, Inventar, Anbieterbearbeitung oder tatsächlichen Abschluss. Die funktionierende öffentliche E-Mail-Seite und der technische Backend-Rollout sind getrennte Nachweise. Die App-Änderungen sollten erst mit funktionsfähigem Backend veröffentlicht werden.

### 4. Mittlere Priorität: Store-Entwurf bewirbt abgeschaltete Community

`lib/communityAccess.ts:6` setzt `COMMUNITY_ENABLED = false`; Community-/Chat-Routen werden gesperrt, die bisherigen Screens fehlen. Dennoch verspricht `docs/android-play/store/listing/de-DE/full-description.txt:16` Austausch in der Community. Diesen Entwurf vor Übernahme in Google Play korrigieren. Auch die Website zeigt Community-Screenshots und Aussagen dazu; die passende öffentliche iOS-Version wurde hier nicht untersucht, deshalb ist die Website-Abweichung zur Android-Fassung ein Abgleichpunkt und kein bewiesener Fehler der aktuell veröffentlichten iOS-App. [Google: Metadaten](https://support.google.com/googleplay/android-developer/answer/9898842?hl=de).

### 5. Betriebsangaben und Fristen konkretisieren

Der öffentliche Löschabschnitt erklärt Umfang, geteilte Daten, Dienstleister und Ausnahmen. Für Sentry, Backup-Auslauf, tatsächliche Löschbearbeitung und weitere Anbieter werden überwiegend Verfahren bzw. Kriterien statt konkreter betrieblicher Fristen genannt. Das Runbook lässt entsprechende Konfigurationswerte bewusst offen. Tatsächliche Werte festlegen, in Betrieb und Texten konsistent dokumentieren und Anfragen inklusive Auftragsverarbeitern bearbeiten. Keine Fristen aus Beispielen oder SDK-Defaults übernehmen. [Google: Kontolöschung](https://support.google.com/googleplay/android-developer/answer/13327111?hl=de).

## Abdeckung der weiteren Richtlinienbereiche

| Bereich | Bewertung dieser Prüfung |
| --- | --- |
| Datenschutz / Datensicherheit / SDKs | Erklärung deutlich verbessert; Einwilligungsbefunde oben bleiben. Produktive Empfängerrollen, Aufbewahrung, Verträge, Dashboardintegrationen und Data-Safety-Angaben noch abgleichen. |
| Gesundheit | Store-Hinweis ergänzt. Gesundheitsformular, Zweckbestimmung und fachliche Prüfung der erreichbaren Hinweise/Prognosen offen. Kein Nachweis medizinischer Zulassung erforderlich oder vorhanden behauptet. |
| KI | Meldeweg für Frag Lotti lokal vorhanden und getestet. Live-Verarbeitung, Moderationsbetrieb und weitere generative Oberflächen separat verifizieren. |
| Nutzerinhalte / Community | Öffentliche Community und Chats im aktuellen Client abgeschaltet. Moderationsreste im Code allein beweisen keine erreichbare Funktion. Geteilte Familieninhalte, ältere Clients und verbleibende Uploadflächen gesondert beurteilen; keine pauschale UGC-Freistellung. [UGC-Vorgaben](https://support.google.com/googleplay/android-developer/answer/9876937?hl=de). |
| Zielgruppe / Kinder / Altersfreigabe | Eltern-/Betreuungskonzept erkennbar. Babyprofile machen die App nicht automatisch zu einer von Kindern bedienten App. Tatsächliche Zielgruppe, IARC und gegebenenfalls Kinderanforderungen müssen in der Console zum Release passen; keine Altersfreigabe geraten. |
| Zahlungen / Abos | RevenueCat verwendet Store-Kauf und Wiederherstellung (`lib/revenuecat.ts:445`, `:483`); Aboverwaltung berücksichtigt den Herkunftsstore. Google-Angebote, Preise/Testphase, automatische Verlängerung und echter Lizenztest noch prüfen. [Zahlungsrichtlinie](https://support.google.com/googleplay/android-developer/answer/9858738?hl=de). |
| Shop | HTTPS-WebView und öffentlich beworbene physische DTF-Produkte vorhanden. Daraus kein Beleg einer Umgehung von Play Billing. Checkout, Cookies und tatsächliche externe Datenflüsse wurden nicht durch Bestellung geprüft. |
| Berechtigungen | Quellmanifest enthält Standort, Kamera, Mikrofon, Kalender und ältere Speicherrechte bis SDK 32. Kein Hintergrundstandort, Kontakt-/SMS-Zugriff, All-Files-Recht oder Werbe-ID im Quellmanifest. Abschließendes zusammengeführtes Release-Manifest fehlt. |
| Vordergrunddienst | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` und AudioControlsService vorhanden; benötigte Hintergrundwiedergabe in den gesuchten App-Aufrufen nicht nachgewiesen. Nutzung und Console-Erklärung belegen oder unbenötigte Rechte entfernen. [Google: Vordergrunddienste](https://support.google.com/googleplay/android-developer/answer/13392821?hl=de). |
| Ziel-API | Installierte React-Native-Gradle-Defaults stehen auf API 36; App-Gradle übernimmt `rootProject.ext.targetSdkVersion`. Das passt zum seit 31.08.2026 geforderten Level, ist aber kein Nachweis des finalen Bundles. [Ziel-API-Anforderungen](https://support.google.com/googleplay/android-developer/answer/11926878?hl=de). |
| Werbung / Werbe-ID | Kein klassisches Anzeigen-SDK in den gesichteten direkten Abhängigkeiten nachgewiesen. Das schließt Affiliate-/Produktplatzierungen oder externe Web-Inhalte nicht aus; Console-Angabe separat bestätigen. |
| Metadaten / App-Werbung | Konkrete Community-Abweichung oben. Screenshots müssen zum Android-Release passen. Aussagen wie Expertenempfehlungen brauchen tatsächliche Belege; solche Belege wurden hier nicht geprüft. |
| Identität / geistiges Eigentum | Öffentliche Betreiberangaben lesbar und mit App-Texten konsistent. Rechte an allen Bildern, Videos, Rezepten und Marken nicht durch Codeprüfung feststellbar. |
| Eingeschränkte Inhalte / Glücksspiel / Finanzdienste / Blockchain | In den gesichteten Funktionen kein entsprechendes Geschäftsmodell erkennbar. Keine vollständige Sichtung aller Remote-Inhalte, Nutzerdateien oder generierten Antworten; daher keine umfassende Inhaltsfreigabe. |
| Malware / Geräte- und Netzwerkmissbrauch | Keine einschlägige Funktion aus dem geprüften Manifest/Funktionsumfang abgeleitet. Kein vollständiger Malware-, Abhängigkeits- oder Penetrationstest durchgeführt. |
| Funktionalität / Nutzererfahrung | Gezielte Tests bestanden. Finaler Android-Start, Anmeldung, Kerntracking, Käufe, Berechtigungsablehnung, Offlineverhalten und neue Löschung/Meldung müssen am vorgesehenen Release geprüft werden. |
| Sonderprogramme | Keine separate Prüfung von Wear OS, TV, Auto/Automotive, Instant Apps oder XR; im betrachteten Vorhaben geht es um die mobile Android-App. |
| Play Console / Entwicklerkonto | Aktuelle Formulare und Kontostatus nicht live geprüft. Bestehende Projektunterlagen lassen die Kontotypfrage offen. Google verweist Gesundheits-Apps auf Organisationskonten; tatsächliche Einordnung klären. [Kontotyp](https://support.google.com/googleplay/android-developer/answer/13634885?hl=de). |

## Selbst ausgeführte Prüfungen

- `node scripts/sync-app-privacy.mjs --check`: bestanden für de/en/es.
- 10 Jest-Suites / **97 Tests bestanden**: `askLottiReporting`, `askLottiReportDialog`, `accountDeletion`, `accountDeletionBackend`, `accountDeletionLocalStorage`, `accountDeletionScreen`, `termsConsent`, `communityAccess`, `subscriptionManagement`, `paywall-screen`.
- Live-Browserprüfung der deutschen Startseite, App-Unterseite, Datenschutzseite mit Anker/ausklappbarem Löschumfang, Supportseite und Impressum. E-Mail-Link nur gelesen.
- Offizielle Google-Seiten für Nutzerdaten, Kontolöschung, KI, Gesundheit, Nutzerinhalte, Zahlungen, Metadaten, Ziel-API, Vordergrunddienste und Kontotyp erneut abgerufen.
- Kein produktives Konto gelöscht, keine Meldung/E-Mail versendet, kein Kauf durchgeführt und keine App-/Website-/Backend-Veröffentlichung vorgenommen. Kein final signiertes AAB in dieser Prüfung verifiziert. Die lokale Testsicherheit ist kein Nachweis für produktiv korrekt eingerichtete Dienste.
