# Apple, Push, Support-Mail, Shop und geteilte Inhalte – 01.10.2026

Geprüft wurde ausschließlich der bestehende markierte SMTP-QA-Fall B: Projekt `ggyonianphloycmqrwvj`, Auftrag `6434ecdb-7d04-482d-a709-fd991932c142`, Konto `dafbeb6f-b0b1-42f7-82dd-1adbab279d6d`. Die Adresse `support@lottibaby.de` bleibt eine produktiv genutzte Betriebsadresse; sie ist kein Auftrag zur Löschung des Postfachs oder beliebiger adressgleicher Anbieterobjekte. Geräte-, Worker-, Restore- und Registertests wurden nicht wiederholt.

Die Prüfung nutzte vorhandene authentifizierte Supabase-Management-API, Hostinger-Webmail und hPanel, Shopify- und Gmail-Connector sowie offizielle Dokumentation. Der Hostinger-Mail-Connector selbst berechtigt nur ein anderes Betriebs-Postfach; deshalb wurde das bereits angemeldete Support-Webmail verwendet. Anbieter-, Mail- und Inhaltsbestände wurden in dieser Teilprüfung ausschließlich gelesen. Der Hauptagent dokumentierte anschließend **nur Apple für B administrativ als `not_applicable`**; Request-Sperre, andere Fälle, Kontrollkonten, Einstellungen und Scheduler blieben nach dessen Guard-Beleg unverändert. Kein Anbieterwiderruf, kein Claim und keine ausführende Workerphase erfolgten; die administrative Belegauflösung ist separat nachgewiesen.

| Anbieter/Fall | Belegter Status für B | Tatsächlicher Bestand und Grenze | Verbleibende Handlung / Nutzeraktion |
| --- | --- | --- | --- |
| Apple-Anmeldung | **`not_applicable`, jetzt auch live** | Vor Löschung um 12:22 UTC ausschließlich `email`; der zur Annahme B um 13:34 UTC gesicherte Locator enthält ebenfalls nur `email` mit exakter QA-UID. Live-Locator um 15:39 UTC nochmals geprüft. | Keine Apple-Autorisierung dieses Kontos zu widerrufen. Aussage gilt ausschließlich für Apple-Anmeldung, nicht für Store-Abos, TestFlight oder APNs. Keine Nutzeraktion. |
| Push | **`pending`** | Um 15:41 UTC null zugeordnete Zeilen in beiden Token-Tabellen und vier Benachrichtigungstabellen. Vor Geräteanmeldung ebenfalls null, aber vollständige Token-/Sendebelege zwischen Anmeldung und Löschung fehlen. | Vorhandene Senderprotokolle, Tickets/Receipts und Geräte-Cleanupbelege dem Konto zuordnen. Kein neuer Testpush. Ungeklärte Warteschlangen und lokale Benachrichtigungskopien bleiben offen. |
| Support-Mail | **`pending`** | Drei tatsächlich vorhandene QA-Anmeldemails in Hostinger INBOX: UIDs 111, 114, 116. Domainweite hPanel-Forwarder: **0**; Webmailfilter: keine Regeln; Bcc: leer. Das sind aktuelle Konfigurationen. | Nur diese exakt zugeordneten OTPs nach erneuter UID-/Zeit-/Empfängerprüfung und Erhaltung minimaler Belege behandeln. Klären, ob genau diese drei Mails manuell weitergeleitet, exportiert oder durch lokale Mailprogramme kopiert wurden. Kein weiterer Hostinger-Login erforderlich. |
| Shop | **`pending`** | Richtiger Shopify-Shop authentifiziert; exakte Supportadresse ergibt **0 Kunden und 0 Bestellungen**. WebView erlaubt Cookies/Webspeicher; kein Konto-UID-Parameter in Shop-URL. | Abgebrochene Checkouts, lokale Warenkörbe, zugehörige Apps/Exporte/Archive noch ungeprüft. Nutzer meldet sich im vorhandenen Shopify-Konto im vorbereiteten Tab an und bestätigt, ob das markierte QA-Konto überhaupt für Checkout/Personalisierung verwendet wurde. |
| Geteilte Inhalte | **`pending`** | Aktuelle exakte UID-/E-Mail-Textsuche in 36 beobachteten Community-, Sharing-, Nachrichten-, Moderations-/Audit-Tabellen: überall **0**. Erfolgreicher ursprünglicher Preflight bleibt gültig. | Gelöste Referenzen, kopierter Freitext und historische Empfänger-/Exportkopien sind dadurch nicht ausgeschlossen. Originale Aktivitäts-/Objektzuordnung prüfen; bei fehlenden Belegen nur tatsächliche Nutzung dieses QA-Kontos für Teilen/Posten/Nachrichten/Downloads vom Betreiber klären. Fremde Inhalte erhalten. |

