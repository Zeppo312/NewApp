# LottiBaby: Android, Google Play und Abos – Agentenplan

Stand: 10. September 2026. Jeder nummerierte Schritt ist ein eigener Agentenauftrag. Es werden durch diesen Plan keine Agenten gestartet.

## So verwendest du den Plan

Kopiere für jeden neuen Agenten diesen Auftrag und ersetze die Nummer:

> Arbeite im Projekt `/Users/janzeppenfeld/Developer/LottiBaby`. Lies `docs/android-play-agent-plan.md` und führe ausschließlich Schritt **X** einschließlich seiner Abschlusskriterien aus. Beachte den gemeinsamen Auftrag und die Voraussetzungen. Verwende die tatsächlichen Ergebnisse vorheriger Schritte. Übernimm bereits erledigte Arbeit und ändere keine fremden Änderungen. Berichte abschließend, was fertig ist, wie es geprüft wurde und welcher konkrete nächste Schritt möglich ist. Starte keine weiteren Agenten.

Für Agenten in separaten Worktrees müssen dieser Plan und die Ergebnisse der vorherigen Schritte dort verfügbar sein. Ein Worktree aus dem Standardbranch enthält nicht automatisch die laufenden lokalen Änderungen.

## Gemeinsamer Auftrag für jeden Agenten

- Lies die anwendbaren AGENTS.md und relevanten Skills. Prüfe zuerst den aktuellen Stand: Das Projekt enthält viele laufende, noch nicht eingecheckte Änderungen, unter anderem an RevenueCat und Android-Oberflächen. Nichts zurücksetzen, pauschal überschreiben oder durch einen älteren Stand ersetzen.
- Verwende vorhandenes RevenueCat und Google Play Billing. Keine zusätzliche Stripe-Integration. iOS-Käufe und bestehende Abos müssen weiter funktionieren.
- Android zeigt Google-Play-Kaufoptionen, iOS seine Apple-Kaufoptionen. Bereits vorhandene Berechtigungen gehören zum angemeldeten Nutzer. Die Verwaltung eines bestehenden Abos muss dessen tatsächlichen Herkunftsstore berücksichtigen, auch bei einem Gerätewechsel.
- Setze um und prüfe angemessen. Kennzeichne ungetestete Store-Funktionen ausdrücklich; gemockte Tests oder ein RevenueCat Test Store sind kein Nachweis für einen Google-Play-Testkauf.
- Verifiziere aktuelle Store- und SDK-Vorgaben anhand offizieller Quellen. Ein Kommentar im Repository ist keine Bestätigung, dass ein externer Dienst sich entsprechend verhält.
- Halte Zugangsdaten aus Git, Logs und Berichten heraus. Öffentliche SDK-Schlüssel und geheime Server-/Dienstaccount-Schlüssel haben unterschiedliche Verwendungsorte.
- Bestätigungen, Ausweisdokumente, Kontoentscheidungen und fehlende Produktentscheidungen werden vom Nutzer bereitgestellt. Beim Computer-Use gelten die jeweiligen Regeln für Verträge, Berechtigungen und Zahlungen. Bereite den konkreten Schritt vor, bevor du eine notwendige Freigabe anfragst. Keine Nachrichten an andere senden ohne ausdrücklichen Auftrag.
- Keine öffentliche Veröffentlichung durch einen der Vorbereitungsschritte. Ein finaler öffentlicher Rollout benötigt einen ausdrücklichen Auftrag des Nutzers.
- Schreibe eine Übergabe nach `docs/android-play/step-XX.md`: Ergebnis, geänderte Dateien, Prüfungen, konkrete verbleibende Hindernisse und Voraussetzungen für den Folgeauftrag. Keine personenbezogenen Nachweise und keine Geheimnisse darin ablegen.

## Bekannter Ausgangspunkt

