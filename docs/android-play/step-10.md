# Schritt 10 – Android-Abos

## Familienzugang – separater Auftrag 2, 24.09.2026

Der Produktions-Hotfix aus Auftrag 1 bleibt aktiv und wurde nicht erneut ausgerollt.
Der Familienrollout ist **noch nicht produktiv freigegeben**. QA-Backend und
App-Einstieg wurden ergänzt; 299 Jest-Tests, 71 PostgreSQL-Assertions und erneut
20 Live-QA-Prüfungen bestehen. Der Android→iPhone-Hauptfall ist inzwischen mit
internem Play-Build 1.0.23 (6), TestFlight 1.0.24 (1.0.60), kostenlosem
Premium-Testkauf, eigenem Partnerkonto und späterem Entzug nach Ablauf auf
beiden Geräten bestätigt. Auch Apple-Sandbox-Kauf auf iPhone B → Android C ist
im QA-Backend und auf den Geräten bestätigt. Weitere Releasefälle und positive
KI-Aufrufe fehlen.
Details: [Familien-Rolloutprotokoll](../family-subscription-test-report-20260924.md).


## Produktionskorrektur am 24.09.2026 – abgeschlossen

Der gezielte Hotfix ist produktiv: `ask-lotti` **25 → 28** (`verify_jwt=true`),
`advisor-generate` **16 → 19**, `voice-log-parse` **24 → 27** und
`revenuecat-webhook` **7 → 10** (je `verify_jwt=false`, eigene Auth erhalten).
Alle vier nach dem Deploy erneut einzeln heruntergeladenen Quellstände stimmen
bytegenau mit dem getesteten Hotfix überein. Unauthentifizierte Produktionsaufrufe
aller vier Endpunkte liefern HTTP 401.

Beim Kauf getestet: Versionen 27/18/26/9 (Reihenfolge wie oben). Das Setzen bzw.
Entfernen des temporären Operator-Secrets erhöht bei Supabase automatisch
Function-Versionen. Nach Entfernen: die oben genannten finalen Versionen
28/19/27/10 mit **identischen geprüften Bundle-Hashes und JWT-Flags**. Auch die
Bundles und JWT-Flags der zehn übrigen Functions sind gegenüber der Sicherung
unverändert; sie erhielten nur die automatische Secret-bedingte Versionsaktualisierung.

Deployment-Quelle und genaue Übergabe:
[`supabase/hotfixes/subscription-tier/README.md`](../../supabase/hotfixes/subscription-tier/README.md).
Die drei Feature-Handler basieren auf den frisch gesicherten Live-Bundles.
Der achtspaltige Tarifcache blieb unverändert; kein Familien-/Account-Deletion-Rollout.
Nur Migration `20260924064154_subscription_tier_cache_guard` wurde gezielt angewandt
und in der Migrationshistorie erfasst. Sie sperrt die gemeinsame ID zusätzlich im
SQL-Prüfer `caretaker_private.has_premium`. Dessen private ACL bleibt erhalten.
Die 388 bestehenden Security-Advisories sind unverändert; keine neue Meldung.

Zusätzliche Ursache vor dem Rollout entdeckt und behoben: Der bestehende
RevenueCat-v2-Schlüssel „Supabase Ask Lotti“ hatte keine Produkt-Leserechte.
Nur **Products Configuration → Read only** ergänzt, bestehende Customer-information-
Leserechte erhalten. Der lesende Produktions-Preflight wechselte von HTTP 403 auf
HTTP 200 und erkannte ein tatsächlich bestehendes Apple-Standardabo korrekt.
Kein Schlüssel rotiert, keine Store-Preise oder Produkte verändert.

**Lokale Prüfungen:** 158 Jest-Tests bestanden (70 spezifisch für das tatsächlich
bereitgestellte Hotfix-Paket, 88 vorhandene Backend-/Familienregressionen).
Zusätzlich 101 Assertions mit dem tatsächlichen Hotfix-Resolver gegen einen
isolierten PostgreSQL/PGlite-Nachbau der am selben Tag live gelesenen acht Spalten,
Constraints und Fremdschlüssel. Alle zwölf Produkt-/Storekombinationen, Alt-Cache,
HTTP 401/403/404/429/500, Ablauf, Wiederherstellung, Compare-and-set und SQL-Rechte
abgedeckt. Dies sind lokale Provider-Fixtures, keine zwölf echten Store-Käufe.
Das separate Familien-QA-Projekt wurde für diesen Hotfix nicht verändert.