## Mailbestand und konkret vorbereitete Behandlung

| Hostinger-Ordner/UID | Sichtbarer Zeitpunkt (Europe/Berlin) | Zuordnung |
| --- | --- | --- |
| INBOX / 111 | 30.09.2026, 18:09 | Ursprüngliche SMTP-/OTP-Prüfung derselben Wegwerfidentität. |
| INBOX / 114 | 01.10.2026, 14:51 | Android-Versuch A derselben Identität; B nutzte sie anschließend weiter. |
| INBOX / 116 | 01.10.2026, 15:29 | iOS-Versuch B vor Annahme um 15:34. |

Alle drei tragen `Your Magic Link`, Absender `Lotti <support@lottibaby.de>` und die spezifische Lotti-Baby-QA-Anmeldevorlage. Die Suche nach genau diesem Betreff in **allen Ordnern** ab dem in der URL gespeicherten Zeitpunkt 23.09.2026 22:00 UTC lieferte diese drei Treffer auf einer Seite. Anschließend wurden über „Show original“ für **alle drei** ausschließlich sichere RFC822-Kopfwerte extrahiert: Empfänger und Delivered-To jeweils `support@lottibaby.de`, Message-ID und sekundengenaues Datum. OTP-Werte, Verifizierungstokens und Rohmailinhalte wurden nicht in die neuen Belege kopiert.

| UID | RFC822 Message-ID | Datum UTC |
| --- | --- | --- |
| 111 | `<4hw0P3349jz30Vl@fr-int-smtpout27.hostinger.io>` | 30.09.2026 16:09:43 |
| 114 | `<4hwWxb69bmz30Tm@fr-int-smtpout27.hostinger.io>` | 01.10.2026 12:51:15 |
| 116 | `<4hwXnk0bRgzyyY@fr-int-smtpout11.hostinger.io>` | 01.10.2026 13:29:30 |

UIDVALIDITY wurde von der geprüften Oberfläche nicht angezeigt; deshalb darf eine spätere Aktion nicht allein auf UID vertrauen. Ordner, Message-ID, Datum und Empfänger müssen zusammen erneut passen. Die genaue Gmail-Suche `in:anywhere` nach diesen drei RFC822-IDs ergab ebenfalls keine Treffer; das ist auf das verbundene Gmail-Konto begrenzt.

Konkrete vorbereitete Aktion: die drei UIDs einzeln erneut auf Ordner, Message-ID, Empfänger, Datum und QA-Vorlage prüfen; bestehende Zustellungs-/Verifizierungsberichte erhalten; nur die exakt bestätigten OTP-Nachrichten gezielt behandeln und den danach tatsächlich vorhandenen Zustand einschließlich Papierkorb nachweisen. Es wurde weder verschoben noch gelöscht. Kein gesamter Papierkorb darf geleert werden.

Gmail ist als `businesszeppieu@gmail.com` verbunden. Die enge Suche einschließlich `in:anywhere` nach QA-Magic-Link-Mails an die Supportadresse im Prüfzeitraum hatte keine Treffer. Die separate Suche nach dem bekannten Löschalarm ergab eine **gesendete Workflow-Testmail** `1a0f31aa783dc3fa`, 30.09.2026 16:16:45 UTC, Absenderalias `business@zeppi.eu`, Empfänger Support. Sie entspricht dem Empfangstest, ist keine nachgewiesene Weiterleitung der QA-OTP und gehört nicht automatisch in die personenbezogene Löschliste. Die Alarmbelege (auch Hostinger 112/113) bleiben erhalten. Manuelle Weiterleitungen, frühere Regeln und lokale Mailarchive sind durch diese Suchabfragen nicht ausgeschlossen.

## Aufbewahrung und allgemeiner Produktionsumfang