- Das persönliche Google-Play-Konto „Lotti Baby“ wurde erstellt. Identität am 11.09.2026 um 08:01 Uhr bestätigt; Telefonbestätigung freigeschaltet und SMS-Code angefordert, Eingabe durch Nutzer ausstehend. Keine offene Geräteaufgabe. „App erstellen“ weiterhin gesperrt. Siehe [Schritt 7](android-play/step-07.md).
- Kontotyp und Gesundheitsfunktionen sind noch nicht abschließend geklärt. Eine Supportanfrage wurde vorbereitet, ihr Versand wurde nicht bestätigt. Nicht behaupten, Google habe die Einordnung bereits genehmigt.
- Android-Paketname: `com.LottiBaby.app`, identisch in Expo und im nativen Gradle-Projekt. Groß-/Kleinschreibung beibehalten.
- Expo/EAS ist eingerichtet. `production` verwendet die EAS-Umgebung und den Update-Kanal `production`. Das vorhandene `preview`-Profil nutzt interne Distribution und ist nicht automatisch für einen Play-Store-Upload geeignet.
- Im eingecheckten Android-Gradle-Projekt verweist `release` derzeit auf die Debug-Signierung. Schritt 2 muss den tatsächlichen EAS-/lokalen Buildpfad und die fertige Signatur prüfen; nicht allein aus dieser Datei auf die Signatur eines EAS-Artefakts schließen.
- RevenueCat: `lib/revenuecat.ts`, `lib/purchasesClient.ts`; Paywall: `app/paywall.tsx`, `components/paywall/`; Verwaltung: `lib/subscriptionManagement.ts`, `app/subscription.tsx`.
- Bestehende Freischaltungen: Lite → `LottiBabyLite`, Standard → `LottiBabyAbo`, Premium → `LottiBabyPremium`; Offering derzeit `default`. Tatsächliche Dashboard-Konfiguration noch abgleichen.
- Backend vorhanden: `supabase/functions/revenuecat-webhook/index.ts`, `supabase/functions/_shared/premiumAccess.ts` und eine Abo-Cache-/Feature-Policy. Bestehendes erweitern, keinen zweiten parallelen Berechtigungspfad bauen.

## Reihenfolge

Einfachster Ablauf: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13.

Schritte 1–6 können während Googles Prüfung erledigt werden. Schritt 7 begleitet die Kontofreigabe. Für parallele Arbeit nach Schritt 1 eignen sich 2, 3, 4 und 6 bei klar getrennter Dateizuständigkeit. Schritt 5 benötigt die integrierten Ergebnisse aus 2–4. Wenn diese Koordination nicht sichergestellt ist, arbeite nacheinander.

## 1. Bestand aufnehmen und Produktzuordnung festlegen

**Voraussetzung:** Keine Google-Freigabe erforderlich.

**Auftrag:** Prüfe die aktuelle Android-, Paywall-, RevenueCat- und Backend-Implementierung. Erfasse bereits laufende Änderungen. Dokumentiere eine gemeinsame Zuordnung für Tarif, Laufzeit, Google-Abo-ID, Basisplan, RevenueCat-Package und Freischaltung. Prüfe Dashboard-Konfiguration read-only, soweit zugänglich. Keine Produkte anlegen und keine bestehenden Produkt-IDs ändern.

Als noch nicht angelegter Vorschlag gelten `lottibaby_lite`, `lottibaby_standard`, `lottibaby_premium` mit jeweils `monthly` und `yearly`. Gleiche diesen Vorschlag mit vorhandenen Produkten ab. Vorhandene gültige IDs haben Vorrang; die iOS-IDs bleiben erhalten. Preise, Testzeiträume und aktive Verkaufsregionen aus nachprüfbaren Quellen übernehmen oder als offen markieren, nicht erfinden.

**Fertig, wenn:** Die übrigen Agenten eine eindeutige Produkt-/Berechtigungszuordnung und eine Liste realer Lücken erhalten. Ablage: `docs/android-play/product-map.md` und `step-01.md`.

## 2. Android-Build und Signierung vorbereiten

**Voraussetzung:** Schritt 1.

**Auftrag:** Prüfe Expo-Konfiguration, native Android-Dateien, Plugins, Buildtools, aktuelle Target-API-/Play-Anforderungen, Paketname, Versionscode, Berechtigungen, Build-Umgebungen und Signierung. Sorge für einen installierbaren Android-Testbuild und einen nachvollziehbaren Weg zum signierten Store-AAB. Verwende vorhandene Schlüssel korrekt; keine Schlüssel unbemerkt ersetzen.

Prüfe insbesondere die Debug-Signierung im lokalen Release-Pfad und ob EAS sie für den tatsächlichen Build korrekt ersetzt. Verifiziere das erzeugte Artefakt. Trenne bei Bedarf einen Store-Testbuild mit passender Update-Umgebung von der öffentlichen Produktionsumgebung. Ein Play-interner Test erfordert ein geeignetes AAB, nicht lediglich das bisherige intern verteilte Preview-APK. Fehlende Produktionsschlüssel nicht durch einen RevenueCat-Testschlüssel kaschieren.