**Erneuter kostenloser Lite-Kauf erbracht:** Samsung SM-A528B, ADB `RZCT41N7CWR`,
Play-Version `1.0.23 (4)`, Installer `com.android.vending`. Kontoprüfung im Google-
Zahlungsmethodendialog: `jan.zepp1999@gmail.com`, ausgewählte „Testkarte, immer
genehmigt“, Kaufdialog „Dies ist ein Testabo“ und „Dir wird nichts in Rechnung
gestellt“. Kauf circa **06:58:36 UTC**; App anschließend **Lite · Monatsabo / Aktiv**.
Der echte Produktions-Webhook schrieb um **06:58:41.847 UTC** `tier=lite`,
`is_premium=false`, `product_id=lottibaby_lite:monthly`, Ablauf **07:03:36.162 UTC**.
Das App-Konto hat `is_admin=false`, keine Tester-/Partnerrolle. Um **06:59:33 UTC**
verweigerte der geschützte Produktionsprüfendpunkt mit demselben bereitgestellten
Resolver **fragLotti, fuersorge und voiceLog** jeweils mit `allowed=false`,
`reason=feature_disabled`, `tier=lite`. Kein kostenpflichtiger KI-Aufruf ausgelöst.

**Kündigung und Ablauf bestätigt:** Google Play zeigte „Gekündigt“ und das Ende
um 09:03 Uhr MESZ. Der Kündigungs-Webhook um **07:02:33.402 UTC** behielt korrekt
Lite bis zum bekannten Ablauf. Noch um **07:03:24 UTC** bestand nur Lite-Zugang.
Der Ablauf-Webhook schrieb um **07:03:45.412 UTC** `tier=null`, `is_premium=false`,
`product_id=null`, `expires_at=null`. Um **07:03:53 UTC** meldeten alle drei echten
Serverprüfungen `allowed=false`, `reason=not_entitled`, `tier=null`; die App zeigte
nach Rückkehr wieder die Paywall. Das Testabo wurde gekündigt und ist abgelaufen;
es gab keine reale Belastung. Alle drei seit dem Rollout empfangenen Webhook-
Ereignisse sind `completed`; keine neuen `failed`- oder `processing`-Ereignisse.

**Bestandsabgleich vollständig:** Vor Beginn 194 Cache-Zeilen gesichert, davon
122 mit gemeinsamer Entitlement-ID. Serieller Abgleich mit drei Sekunden Pause,
Einzelprotokoll und Checkpoint abgeschlossen um **07:03:50 UTC**: **122 erfolgreich,
0 offen**, tatsächliche Tarife **118 Standard, 3 Lite, 1 Premium**. Keine pauschale
Herabstufung; ein echter Premium-Zugang blieb Premium. Abschließende Live-Abfrage:
**0 gemeinsame Legacy-IDs übrig**. Eine Wiederholung um **07:04:39 UTC** verarbeitete
0 Konten erneut und bestätigte denselben vollständigen Abschluss.

**Weitere echte Produktionsprüfungen:** Je ein bestehendes reguläres Lite-,
Standard- und Premiumkonto ohne Sonderrolle wurde durch den bereitgestellten
Resolver geprüft. Lite/Standard: `fragLotti`, `fuersorge`, `voiceLog` gesperrt;
Premium: alle drei erlaubt mit `reason=revenuecat`. Zusätzlich stimmt der echte
SQL-Prüfer bei allen **122** aktiven regulären Konten mit dem Produkt-Tarif überein
(118 Standard, 3 Lite, 1 Premium). Diese Prüfungen führen keine KI-Generierung aus.

**Abgrenzung offener Gerätefälle:** Neuer Android-Store-Kauf für Standard/Premium,
Apple-Gerätekäufe, Jahreskäufe, Wiederherstellung über die Geräte-UI und reale
Store-Erstattungen wurden in diesem Auftrag nicht ausgeführt. Standard/Premium
sind lokal für beide Stores und serverseitig mit echten bestehenden Produktions-
abos geprüft; das ersetzt deren zusätzliche Geräte-/Store-Abnahmematrix nicht.
Die gezielte Produktionskorrektur einschließlich erneutem kostenlosem Android-
Lite-Kauf, Kündigung und Ablauf ist abgeschlossen.