**Push:** Expo beschreibt flüchtige Transportwarteschlangen, keine dauerhafte Inhaltsdatenbank; ein Receipt bestätigt die Übergabe an Apple/Google, nicht die Entfernung auf dem Gerät. FCM nennt höchstens 28 Tage für nicht zugestellte Nachrichten und diesen Standard bei fehlender TTL. APNs kann je Ablaufheader bis 30 Tage puffern und beschreibt Ablauf als Best Effort. Diese Regeln belegen keine letzte tatsächliche Nachricht des QA-Kontos und keinen Gesamtabschluss. Im vorhandenen App-Code bricht `clearPersonalDeviceData` geplante Benachrichtigungen ab und entfernt angezeigte Benachrichtigungen. Die gespeicherte native Abnahme liefert keine separate vollständige Inventur aller Geräte-/Empfängerkopien. DB-Sicherungen sind weiterhin ein eigener Anbieterfall. Quellen: [Expo FAQ](https://docs.expo.dev/push-notifications/faq/), [FCM-Gültigkeit](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan), [APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).

**Mail:** Hostinger nennt bis 30 Tage Wiederherstellung im Papierkorb; Gmail löscht Papierkorb-Nachrichten nach 30 Tagen. Die drei OTPs liegen noch in der Inbox, daher beginnt daraus **kein** Lösch-/Auslaufdatum. Papierkorbregeln belegen keine Frist sämtlicher internen Anbieterarchive, historischer Weiterleitungen oder lokaler Mailkopien. Die eigene 90-Tage-Frist minimaler Belege nach Gesamtabschluss ist getrennt. Quellen: [Hostinger](https://www.hostinger.com/support/1583473-how-to-recover-deleted-emails-in-hostinger-email/), [Gmail](https://support.google.com/mail/answer/7401?hl=en).

**Shop:** Die öffentliche Datenschutzerklärung beschreibt lokalen Warenkorb `lb_cart`, optionale Personalisierung und Übergabe an Shopify. Code bestätigt `https://lottibaby.de?source=app&lang=…` und aktivierten DOM-Speicher/Cookies. Kein automatischer UID-Transfer beweist nicht, dass die Person Shopdaten nie eingegeben hat. Shopify unterscheidet personenbezogene Redaktion von Profilentfernung; Bestellhistorie kann bestehen bleiben, unabhängige Shop-/Shop-Pay-Verarbeitung bleibt getrennt. Die dokumentierten zehn Tage Rücknahmemöglichkeit sind keine zugesagte vollständige Backup-Löschfrist. Quellen: [Shopify-Löschablauf](https://help.shopify.com/en/manual/privacy-and-security/privacy/processing-customer-data-requests), [offizieller E-Mail-Filter für Bestellungen](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders), [LottiBaby-Shopdaten](https://lottibaby.de/datenschutz).

**Apple:** Für echte Apple-Anmeldungen bleibt ein fallbezogener Grant-/Tokenwiderruf erforderlich; eine email-only-QA-Identität belegt keine globale Apple-Nichtnutzung. Quelle: [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).

**Geteilte Inhalte:** UUID-/E-Mail-Abwesenheit beweist nach `SET NULL`, Detach oder kopierten Inhalten keine Anonymisierung. Aktuelle Datenbankkopien, Anbieterbackups, öffentliche Medien und Empfängerkopien müssen getrennt betrachtet werden. Eine allgemein festgelegte Empfänger-Löschfrist ist nicht belegt; kein Prüftermin wird zur garantierten Frist umgedeutet.

## Konkreter Zugangspunkt

Der [Shopify-Admin](https://admin.shopify.com/store/mgi0yv-mz) wurde im eigenen Browser-Tab `404339544` zur vorhandenen Kontoauswahl geöffnet und als Handoff erhalten. Die Seite verbindet Fortfahren ausdrücklich mit Zustimmung zu AGB/Datenschutzerklärung und Marketing-E-Mails. Es wurde nicht fortgefahren. Der Benutzer muss diesen Anmeldeschritt selbst durchführen; kein Passwort oder Schlüssel wird im Chat benötigt. Der vorhandene Connector bleibt für lesende Kunden-/Bestellabfragen nutzbar.

## Nachweise

- [Konsolidierte Teilprüfung](../../output/deletion-completion-20260930/provider-communications-review-20261001.json)
- [Fall-Locator vor Apple-Abschluss](../../output/deletion-completion-20260930/provider-communications-live-locators-20261001.json)
- [Live-Zähler Push/Direktbezüge](../../output/deletion-completion-20260930/provider-communications-live-counts-20261001.json)
- [36 Tabellen: exakte Inhalts-/Audit-Zähler](../../output/deletion-completion-20260930/provider-communications-content-counts-20261001.json)
- [Reduzierte Mail-/hPanel-/Login-Beobachtungen](../../output/deletion-completion-20260930/provider-communications-browser-observations-20261001.json)
- [Reduzierte Shopify-/Gmail-Connectorbelege](../../output/deletion-completion-20260930/provider-communications-connector-observations-20261001.json)
- [Exakte RFC822-Kopfwerte der drei QA-OTPs](../../output/deletion-completion-20260930/provider-communications-mail-headers-20261001.json)
- [Apple-Abschluss durch Hauptagent, inklusive Erhaltungsguards](../../output/deletion-completion-20260930/provider-apple-resolution-20261001.json)

Die neuen Nachweise enthalten keine Mailpasswörter, API-Schlüssel, OTP-Werte, Magic-Link-Tokens oder Inhalte fremder Nachrichten. Bestehende Register und frühere Beweise bleiben erhalten.