**Fertig, wenn:** Ein Build tatsächlich erstellt und ein Testbuild gestartet wurde oder ein konkreter externer Blocker dokumentiert ist. Dokumentiere Buildbefehle, Artefaktpfade/-links, Signierungsnachweis ohne Geheimnisse, Kanal und Umgebung. Kein Store-Upload in diesem Schritt.

## 3. Android-Abos und Paywall im Client fertigstellen

**Voraussetzung:** Produktzuordnung aus Schritt 1.

**Auftrag:** Implementiere die Android-Produkt-/Basisplan-Zuordnung und Preise über das vorhandene RevenueCat-SDK. Prüfe die tatsächlich verwendeten SDK-Felder statt iOS-ID-Vergleiche einfach auf Android zu übertragen. Verhindere Käufe bei fehlenden Produkten oder ungültiger Konfiguration. Verhindere, dass Ersatzpreise als verifizierte Kaufpreise erscheinen.

Prüfe Kauf, Abbruch, Fehler, Wiederherstellung, Tarif-/Laufzeiterkennung, Login/Logout und bereits aktive Abos. Android erhält Google-Texte und passende Kaufdialoge, iOS behält seine Darstellung. Berücksichtige vorhandene Apple-Abos auf Android: Zugang soll zum Konto passen, die Verwaltung zum Herkunftsstore. Vermeide unbeabsichtigte Doppelabos. Beachte Google-spezifische Regeln für Tarifwechsel; dokumentiere gegebenenfalls die vorhandene Produktentscheidung dazu.

**Fertig, wenn:** Relevante Tests für Android-Produktformate und iOS-Regressionen erfolgreich sind. Echte Store-Käufe bleiben als Prüfung für Schritt 11 offen.

## 4. Backend-Freischaltungen und Webhook prüfen

**Voraussetzung:** Produktzuordnung aus Schritt 1; Abstimmung mit Schritt 3 bei Schnittstellenänderungen.

**Auftrag:** Prüfe den bestehenden RevenueCat-Webhook und die serverseitigen Berechtigungen für Google-Play-Ereignisse. Verifiziere insbesondere das im Code verlangte Authentifizierungs-/Signaturformat anhand aktueller RevenueCat-Dokumentation und tatsächlicher Dashboard-Möglichkeiten. Erfundenes oder nicht unterstütztes Header-Verhalten darf echte Ereignisse nicht blockieren; entferne Authentifizierung nicht ersatzlos.

Prüfe Wiederholungen, verspätete/ungeordnete Ereignisse, Zuordnung zur Nutzer-ID und Tarifcache. Kündigung zum Laufzeitende darf nicht sofort den bezahlten Zugang entfernen. Erstattung, Ablauf, Zahlungsprobleme und Wiederherstellung müssen gemäß dem tatsächlichen Berechtigungsstatus behandelt werden. Bestehende iOS-Ereignisse müssen weiterhin verarbeitet werden. Nutze den Supabase-Skill.

**Fertig, wenn:** Aussagekräftige lokale Tests bestehen und notwendige Deployment-/Dashboard-Änderungen konkret dokumentiert sind. Produktionsänderungen nicht beiläufig ausführen; die gezielte Inbetriebnahme gehört zu Schritt 9.

## 5. Android-App auf Gerät oder Emulator testen

**Voraussetzung:** Integrierte Ergebnisse aus 2–4.

**Auftrag:** Nutze den Android-QA-Skill und teste eine echte laufende App. Prüfe Start, Registrierung/Login, Onboarding, Zurück-Taste, Tastatur, Datum-/Zeitauswahl, Kerntracking, Berechtigungsdialoge, Benachrichtigungen und Paywall. Prüfe insbesondere die bereits laufenden Android-Änderungen, statt sie neu zu bauen.

Behebe reproduzierbare Android-Fehler mit begrenztem Umfang. Prüfe nach Fixes die betroffenen Abläufe erneut. Ein fehlendes Play-Angebot ohne eingerichteten Store ist ein dokumentierter Konfigurationszustand, kein Beweis für funktionierende Käufe.

**Fertig, wenn:** Kernabläufe auf Android geprüft sind, wesentliche Blocker behoben sind und ein kurzer Bericht mit Gerät/Version und geeigneten Screenshots vorliegt.

## 6. Store-Unterlagen und Tester-Vorbereitung

**Voraussetzung:** Schritt 1; endgültige Screenshots nach Schritt 5 ergänzen.