Der temporäre `subscription-tier-repair`-Endpunkt und sein einzelnes
`SUBSCRIPTION_TIER_REPAIR_SECRET` wurden danach entfernt. Die vier korrigierten
Produktions-Deployments bleiben aktiv. Der Familienstand im Repository wurde
erhalten und um denselben Legacy-Cache-Schutz ergänzt; siehe die verbindliche
[technische Übergabe](../../supabase/hotfixes/subscription-tier/README.md#übergabe-an-den-familien-rollout).

Dauerhafter lokaler Nachweis: [bereinigter Testbericht](../../output/android-abo-hotfix-20260924/report.json)
und fünf Screenshots in `output/android-abo-hotfix-20260924/`. Private Sicherungen
und Einzelprotokolle bleiben unter `/tmp/lotti-abo-hotfix-20260924/`; temporäre
Schlüsseldateien wurden nach Abschluss gelöscht. Keine Kunden-IDs oder Secrets
im veröffentlichten Bericht/Repository.


## Historischer Android-Test am 24.09.2026 – vor dem Hotfix

### Technische Nachprüfung und erforderliche Korrektur

Der Fehler betrifft nicht die Google-Preis- oder Produktkonfiguration: Der Store-Kauf und die produktbasierte Anzeige im Android-Client waren korrekt. Die derzeit bereitgestellte Supabase-Funktion `_shared/premiumAccess.ts` fragt bei RevenueCat nur `active_entitlements` ab und ordnet die gemeinsame ID `entl7a7b4e9838` direkt `premium` zu. Für die Stufe muss stattdessen das aktuell zugangsberechtigte RevenueCat-Abonnement samt Store-Produktkennung ausgewertet werden. Die exakte Zuordnung für die sechs Apple- und sechs Google-Plan-IDs ist im Repository unter `supabase/functions/_shared/revenuecatState.ts` implementiert und getestet.

Ein korrigierter Webhook allein genügt nicht. Die bereitgestellten Functions `revenuecat-webhook`, `ask-lotti`, `advisor-generate` und `voice-log-parse` verwenden alle `_shared/premiumAccess.ts`; API-Aufrufe der drei Feature-Functions können den Cache erneut mit dem falschen Tarif beschreiben. Diese vier Deployments müssen denselben korrigierten Resolver erhalten. Neue Webhook-Ereignisse lösen keine nachträgliche Korrektur aller alten Cache-Einträge aus: Bei der lesenden Produktionsprüfung hatten 122 Zeilen `tier=premium`, `is_premium=true` und die gemeinsame Entitlement-ID als `product_id`. Die tatsächlichen Tarife dieser Konten sind aus dieser Tabelle nicht erkennbar. Alle 122 sind anhand von RevenueCat einzeln zu prüfen und mit `tier`, `is_premium`, echter Store-Produkt-ID und Ablauf zu aktualisieren; fehlgeschlagene Verifikationen dürfen nicht als bestätigtes Premium gelten.

Der vorbereitete Repository-Resolver kann **nicht isoliert** ausgerollt werden: Sein Sync schreibt `paid_*`-Spalten und seine Familienlogik benötigt `subscription_private` und `deletion_private`. In Produktion fehlen diese Spalten/Schemas, einschließlich der noch nicht angewandten Account-Deletion- und Familienabo-Migrationen. Für eine gezielte Reparatur der aktuellen Abos empfiehlt sich daher, die produktbasierte RevenueCat-v2-Auflösung in die derzeit bereitgestellte, zum alten Datenbankschema kompatible `_shared/premiumAccess.ts` zu übernehmen, alle vier Functions koordiniert zu deployen und anschließend die 122 Cache-Zeilen kontrolliert neu abzugleichen. Der umfassende Familienabo-Rollout bleibt ein separater Schritt mit seinen dokumentierten Vorbedingungen.

Abnahme nach dem Backend-Deploy: Lite auf dem Samsung erneut als kostenlosen Lizenztest kaufen; Android-Anzeige **Lite**, Datenbank `tier=lite`, `is_premium=false`, `product_id=lottibaby_lite:monthly` und keine Freigabe von `fragLotti` prüfen. Danach Kündigung/Ablauf und Entzug erneut verifizieren. Zusätzlich Standard und Premium mit Testnachweisen gegen die jeweilige Store-Produkt-ID prüfen. Diese Produktionskorrektur und erneute Kaufabnahme sind noch nicht erfolgt.

**Store-Kauf erfolgreich, Backend-Tarifzuordnung fehlgeschlagen.** Auf dem Samsung wurde die interne Play-Version `1.0.23 (4)` mit dem im Play Store ausgewählten Konto `jan.zepp1999@gmail.com` installiert. Nach Anmeldung in der Lotti-App lud die Paywall echte Google-Preise: Lite monatlich 4,99 EUR, Lite jährlich 44,99 EUR, Premium monatlich 9,99 EUR und Premium jährlich 99,90 EUR. Der Google-Dialog für **Lite monatlich** zeigte `jan.zepp1999@gmail.com` unter „Zahlungsmethoden“, die ausgewählte „Testkarte, immer genehmigt“ sowie ausdrücklich „Dies ist ein Testabo“ und „Dir wird nichts in Rechnung gestellt“. Der Testplan erneuerte sich alle 5 Minuten. Google bestätigte „Zahlung erfolgreich“; die App zeigte unter „Abo“ anschließend „Lite · Monatsabo“, Status „Aktiv“, Produkt-ID `lottibaby_lite`.

**Gefundener Produktionsfehler:** Der um 05:21:36 UTC zugestellte `revenuecat_webhook` schrieb in `public.lotti_subscription_entitlements` dennoch `tier = premium`, `is_premium = true` und als `product_id` die gemeinsame RevenueCat-Entitlement-ID `entl7a7b4e9838`. Diese Entitlement-ID steht für alle sechs Produkte und belegt keinen Premium-Tarif. Die Produktions-Feature-Matrix erlaubt `fragLotti` für Premium, aber nicht für Lite; die falsche Einstufung kann deshalb Premium-Funktionen freigeben. Der am 22.08.2026 zuletzt bereitgestellte Produktions-Webhook wurde zum Vergleich separat nach `/tmp/lotti-prod-webhook-audit-20260924/` heruntergeladen: Seine Funktion `_shared/premiumAccess.ts` ordnet die konfigurierte Entitlement-ID direkt dem Premium-Tarif zu. Das aktuelle Repository enthält in `_shared/revenuecatState.ts` bereits die produktbasierte Tier-Auflösung; sie ist Teil des noch nicht ausgerollten Familienabo-Backends und benötigt einen koordinierten Produktionsrollout gemäß [Familienabo-Rollout](../family-subscription-access.md#rollout). Ein bloßer Austausch der Live-Function gegen den aktuellen Repo-Stand wäre wegen der noch fehlenden Datenbankspalten kein sicherer Einzel-Deploy.

Der Testkauf wurde in Google Play über `jan.zepp1999@gmail.com` **gekündigt**; Play zeigte „Gekündigt“ und „Du hast dein Abo gekündigt“. Der Webhook schrieb um 05:30:49 UTC `tier = null`, `is_premium = false`, `expires_at = null`. Der Test hinterließ somit keinen aktiven serverseitigen Zugang. Es gab keine reale Belastung. Für die Android-Abnahme fehlen ein korrigierter Produktions-Backend-Rollout und ein erneuter Lite-Kaufversuch mit Nachweis `tier = lite`; die isolierte QA-APK konnte wegen unterschiedlicher Signatur und Kontowahl nicht für diesen Kauf verwendet werden. Alle sechs Google-Basispläne bleiben aktiv und alle sechs RevenueCat-Produkte zugeordnet.

Lokale Regression für die vorbereitete produktbasierte Tier-Auflösung: `npm test -- --runInBand --runTestsByPath lib/__tests__/revenuecatBackend.test.ts lib/__tests__/familySubscriptionBackend.test.ts` — **88 Tests bestanden**. Das bestätigt den Repository-Code, nicht den noch alten Produktions-Deploy.

## Vorheriger Zwischenstand am 24.09.2026

**Gerätetest begonnen, Kauf noch offen:** Das Samsung Galaxy SM-A528B (Android 14) ist jetzt per ADB autorisiert. Die isolierte QA-APK `1.0.23 (4)` wurde mit `adb install -r` über die vorhandene Version installiert; App-Daten blieben erhalten. Die vorher installierte APK wurde unter `/tmp/lotti-android-device-backup-20260924/base-v3.apk` gesichert. Nach Anmeldung mit einem QA-App-Konto und Abschluss des Onboardings wurde die Abo-Seite geöffnet. Sie zeigt für Lite „Preis derzeit nicht verfügbar“. RevenueCat meldet beim Abruf der Google-Produkte `StoreProblemError` / `SERVICE_UNAVAILABLE`; der BillingClient liefert Antwortcode `2` und Google Play protokolliert `BAD_AUTHENTICATION` für den Google-Play-OAuth-Token. Android zeigt zugleich „Anmeldung erforderlich“ für ein anderes Google-Konto. Der Kontoinhaber möchte dieses Konto nicht erneut anmelden, sondern für den Kauf `jan.zepp1999@gmail.com` verwenden. Dieses Konto ist im Play Store ausgewählt und hat am 24.09.2026 die Einladung zum internen Test angenommen; die Bestätigungsseite zeigt „You're a tester“. In Play Console stand die Adresse bereits in der E-Mail-Liste „Tester“, aber diese Liste war beim Lizenztest nicht aktiviert. Sie wurde aktiviert, gespeichert und nach dem Speichern als ausgewählt verifiziert; die bisherige Liste „Familienabo QA“ blieb aktiv. Nach einer Wartezeit und dem Leeren **nur des Play-Store-Caches** ist die interne Play-Store-Seite unter Jans Konto erreichbar. Sie zeigt die vorhandene App als nicht aus Play installiert und bietet deshalb derzeit nur „Deinstallieren“ an.

**Play-Version nun installiert; App-Anmeldung offen:** Laut [Googles Billing-Testanleitung](https://developer.android.com/google/play/billing/test) nutzt eine per APK installierte App ohne vorherigen Play-Download bei mehreren Gerätekonten das erste Google-Konto. Genau dieses Konto wurde laut Finsky-Gerätelog zuvor für `com.LottiBaby.app` gewählt; sein Token schlug mit `BAD_AUTHENTICATION` fehl. Die QA-APK ist mit dem Upload-Zertifikat signiert (`20:F2:A3:59:38:A9:0B:C2:E8:2B:06:95:49:B6:0D:E2:AA:2F:FC:D9:26:1A:13:C1:88:9F:5C:04:18:81:70:C2`), die Store-Version mit Googles App-Signing-Zertifikat (`6B:1E:78:B4:24:FC:F1:66:2D:6D:E0:F0:85:C3:50:DC:7D:DA:11:39:AB:9B:A3:AC:DB:43:4B:53:69:28:2C:FB`). Ein Update über die bestehende Installation war daher nicht möglich. Das Gerät unterstützt nur einen Android-Benutzer; `run-as` für eine Datensicherung scheiterte, da die Release-App nicht debuggable ist. Das installierte `adb` bietet `backup` nicht mehr an. Nach ausdrücklicher Freigabe des Kontoinhabers wurde die bisherige App deinstalliert und die interne Play-Version unter dem im Play Store ausgewählten Konto `jan.zepp1999@gmail.com` neu installiert. `dumpsys package` bestätigt Version `1.0.23 (4)`, Installationszeit 07:11 Uhr und Installer `com.android.vending`. Beim Start erscheint der App-Anmeldebildschirm; der Gastmodus benötigt eine QR-Einladung und führt nicht zur Abo-Seite. Der Kontoinhaber wurde gebeten, sich selbst direkt auf dem Gerät mit einem Lotti-App-Konto anzumelden. Bis dahin **kein Kaufdialog und kein Kauf**. Die Play-Version ist der vorhandene interne Release-Build und verwendet nicht das isolierte QA-Backend.

**Alle sechs Google-Basispläne sind aktiv.** Nach dem zuvor verlorenen Tab wurde `lottibaby_standard:monthly` neu geöffnet; dort waren keine ungespeicherten Änderungen mehr vorhanden. Anschließend wurden Standard monatlich/jährlich und Premium monatlich/jährlich vollständig bearbeitet, gespeichert und aktiviert. Die Google-Übersicht zeigt für Lite, Standard und Premium jeweils **2 aktive Basispläne**. Die Detailübersichten zeigen für jeden der vier neu fertiggestellten Pläne **157 Länder/Regionen** und den Status **Aktiv**.

Für jeden der vier Pläne wurden nach erneutem Laden alle **157 Zielpreise** gegen die aus App Store Connect ausgelesene Apple-Länderpreisliste geprüft: **keine Abweichung**. Die Play-Editoren zeigten jeweils „Deaktivieren“ und einen deaktivierten Button „Änderungen speichern“; es sind keine offenen Formularänderungen übrig. Lite monatlich/jährlich waren bereits zuvor ebenso mit jeweils 157/157 Preisen geprüft.

| Basisplan | Deutschland, gespeicherter Endpreis | Status | Geprüfte Zielpreise |
| --- | --- | --- | --- |
| Standard monatlich | 3,79 EUR | Aktiv | 157/157 |
| Standard jährlich | 39,99 EUR | Aktiv | 157/157 |
| Premium monatlich | 9,99 EUR | Aktiv | 157/157 |
| Premium jährlich | 99,90 EUR | Aktiv | 157/157 |

Alle sechs aktuellen Apple-Preislisten enthalten 175 Länder. Google hat 173 konkrete Preisregionen plus eine automatische Verfügbarkeit für neue Regionen. Nach Zuordnung unterschiedlicher Ländernamen überschneiden sich **157 Regionen**. Je Plan stimmen 130 Währungen zwischen den Stores überein; dort wurden die Apple-Endbeträge übernommen. Bei 27 Regionen unterscheiden sich die Store-Währungen; diese Preise wurden umgerechnet. Die vier neuen Zielmatrizen und Apple-Listen liegen lokal unter `/tmp/lotti-android-prices-20260923/`.

Bei allen sechs Basisplänen sind ausschließlich die 157 gemeinsamen Regionen ausgewählt. Die 16 Google-Regionen ohne Apple-Pendant sowie die automatische Freigabe neuer Regionen wurden abgewählt: Aruba, Bangladesch, Dschibuti, Eritrea, Gibraltar, Guinea, Haiti, Komoren, Liechtenstein, Monaco, Samoa, San Marino, Somalia, Togo, Vatikanstadt, Zentralafrikanische Republik. Die 18 Apple-Regionen ohne entsprechendes Google-Preisfeld sind Afghanistan, Anguilla, Barbados, Bhutan, Brunei, China (Festland), Eswatini, Guyana, Kosovo, Madagaskar, Malawi, Mauretanien, Montenegro, Montserrat, Nauru, Palau, São Tomé und Príncipe und St. Vincent und die Grenadinen.

Währungsumrechnung: Apple-Landesbetrag × Zielwährungskurs / Apple-Währungskurs; gerundet auf die von Google akzeptierte Preisgenauigkeit, ohne zusätzliche Steueraufschläge auf den Apple-Endbetrag. Quelle: [Rates by ExchangeRate-API](https://www.exchangerate-api.com), [öffentlicher USD-Endpunkt](https://open.er-api.com/v6/latest/USD), Datenstand 21.09.2026 00:02:31 UTC, lokal zwischengespeichert unter `/tmp/lotti-android-prices-20260921/fx.json`. JOD akzeptiert bei dieser Eingabe 0,01 trotz dreistelliger Anzeige; RSD/MMK/IQD/XAF/XOF/PYG wurden entsprechend Googles Preisfeldern auf ganze Einheiten gerundet. Bei unterschiedlichen Währungen sind die nominalen Beträge nicht gleich.

**RevenueCat erneut geprüft:** Im Offering `default` sind alle sechs Google-Store-IDs an die dokumentierten Packages gebunden; das Entitlement `LottiBabyAbo` enthält ebenfalls alle sechs. Es wurde nichts am RevenueCat-Katalog geändert.

Der aktive interne Play-Testtrack enthält Release `1.0.23 (4)` vom 11.09.2026; die isolierte QA-APK mit QA-Backend und Google-RevenueCat-Key wurde nicht in den Testtrack hochgeladen. Laut [Google-Dokumentation zum Billing-Test](https://developer.android.com/google/play/billing/test) dürfen Lizenztester eine App mit gleichem Paketnamen auch für Testkäufe per Sideload installieren; ein neuer Store-Upload ist dafür nicht zwingend. Bei mehreren Google-Konten verwendet Play für einen Kauf das Konto, das die App heruntergeladen hat, sonst das erste Konto auf dem Gerät. Vor dem Testkauf ist deshalb zusätzlich das tatsächlich verwendete Lizenztestkonto im Kaufdialog zu kontrollieren.

## Historischer Zwischenstand am 21.09.2026

Der Kontoinhaber hat die Fertigstellung einschließlich Länderpreisabgleich, Aktivierung und Android-Test beauftragt. Die bisher offene Rückfrage ist damit nicht erneut als Freigabehürde zu behandeln: Apple-Landespreise übernehmen, bei unterschiedlichen Store-Währungen die notwendige Umrechnung gesondert dokumentieren.

Live erneut geprüft: Google zeigt weiterhin drei Produkte mit jeweils **0 aktiven Basisplänen**. Lite monatlich ist `Entwurf`; Deutschland 4,99 EUR, Australien 8,99 AUD, Kanada 7,99 CAD und Schweiz 4,70 CHF. Damit sind die früheren Google-Umrechnungen weiterhin vorhanden; z. B. Australien wich vom am 16.09. gelesenen Apple-Preis 5,99 AUD ab. Noch keine Aktivierung vorgenommen.

RevenueCat: Alle sechs Google-Produkte sind weiterhin korrekt im Offering `default` und am Entitlement `LottiBabyAbo` zugeordnet. Apple App Store Connect verlangt inzwischen eine erneute Anmeldung; der Kontoinhaber wurde gebeten, den geöffneten Login-Tab zu verwenden. Der vollständige aktuelle Länderpreisabgleich ist bis dahin blockiert.

Android-Testvoraussetzungen: In `.env.local` ist der bevorzugte Android-SDK-Key leer, der Legacy-Key fehlt. Das vorhandene Profil `family-qa-android` enthält hingegen einen Google-SDK-Key; laut `docs/family-qa-setup.md` existiert bereits ein fertiger isolierter QA-Build. `adb` wurde weder im PATH noch an den dokumentierten beziehungsweise üblichen lokalen SDK-Pfaden gefunden. Kein Geräte- oder Kaufnachweis in dieser Fortsetzung; kein neuer Build und keine Änderung an Store-SDK-Schlüsseln.

Lokale Validierung: `revenuecat.test.ts` und `revenuecatProducts.test.ts` im aktuellen Root-Projekt gezielt ausgeführt: **85 Tests bestanden**, QA-Buildkopien vom Testlauf ausgeschlossen. Diese Tests prüfen Clientlogik und Produktauflösung; sie ersetzen weder Store-Preisabruf noch einen Google-Testkauf.

## Einrichtungsstand vom 16.09.2026

Stand: 16.09.2026. **Drei Google-Produkte und sechs Basispläne gespeichert, nach RevenueCat importiert und vollständig zugeordnet. Alle sechs Basispläne sind noch Entwürfe.** Euro-Endpreise sind exakt auf die bestätigten Apple-Beträge gesetzt. Internationale Endpreise und Aktivierung bleiben offen; kein Android-Kauf-/Preisladetest nachgewiesen.

## Entscheidung

Der Kontoinhaber hat für Android dieselben Preise und Verkaufsregionen wie bei Apple vorgegeben. Nach seiner Anmeldung wurden am 16.09.2026 alle sechs Apple-Produkte ausgelesen. Jedes zeigt „Alle Länder oder Regionen ausgewählt“; der Abschnitt „Aktueller Preis für neue Abonnent:innen“ umfasst jeweils 175 Länder/Regionen. Die Ersatzpreise im Repository sind keine geeignete Quelle.

| Tarif | Deutscher Endpreis pro Monat | Deutscher Endpreis pro Jahr | Apple-IDs Monat / Jahr |
| --- | --- | --- | --- |
| Lite | 4,99 EUR | 44,99 EUR | `6789575393` / `6789575852` |
| Standard | 3,79 EUR | 39,99 EUR | `6756303566` / `6760190472` |
| Premium | 9,99 EUR | **99,90 EUR** | `6789573652` / `6789574153` |

Quelle: jeweilige Produktseite unter `https://appstoreconnect.apple.com/apps/6745569710/distribution/subscriptions/{Apple-ID}`, Abschnitt „Aktueller Preis für neue Abonnent:innen“, Zeile Deutschland (EUR). Standard ist tatsächlich günstiger als Lite. Premium jährlich ist 99,90 EUR, nicht der Ersatzpreis 99,99 EUR.

Apple führt außerdem bei allen sechs Produkten 175 Einführungsangebote auf; die sichtbaren Länderzeilen zeigen eine kostenlose erste Woche. Bisher sind für Android reguläre Basispläne ohne Trial/Rabatt vorgesehen.

**Offene regionale Umsetzung:** Der Kontoinhaber bekräftigte „genau den gleichen Preis“. Die Euro-Endpreise wurden deshalb direkt gesetzt. Andere Währungen enthalten im Entwurf vorläufig Google-berechnete Preise und sind **nicht** als identische Apple-Preise bestätigt. Beispiel Lite monatlich: Apple Australien 5,99 AUD; Google-Berechnungen basieren zunächst auf der EUR-Eingabe. Apple benutzt außerdem für mehrere Länder USD, während Google dort eine andere Währung verwendet. Vor Aktivierung muss geklärt werden: zunächst nur Euro-Verkaufsregionen oder Apple-Landespreise einzeln übernehmen und bei abweichenden Store-Währungen umrechnen. Diese Frage wurde gestellt. Keine automatische Umrechnung als exakt identische Apple-Preisliste ausgeben.

**Google-Preiswerkzeug:** „Set prices“ erzeugte für Deutschland aus 4,99 EUR zunächst 5,99 EUR. Alle Euro-Endpreise wurden anschließend über die direkte Preiszellenbearbeitung korrigiert. Pro Basisplan wurden 34 Euro-Preiszeilen kontrolliert, einschließlich der Gruppe „Andere Länder/Regionen (EUR)“ mit Island und Malta. Die Basispläne sind gespeichert; nicht aktiviert. Nach Berechnungen daher immer den tatsächlichen Endpreis prüfen; Eingabewert nicht mit Endpreis gleichsetzen.

## Ausgeführt und in Google Play verifiziert

In App `4974510685496048236`, Paket `com.LottiBaby.app`, wurden diese drei Produkte angelegt:

| Name | Tatsächliche Google-Produkt-ID | Gespeicherte Basispläne | Aktive Basispläne |
| --- | --- | --- | --- |
| Lotti Baby Lite | `lottibaby_lite` | `monthly`, `yearly` | 0 |
| Lotti Baby Standard | `lottibaby_standard` | `monthly`, `yearly` | 0 |
| Lotti Baby Premium | `lottibaby_premium` | `monthly`, `yearly` | 0 |

[Google-Aboliste](https://play.google.com/console/u/1/developers/5489758252378517452/app/4974510685496048236/subscriptions) zeigte alle drei Produkte. Alle sechs Basispläne wurden nach dem Speichern als `Entwurf monthly` beziehungsweise `Entwurf yearly` verifiziert; RevenueCats anschließender Import bestätigte alle sechs als `Draft`. Monatlich beziehungsweise jährlich, automatische Verlängerung, keine Ratenzahlung, keine Testphasen/Rabatte. Google-Defaults: 7 Tage Kulanz, automatisch berechnete Kontosperre, Wiederabonnieren erlaubt. Der Länderentwurf umfasst laut Planübersicht 174 Länder/Regionen. Das ist noch kein bestätigter Abgleich mit Apples 175 Regionen.

## RevenueCat eingerichtet und geprüft

- Projekt `46375297`, Google-App `appa49481b191`, Paket `com.LottiBaby.app`: **Valid credentials**, **Connected to Google**; letzte empfangene Google-Benachrichtigung laut UI 14.09.2026, 20:12 UTC.
- Alle sechs Google-Produkte über den Play-Store-Import importiert.
- Offering `default` / `ofrng1c52465aed`: sechs Google-Primary-Produkte an die bestehenden Packages gebunden. Speichern erfolgreich; auf der Offering-Detailseite alle sechs Bindungen erneut gelesen. Apple-Produkte, Package-IDs und Beschreibungen erhalten. Kein zusätzliches Offering angelegt.
- Gemeinsames Bestands-Entitlement `LottiBabyAbo` / `entl7a7b4e9838`: alle sechs Google-Produkte zusätzlich angehängt und auf der Detailseite verifiziert. Bestehende Apple-Produkte erhalten. Produktbasierte Tarifauflösung gemäß Client und Backend; keine separate Entitlement-Migration vorgenommen.

| Google-/RC-Store-ID | RC-REST-Produkt-ID | Package in `default` |
| --- | --- | --- |
| `lottibaby_lite:monthly` | `prod7a1f1fb4b8` | `lite_monthly` |
| `lottibaby_lite:yearly` | `prod318ac02121` | `lite_yearly` |
| `lottibaby_standard:monthly` | `prod882c34644e` | `$rc_monthly` |
| `lottibaby_standard:yearly` | `prod15f14f53ca` | `$rc_annual` |
| `lottibaby_premium:monthly` | `proda96d131ba6` | `premium_monthly` |
| `lottibaby_premium:yearly` | `prod1ff077509d` | `premium_yearly` |

## Noch offen

1. Den produktiven Tier-Fehler gezielt beheben und koordiniert ausrollen. Das bereits vorbereitete Familienabo-Backend verlangt die dokumentierten Datenbank- und Function-Voraussetzungen; keinen ungeprüften vollständigen Migration-Push und keinen isolierten Function-Deploy vornehmen.
2. Danach erneut einen eindeutig kostenlosen Google-Testkauf von Lite durchführen und verifizieren: Google-Konto und Testkarte, App-Tarif Lite, serverseitig `tier = lite` und keine Freigabe von Premium-only-Features. Auch Kündigung und Ablauf erneut prüfen. Das andere Google-Konto nicht erneut anmelden oder verändern.

Offizielle Referenz: [RevenueCat Google Play Product Setup](https://www.revenuecat.com/docs/getting-started/entitlements/android-products), am 16.09.2026 geprüft: Google-Basispläne entsprechen RC-Produkten im Format `subscription_id:base-plan-id`.
## Familienzugang-QA am 24.09.2026

Der neue QA-Build **1.0.23 (6)** wurde über den internen Play-Testtrack als
datenbewahrendes Update auf dem Samsung installiert. Mit einem normalen
QA-App-Konto wurde **Premium monatlich** über Googles ausdrücklich kostenlose
Testkarte gekauft. Die App zeigte Premium; der isolierte QA-Tarifcache bestätigte
`lottibaby_premium:monthly` und `paid_tier=premium`. Eine neue Partner-Einladung
mit QR-Code wurde auf dem iPhone mit eigenem QA-Konto eingelöst. Nach Ablauf
der beschleunigten ersten Testsubscription wurde ein zweiter kostenloser
Premium-Testkauf durchgeführt. Das QA-Backend bestätigte `tier=premium` für
den iPhone-Partner; auf dem iPhone war Premium ohne Kauf-Paywall sichtbar.
Installiert waren Android **1.0.23 (6)** und TestFlight iOS **1.0.24 (1.0.60)**.
Nach natürlichem Sandbox-Ablauf zeigte Play **0 aktive Abos**; das QA-Backend
entzog den Familienzugang und auf dem iPhone war Premium wieder gesperrt.

Diese Ergebnisse betreffen ausschließlich Supabase-QA `ggyonianphloycmqrwvj`
und den internen Play-Track, nicht den produktiven Familienzugang. Der
Produktions-Rollout bleibt bis zur vollständigen isolierten Abnahme gesperrt.
Details und offene Fälle: [Familienabo-Protokoll vom 24.09.](../family-subscription-test-report-20260924.md).