**Auftrag:** Erstelle konkrete Entwürfe für deutsche Store-Texte, Screenshot-Liste/-Material, Supportangaben, App-Zugang für Reviewer und die erforderlichen Play-Console-Angaben. Ermittle Datenerhebung, Übertragung, SDKs, Berechtigungen und Löschwege aus der tatsächlichen App. Übernimm keine unzutreffenden Website-Aussagen wie ausschließlich lokale Speicherung, wenn das Backend Daten speichert.

Bereite Antworten zur Zielgruppe und zu Gesundheitsfunktionen vor. Unterscheide eine App für Eltern von einer App, die Kinder selbst bedienen. Stelle offene Angaben verständlich zusammen; stelle keine medizinische oder rechtliche Zulassung fest. Keine Formulare mit geratenen Angaben absenden.

Erstelle außerdem einen kurzen Tester-Leitfaden mit konkreten Testaufgaben, Feedbackvorlage und einem Einladungstext. Keine Einladungen senden. Der Nutzer kann bereits mindestens zwölf geeignete Tester suchen; die offizielle Testdauer startet erst mit dem entsprechenden Play-Test und der Teilnahme.

**Fertig, wenn:** Ein prüfbares Store-Paket und Tester-Material unter `docs/android-play/store/` vorliegen. Angaben, die der Nutzer noch liefern muss, sind klar markiert.

## 7. Google-Konto bestätigen und Kontotyp klären

**Geprüfter Stand 11.09.2026, ca. 08:10 Uhr:** [Übergabe Schritt 7](android-play/step-07.md). Identität bestätigt (Console und E-Mail, 08:01 Uhr). Telefonbestätigung freigeschaltet, SMS einmal angefordert; Code des Nutzers fehlt. „App erstellen“ weiterhin gesperrt, keine offene Geräteaufgabe. Kontotypklärung bleibt Voraussetzung für öffentliche Veröffentlichung; aktualisierter Supportentwurf (948/1000 Zeichen) vorbereitet, nicht gesendet. Im Kontoinhaber-Postfach keine Kontotypantwort gefunden; Kontaktpostfach noch nicht zugänglich. Nächster Auslöser: SMS-Code/Telefonabschluss; keine Dauerüberwachung.

**Voraussetzung:** Nutzer-/Google-Mitwirkung; kann neben 1–6 laufen.

**Auftrag:** Prüfe per Computer-Use den aktuellen Status. Unterstütze bei Identitätsprüfung, Gerätebestätigung und danach Telefonbestätigung. Überlasse erforderliche Ausweis-/Identitätsschritte dem Nutzer. Starte keine zweite kostenpflichtige Registrierung.

Prüfe den Stand der Kontotypanfrage. Die Kontoerstellung allein bestätigt nicht, dass alle Gesundheitsfunktionen über das Privatkonto veröffentlicht werden dürfen. Bereite bei Bedarf eine aktualisierte Anfrage über den nun zugänglichen Play-Support vor. Versand nur auf ausdrücklichen Auftrag. Behaupte keine Google-Genehmigung ohne Antwort. Falls Google einen anderen Kontotyp verlangt, dokumentiere den konkreten Umstellungsweg statt eine Organisation zu erfinden.

**Fertig, wenn:** Der tatsächliche Kontostatus dokumentiert ist und „App erstellen“ verfügbar ist. Für eine spätere öffentliche Veröffentlichung bleibt eine ungeklärte Kontotypanforderung als offene Voraussetzung sichtbar. Falls Google noch prüft: genaue Abhängigkeit melden; nicht untätig endlos überwachen.

## 8. App anlegen und ersten Store-Testbuild hochladen

**Voraussetzung:** Schritte 2, 5 und die technische Kontofreigabe aus 7.

**Auftrag:** Lege Lotti Baby in der Play Console als kostenlos herunterladbare App mit In-App-Abos an. Verwende die exakte Paketkennung `com.LottiBaby.app`. Prüfe zuerst, ob die App bereits existiert, um keine Duplikate anzulegen. Richte Play App Signing mit dem vorgesehenen Upload-Schlüssel ein.

Erstelle aus dem integrierten Stand ein gültiges, signiertes AAB und lade es zunächst in den internen Testbereich. Erfülle notwendige Angaben anhand der geprüften Unterlagen aus Schritt 6. Der erste Upload darf vor fertig eingerichteten Abos erfolgen; dann ist er nur ein technischer Testbuild. Keine öffentliche Veröffentlichung. Lege den internen Testerzugang an, soweit berechtigt und möglich.

**Fertig, wenn:** Play den Build akzeptiert hat. Dokumentiere App-Link, Versionscode, Track und tatsächlichen Release-Status. Ein nur hochgeladener Entwurf ist noch nicht für Tester installierbar.

## 9. RevenueCat, Google-Dienstaccount und Ereignisse verbinden

**Voraussetzung:** Schritte 4 und 8; Zugriff auf das bestehende RevenueCat-Projekt und Google Cloud.

**Auftrag:** Ergänze im bestehenden RevenueCat-Projekt die Google-Play-App. Erstelle oder verwende ein passendes Google-Cloud-Projekt und einen dedizierten Dienstaccount; aktiviere die nach aktueller RevenueCat-Dokumentation benötigten APIs und richte die erforderlichen Play-Berechtigungen ein. Prüfe vorhandene Ressourcen vor Neuanlage.

Bereite sicherheitsrelevante Berechtigungen und Schlüssel mit genau benanntem Empfänger und Umfang vor und beachte die Bestätigungspflichten des verwendeten Werkzeugs. Hinterlege den geheimen Dienstaccount-Schlüssel ausschließlich am vorgesehenen Server-/Dashboard-Ort. Prüfe RevenueCats Credentials-Validierung; eventuelle Aktivierungswartezeiten ehrlich dokumentieren.

Richte Google Real-Time Developer Notifications über Pub/Sub zu RevenueCat ein. Prüfe mit einer Testbenachrichtigung den Empfang. Nimm notwendige Backend-Korrekturen aus Schritt 4 im vorgesehenen Zielsystem in Betrieb und prüfe außerdem RevenueCat → bestehender Supabase-Webhook. Dies sind zwei verschiedene Verbindungen; eine erfolgreiche Google-Pub/Sub-Testmeldung beweist noch nicht den Supabase-Empfang.

**Fertig, wenn:** Dienstaccount-Verbindung und beide Ereigniswege überprüft sind oder konkrete fehlende Freigaben/Aktivierungen dokumentiert sind. Keine geheimen Schlüssel in der Übergabe.

## 10. Sechs Android-Aboangebote einrichten und Preise verbinden

**Voraussetzung:** Schritte 1, 3, 8 und 9; bestätigte Preise/Verkaufsregionen.

**Auftrag:** Vervollständige bei Bedarf das Zahlungsprofil mit Mitwirkung des Kontoinhabers. Lege anhand von `product-map.md` die Google-Abos und monatlichen/jährlichen Basispläne an beziehungsweise verwende vorhandene. Setze bestätigte Preise, Regionen und Verlängerung; keine ungefragten Testzeiträume oder Rabatte hinzufügen.

Importiere die Angebote in RevenueCat und verbinde sie mit den richtigen Packages und bestehenden Freischaltungen im Offering. Hinterlege den öffentlichen Google-SDK-Schlüssel in den tatsächlich verwendeten lokalen/EAS-Umgebungen. Gehe nicht davon aus, dass eine lokale .env automatisch im Cloud-Build enthalten ist. Ergänze ein neues internes AAB, wenn Konfiguration oder Code das erfordern.

**Fertig, wenn:** Alle angebotenen Tarif-/Laufzeitkombinationen in einem installierten Android-Build mit den richtigen Store-Preisen geladen werden. Aktualisiere `product-map.md` mit tatsächlichen IDs. Noch keine Behauptung erfolgreicher Käufe ohne Schritt 11.

## 11. Google-Play-Testkäufe vollständig prüfen

**Voraussetzung:** Schritte 5 und 8–10; installierbarer interner Play-Release und Testkonten.

**Auftrag:** Richte die vorgesehenen Konten als Track-Tester und Lizenztester ein. Installiere über den Play-Testlink und verwende ausdrücklich die Google-Testzahlungsmethoden. Track-Teilnahme allein macht Käufe nicht kostenlos. Kein realer kostenpflichtiger Kauf ohne entsprechende Autorisierung.

Teste die angebotenen Tarif-/Laufzeitkombinationen, Kaufabbruch, Wiederherstellung nach Neuinstallation, Login-Wechsel, bereits vorhandene Abos, unterstützte Tarifwechsel, Kündigung bis zum Ablauf, Ablauf und Zahlungsfehler. Prüfe Zugang in der App UND serverseitig inklusive Webhook-/Cache-Aktualisierung. Verwende geeignete Testkonten für Bestandsabos/Plattformwechsel; keine echten Kundendaten verändern.

Behebe gefundene Fehler, baue bei Bedarf neu und wiederhole nur die betroffenen Prüfungen. Prüfe iOS-Regressionen an den gemeinsam genutzten Pfaden.

**Fertig, wenn:** Eine Ergebnismatrix mit Testumgebung, Buildversion, erwarteter/tatsächlicher Freischaltung und verbleibenden Fehlern vorliegt. Wesentliche Kauf-/Berechtigungsfehler blockieren den nächsten Release-Schritt.

## 12. Geschlossenen Test durchführen und Produktionszugang beantragen

**Voraussetzung:** Schritte 6, 7 und 11; reale Tester verfügbar.

**Auftrag:** Prüfe die aktuellen Anforderungen für das konkrete persönliche Konto. Richte den geschlossenen Test und einen geprüften Release ein. Stelle dem Nutzer Opt-in-Link, Installationsanleitung, Testaufgaben und einen funktionierenden Feedbackweg bereit. Testeransprache nur bei ausdrücklichem Versandauftrag.

Zuletzt verlangte Google mindestens zwölf Tester, die mindestens vierzehn Tage ununterbrochen angemeldet bleiben. Die Teilnahme und echte Nutzung müssen tatsächlich stattfinden; sie lassen sich nicht durch Agentenberichte ersetzen. Interner Test und geschlossener Test sind unterschiedliche Tracks.

Dokumentiere Startdatum und nachprüfbaren Fortschritt ohne Tester-Personendaten zu veröffentlichen. Richte eine spätere Überwachung nur ein, wenn der Nutzer sie ausdrücklich beauftragt. Kehre nach Ablauf der realen Testzeit zu diesem Auftrag zurück, werte Feedback aus und bereite den Antrag auf Produktionszugang mit wahrheitsgemäßen Angaben zur tatsächlichen Testphase vor. Keine Antworten über erfundene Testaktivität.

**Fertig, wenn:** Der geschlossene Test durchgeführt und der Produktionszugang von Google freigegeben ist. Ein laufender Test oder ein eingereichter Antrag zählt noch nicht als Freigabe.

## 13. Veröffentlichung prüfen und zur Freigabe vorbereiten

**Voraussetzung:** Schritte 6, 7, 11 und 12; keine offenen wesentlichen Fehler.

**Auftrag:** Prüfe den finalen integrierten Stand, den Produktions-Build mit korrekter Umgebung/Signierung, Store-Eintrag, Daten-/Gesundheitsangaben, Account-Löschung, Reviewer-Zugang, Abo-Preise, Berechtigungen, Kontotypklärung und tatsächliche Play-Freigaben. Die öffentliche Version darf keinen Test-Store-Key oder unbeabsichtigte Testfreischaltungen enthalten.

Bereite einen Produktionsrelease mit Versionshinweisen und einem passenden Rolloutvorschlag vor. Gib dem Nutzer den konkreten Build, die sichtbaren Store-Angaben, Testnachweise und verbleibende Risiken zur Prüfung. Erst nach ausdrücklichem Veröffentlichungsauftrag zur Prüfung einreichen beziehungsweise öffentlich ausrollen; dabei klar zwischen Einreichung, Google-Genehmigung und tatsächlicher Verfügbarkeit unterscheiden.

**Fertig, wenn:** Zunächst ein vollständig prüfbarer Release zur Nutzerfreigabe bereitsteht. Nach autorisierter Veröffentlichung gilt der Gesamtauftrag erst als abgeschlossen, wenn der tatsächliche Store-Status geprüft und dokumentiert ist.

## Offizielle Ausgangslinks

- [Google Play Console](https://play.google.com/console/)
- [Kontotyp und erforderliche Angaben](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
- [Play-Kontovorgaben](https://support.google.com/googleplay/android-developer/answer/10788890?hl=de)
- [Gesundheits-App-Kategorien](https://support.google.com/googleplay/android-developer/answer/13996367?hl=en)
- [Geschlossene Tests für neue persönliche Konten](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- [Google-Testkäufe](https://developer.android.com/google/play/billing/test?hl=de)
- [Manueller Android-Upload mit Expo](https://docs.expo.dev/submit/android-manual/)
- [RevenueCat-Dashboard](https://app.revenuecat.com/)
- [Google-Play-Produkte in RevenueCat](https://www.revenuecat.com/docs/getting-started/entitlements/android-products)
- [Google-Dienstaccount für RevenueCat](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)
- [Google-Echtzeitmeldungen zu RevenueCat](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications)
- [Google Cloud Console](https://console.cloud.google.com/)
