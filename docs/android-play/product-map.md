# Produkt- und Berechtigungszuordnung

**24.09.2026 – Produktionskorrektur abgeschlossen:** Produktbasierte Tarifauflösung in allen vier betroffenen Functions ausgerollt, 122/122 Legacy-Einträge abgeglichen. Kostenloser Android-Lite-Kauf, korrekte Serversperren, Kündigung und Ablauf nachgewiesen. Aktuelle Versionen und verbleibende weitere Gerätefälle: [Schritt 10](step-10.md). Die folgenden Einrichtungsstände bleiben historisch.

Fortsetzung 23.09.2026: **Alle sechs Google-Basispläne sind aktiv.** Je Plan sind 157 gemeinsame Verkaufsregionen freigegeben. Die vier nun abgeschlossenen Standard- und Premium-Pläne wurden nach erneutem Laden mit jeweils 157/157 passenden Zielpreisen geprüft; Lite war bereits ebenso geprüft. Je Plan wurden 130 Preise in gleicher Store-Währung von Apple übernommen und 27 in Googles abweichende Store-Währung umgerechnet. Alle sechs RevenueCat-Package- und Entitlement-Bindungen sind eingerichtet. Ein Android-Testkauf steht noch aus, weil das per USB sichtbare Samsung-Gerät nicht in ADB erscheint. Siehe [aktuellen Fortsetzungsstand und offene Arbeit](step-10.md).

## Historischer Einrichtungsstand vom 16.09.2026

Die Google-Produkte `lottibaby_lite`, `lottibaby_standard` und `lottibaby_premium` sind angelegt, jeweils mit gespeicherten Basisplänen `monthly` und `yearly`. **Alle sechs sind noch Entwürfe, nicht aktiv/kaufbar.** Der Kontoinhaber hat gleiche Preise wie Apple verlangt. Die Apple-EUR-Endpreise wurden live geprüft und in allen 34 Google-Euro-Preiszeilen je Plan exakt gesetzt. Nicht-Euro-Preise sind bislang nur Google-berechnete Entwurfswerte; deren Angleichung sowie die Behandlung unterschiedlicher Store-Währungen bleiben vor Aktivierung offen.

RevenueCats Google-App `appa49481b191` ist verbunden und zeigt gültige Credentials. Alle sechs Google-Produkte sind importiert, an das bestehende Entitlement `LottiBabyAbo` (`entl7a7b4e9838`) angehängt und im Offering `default` (`ofrng1c52465aed`) den unten genannten Packages zugeordnet. Die gespeicherte Zuordnung wurde auf den Detailseiten geprüft. Bestehende Apple-Bindungen bleiben erhalten; die Tarifauflösung erfolgt produktbasiert. Kein Android-Preisladetest oder Testkauf nachgewiesen. Details und Fortsetzung: [step-10.md](step-10.md).

| Tatsächliche Google-/RC-Store-ID | RC-REST-Produkt-ID | Package in `default` | Gespeicherter Euro-Endpreis |
| --- | --- | --- | --- |
| `lottibaby_lite:monthly` | `prod7a1f1fb4b8` | `lite_monthly` | 4,99 EUR / Monat |
| `lottibaby_lite:yearly` | `prod318ac02121` | `lite_yearly` | 44,99 EUR / Jahr |
| `lottibaby_standard:monthly` | `prod882c34644e` | `$rc_monthly` | 3,79 EUR / Monat |
| `lottibaby_standard:yearly` | `prod15f14f53ca` | `$rc_annual` | 39,99 EUR / Jahr |
| `lottibaby_premium:monthly` | `proda96d131ba6` | `premium_monthly` | 9,99 EUR / Monat |
| `lottibaby_premium:yearly` | `prod1ff077509d` | `premium_yearly` | 99,90 EUR / Jahr |

## Historischer Bestandsbericht vom 10.09.2026

Die folgenden Bestandsangaben beschreiben den früheren Zustand und werden durch den aktuellen Einrichtungsstand oben ersetzt. Insbesondere sind die Google-IDs, Basispläne und RevenueCat-Zuordnungen jetzt tatsächlich angelegt.

Stand: 10.09.2026, read-only geprüft. Arbeitsstand: Branch `main`, HEAD `0adbccd` plus vorhandene lokale Änderungen. Abschluss und Änderungsinventar: [step-01.md](step-01.md).

## Client-Fortschritt nach Schritt 3

Die Android-Zuordnung und Kauf-/Preisvalidierung sind im Client umgesetzt; Details, Tests und Grenzen stehen in [step-03.md](step-03.md). G03–G05 und G07–G09 haben damit einen lokalen Implementierungsstand. Google-Produkte/Preise bleiben bis zur Einrichtung in Schritt 10 unbestätigt. Laufende Abos sperren auf Android weitere Käufe; ein Google-Replacement-Pfad ist mangels bestätigter Abrechnungsentscheidung nicht freigegeben. Der nachfolgende Bestandsbericht beschreibt weiterhin die read-only Aufnahme aus Schritt 1.

## Verbindliche Grundlage für die Folgeaufträge

Die sechs fachlichen Kombinationen sind `lite|standard|premium` × `monthly|yearly`. Laufzeiten ändern keine Feature-Berechtigungen. Bestehende iOS-Produkt-IDs, Package-IDs und das Offering `default` bleiben erhalten. Google-Produkte werden später an die vorhandenen Packages angebunden. In Schritt 1 wurde weder ein Produkt noch ein Entitlement angelegt oder verändert.

**Wichtige Abweichung zwischen Code und Dashboard:** Im RevenueCat-Projekt `46375297` existiert im Entitlement-Katalog, auch mit Filter **All**, nur `LottiBabyAbo` (`entl7a7b4e9838`). Daran hängen alle sechs iOS-Produkte. `LottiBabyLite` und `LottiBabyPremium` sind im Client vorgesehen, im Dashboard aber nicht vorhanden. Die drei Namen dürfen deshalb nicht als bereits eingerichtete Freischaltungen behandelt werden. [Live-Entitlement](https://app.revenuecat.com/projects/46375297/product-catalog/entitlements/entl7a7b4e9838)

## Gemeinsame Produktmatrix

Alle Google-Spalten sind **Vorschlag / noch nicht angelegt**. Im geprüften Play-Konto gibt es noch keine App und damit keine vorhandenen Lotti-Baby-Abos oder Basispläne zum Übernehmen. Vor einer späteren Anlage den Bestand erneut lesen; zwischenzeitlich angelegte gültige IDs haben Vorrang.

| Tarif / Plan-Key im Client | Laufzeit | Bestehende iOS-Produkt-ID | Google-Abo-ID (Vorschlag) | Basisplan (Vorschlag) | RC-Google-Produkt (Vorschlag) | Bestehendes RC-Package in `default` | Fachliche Freischaltung / Ziel-Entitlement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lite / `liteMonthly` | Monat / `monthly` | `lottibaby_lite_monthly` | `lottibaby_lite` | `monthly` | `lottibaby_lite:monthly` | `lite_monthly` | `lite` / `LottiBabyLite` **fehlt** |
| Lite / `liteYearly` | Jahr / `yearly` | `lottibaby_lite_yearly` | `lottibaby_lite` | `yearly` | `lottibaby_lite:yearly` | `lite_yearly` | `lite` / `LottiBabyLite` **fehlt** |
| Standard / `standardMonthly` | Monat / `monthly` | `lottibaby_monthly` | `lottibaby_standard` | `monthly` | `lottibaby_standard:monthly` | `$rc_monthly` | `standard` / `LottiBabyAbo` **vorhanden, derzeit gemeinsam** |
| Standard / `standardYearly` | Jahr / `yearly` | `lottibaby_yearly` | `lottibaby_standard` | `yearly` | `lottibaby_standard:yearly` | `$rc_annual` | `standard` / `LottiBabyAbo` **vorhanden, derzeit gemeinsam** |
| Premium / `premiumMonthly` | Monat / `monthly` | `lottibaby_premium_monthly` | `lottibaby_premium` | `monthly` | `lottibaby_premium:monthly` | `premium_monthly` | `premium` / `LottiBabyPremium` **fehlt** |
| Premium / `premiumYearly` | Jahr / `yearly` | `lottibaby_premium_yearly` | `lottibaby_premium` | `yearly` | `lottibaby_premium:yearly` | `premium_yearly` | `premium` / `LottiBabyPremium` **fehlt** |

Package- und iOS-Bindungen wurden in [Offering `default`](https://app.revenuecat.com/projects/46375297/product-catalog/offerings/ofrng1c52465aed) geprüft. REST-ID des Offerings: `ofrng1c52465aed`; Anzeigename „Monatliches Abo“, tatsächlich sechs Packages. Alle sechs Package-Zeilen enthalten derzeit ausschließlich ein App-Store-Produkt. Kein neues `standard_monthly`/`standard_yearly`-Package erfinden und die Standard-Packages nicht Premium zuordnen.

RevenueCat bildet neue Google-Produkte auf Basispläne ab und verwendet dafür `<subscription_id>:<base-plan-id>`; alte Integrationen können nur die Abo-ID enthalten. Diese RC-Produkt-ID ist von Package-ID, Google-Abo-ID und Entitlement-ID zu unterscheiden. [Offizielle Google-Produktdarstellung](https://www.revenuecat.com/docs/getting-started/entitlements/android-products)

### Bestehende Entitlement-Bindungen und Übergang

| Fachlicher Tarif | Live-Bindung aller zugehörigen iOS-Produkte | Client heute | Backend heute / nötiger Abgleich |
| --- | --- | --- | --- |
| Lite | `LottiBabyAbo` / `entl7a7b4e9838` | Erkennt Lite anhand exakter iOS-Produkt-ID innerhalb des gemeinsamen Entitlements | Nur Entitlement-ID wird ausgewertet; gemeinsame ID allein kann Lite nicht unterscheiden |
| Standard | `LottiBabyAbo` / `entl7a7b4e9838` | Bestehende monatliche/jährliche IDs ergeben Standard | `REVENUECAT_STANDARD_ENTITLEMENT_ID` wäre für diese Live-ID zuständig; tatsächlicher Secret-Wert nicht geprüft |
| Premium | `LottiBabyAbo` / `entl7a7b4e9838` | Erkennt Premium anhand exakter iOS-Produkt-ID innerhalb des gemeinsamen Entitlements | Nur Entitlement-ID wird ausgewertet; gemeinsame ID allein kann Premium nicht unterscheiden |

Der gemeinsame Vertrag ist **aktiver Kauf der Tabellenzeile → deren Tarif**, nicht „jedes aktive `LottiBabyAbo` ist Standard/Premium“. Für bestehende iOS-Abos bleibt die Produktzuordnung als Kompatibilitätspfad nötig. Ein künftiger separater Lite-/Premium-Entitlement-Aufbau muss Bestandskäufe berücksichtigen; bestehende Bindungen in diesem Bestandsauftrag nicht entfernen. Schritt 4 muss eine kompatible serverseitige Produktauflösung beziehungsweise eine konkrete Entitlement-Migration vorbereiten, Schritt 9 diese gezielt in Betrieb nehmen. Bis dahin ist die Backend-Zuordnung ein Release-Blocker.

Client-Schlüssel (`LottiBabyAbo`) sind nicht REST-IDs (`entl7a7b4e9838`). Das Backend liest `/v2/projects/{project}/customers/{user}/active_entitlements` und vergleicht `entitlement_id` mit den `REVENUECAT_*_ENTITLEMENT_ID`-Werten. Für Lite/Premium gibt es noch keine nachgewiesenen eigenen REST-IDs. **Keinesfalls dieselbe gemeinsame REST-ID für alle drei Tiers setzen:** `entitlementTier()` prüft Premium zuerst und würde alle Treffer Premium zuordnen.

## Preise, Testphasen und Regionen

| Kombination | Im Repository vorhandener EUR-Ersatzpreis | Verifizierter aktueller Google-Verkaufspreis | Google-Testangebot / Offer-ID | Aktive Google-Verkaufsregionen |
| --- | --- | --- | --- | --- |
| Lite monatlich | 4,99 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |
| Lite jährlich | 44,99 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |
| Standard monatlich | 3,79 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |
| Standard jährlich | 39,99 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |
| Premium monatlich | 9,99 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |
| Premium jährlich | 99,99 € | offen | offen / nicht angelegt | keine konfiguriert; Zielregionen offen |

Die erste Preisspalte ist ausschließlich ein Codebefund aus `lib/paywallDefaults.ts`, **keine Preisfreigabe**. Lite ist dort monatlich teurer als Standard; das wird nicht stillschweigend korrigiert. `app/paywall.tsx:buildPlanPrices()` nutzt diese Werte, wenn SDK-Preise fehlen. Ein Folgeauftrag darf sie nicht als bestätigte Google-Preise anzeigen oder in Play übernehmen.

Die geprüfte [RC-Produktdetailseite für Standard monatlich](https://app.revenuecat.com/projects/46375297/product-catalog/products/prodd3f3c81bfb) bestätigt App Store, Subscription und Status `Approved`, zeigt aber keine vollständige regionale Preisliste/Testangebotskonfiguration. Aktuelle iOS-Listenpreise, vollständige aktive iOS-Regionen und Testberechtigung je Produkt bleiben daher offen. In der [RevenueCat-Übersicht](https://app.revenuecat.com/overview) waren einzelne deutsche iOS-Transaktionen zu 3,79 € (Standard monatlich), 9,99 € (Premium monatlich) und einzelne siebentägige Trials sichtbar. Das sind Transaktionsbeobachtungen, keine vollständige aktuelle Angebotsmatrix und keine Grundlage für Google-Preise oder Google-Testphasen. Keine Kundenkennungen werden hier übernommen.

`DEFAULT_PAYWALL_TRIAL_DAYS = 14` und die editierbaren Paywall-Texte beweisen keinen Store-Trial. `lib/paywall.ts` gewährt ausdrücklich keinen freien Zugang nur aufgrund des Kontoalters; `isTrialExpired` ist ein Legacy-Name für fehlenden Zugang. Der Default `trial_fallback` in `subscriptionAccess.ts` ist ebenfalls kein gekaufter Tarif. Für die spätere Einrichtung sind pro Basisplan bestätigte Preise/Währungen, Regionen und Verlängerungsart nötig; Testphasen/Rabatte nur nach tatsächlicher Entscheidung und Store-Nachweis.

## Feature-Freischaltung

Tarifreihenfolge: `premium > standard > lite`, bei mehreren aktiven Berechtigungen höchste gültige Stufe. Ein abgelaufenes/fehlendes Abo ist **kein Lite-Abo**. Sonderrollen sind keine Store-Produkte: Admin/Premiumtester → Premium, Lite-Tester → Lite, Tester/Kooperationspartner → Standard (`lib/paywallAccess.ts`, `lib/subscriptionAccess.ts`, Backend `specialTier()`).

Folgende Matrix ist der **eingebettete Default**, nicht als geprüfte Live-DB-Policy zu verstehen. Die veröffentlichte Matrix kommt aus `subscription_plan_features`/`subscription_policy_state`; deren aktuelle Inhalte wurden nicht ausgelesen.

| Feature-Schlüssel | Lite | Standard | Premium |
| --- | --- | --- | --- |
| `basisTracker`, `partnerLink`, `planner`, `shoppingList`, `recipes` | ja | ja | ja |
| `wochenmomente`, `pdfExport`, `fullHistory`, `sleepMonthView`, `dailyMonthView` | nein | ja | ja |
| `voiceLog`, `fuersorge`, `fragLotti`, `pregnancyBriefing` | nein | nein | ja |

Quelle: `lib/subscriptionFeaturePolicy.ts:DEFAULT_FEATURE_MATRIX`. Client-Featurematrix und Cache sind kein serverseitiger Kaufnachweis. Die Edge-Funktionen `ask-lotti`, `voice-log-parse`, `advisor-generate` und `advisor-daily` verwenden im Repository `verifySubscriptionFeatureAccess()` und die veröffentlichte DB-Matrix.

## Dashboard- und Umgebungsbestand

| Bereich | Read-only-Befund | Grenze / Folgeauftrag |
| --- | --- | --- |
| [Play Console, Konto Lotti Baby](https://play.google.com/console/u/1/developers/5489758252378517452/app-list) | Privates Konto; „Du hast noch keine Apps erstellt“; Identität wird geprüft, Telefonbestätigung abhängig davon; „App erstellen“ deaktiviert | Keine App-/Produktanlage. Schritte 7/8. Keine Aussage über Google-Genehmigung des Kontotyps für Gesundheitsfunktionen |
| [RC Apps](https://app.revenuecat.com/projects/46375297/apps) | Nur `Lotti Baby (App Store)`, App-ID `appd13f4c6d23`, Bundle `com.LottiBaby.app`; Testkonfiguration separat | Keine Google-App vorhanden. UI meldet fehlende Berechtigung zum Hinzufügen von App-Konfigurationen; Schritt 9 benötigt entsprechenden Zugriff |
| RC Offering | `default`, sechs bestehende Packages mit den iOS-Bindungen oben | Google-Slots fehlen; Schritt 10 |
| RC Entitlements | Nur `LottiBabyAbo`, sechs iOS-Produkte; auch Filter `All` geprüft | Lite/Premium-Abweichung beheben, Bestandszugang erhalten; Schritte 4/9 |
| [RC Webhook-Details](https://app.revenuecat.com/projects/46375297/integrations/webhooks/whintgr0477099de6) | „Supabase Premium Sync“ aktiv zum bestehenden `revenuecat-webhook`; HMAC aktiviert; `Both Production and Sandbox`, `All apps`, `All events`. Ereignisliste zeigt `Sent`, zuletzt sichtbar 10.09.2026, 11:50 UTC | Versandnachweis vorhanden, korrekte Tarifcache-Aktualisierung nicht geprüft. Keine Testevents ausgelöst, keine Secrets geändert |
| [Supabase Functions](https://supabase.com/dashboard/project/kwniiyayhzgjfqjsjcfu/functions) | 14 Functions; `revenuecat-webhook` vorhanden, Anzeige „19 days ago“; auch vier oben genannte Feature-Endpunkte vorhanden | Deployed-Code nicht vollständig mit dem Arbeitsstand verglichen; Migrationen, Live-Matrix und Secret-Werte nicht geprüft |
| [Webhook Settings](https://supabase.com/dashboard/project/kwniiyayhzgjfqjsjcfu/functions/revenuecat-webhook/details) | „Verify JWT with legacy secret“ aus, passend zu lokalem `verify_jwt = false` | Eigene sichere Webhook-Authentifizierung weiterhin erforderlich |
| Supabase MCP | Liefert andere Projekte; Zugriff auf das in `lib/supabase.ts` verwendete `kwniiyayhzgjfqjsjcfu` verweigert | Browserzugriff funktioniert; kein Ersatzprojekt verwendet, keine DB geschrieben |
| Lokale SDK-Umgebung | `.env.local`: iOS-Key mit `appl_` vorhanden, Android-Key leer | Keine Schlüsselwerte kopiert. EAS-Umgebungen `development`, `preview`, `production` nicht live geprüft |

## Implementierung und konkrete Lücken

| ID | Befund und Auswirkung | Zuständig / erforderlicher Nachweis |
| --- | --- | --- |
| G01 | Play-App, drei Google-Abos/sechs Basispläne, RC-Google-App und Package-Bindungen fehlen nach Dashboard-Bestand | 7–10: reale Ressourcen erst nach Voraussetzungen anlegen; Matrix aktualisieren |
| G02 | Preise, Regionen, Verlängerung und optionale Trial-Angebote sind nicht für Google bestätigt | 10: belegte Produktentscheidung und aktive Store-Konfiguration |
| G03 | `lib/revenuecat.ts` sucht und bepreist ausschließlich sechs exakte iOS-IDs; keine Basisplanauflösung. Google-Tier/Intervall kann `null`/`unknown` werden | 3: Matrix nutzen; installierte SDK-Typen/echte Payloads prüfen; Android- und iOS-Tests |
| G04 | Kauf sucht Packages nach Produkt-ID, Preisanzeige separat über `getProducts()`. Fallbackpreise sind nicht als unbestätigt markiert; CTA prüft nicht je Plan dessen geladenes Angebot | 3: Preis und Kauf aus demselben passenden Store-Angebot, fehlende Angebote sperren |
| G05 | Fehlender Android-Key wird erkannt; fremde/test-Keys auf Android werden aber nicht wie iOS geprüft. Config-Plugin warnt nur, wenn beide Keys fehlen, und prüft Release-Test-Key nur für iOS | 2/3/10: Plattformvalidierung und tatsächliche lokale/EAS-Buildumgebung belegen |
| G06 | Nur gemeinsames Live-Entitlement für drei Tarife; Backend kann die Tiers aus der einzelnen aktiven Entitlement-ID nicht unterscheiden | 4/9: kompatiblen Übergang mit bestehenden iOS-Käufen planen/testen; keine pauschale Zuordnung aller Abos zu Premium/Standard |
| G07 | `getRevenueCatSubscriptionSummary()` speichert weder Herkunftsstore noch Basisplan; `subscriptionManagement.ts` wählt anhand Geräteplattform. Auf Android gekennzeichnete Verwaltung kann bei Apple-Bestandsabo falsch sein | 3: kontoübergreifenden Gerätewechsel, tatsächlichen Store und dessen Verwaltung testen |
| G08 | Kauf prüft nur irgendein aktives Entitlement als Erfolg, nicht den gewählten Zieltarif; kein erkennbarer Schutz gegen Apple+Google-Doppelabo, kein expliziter Google-Replacement-Pfad | 3: aktive Abos vor Kauf prüfen; konkrete Upgrade/Downgrade-/Laufzeitwechselentscheidung; 11: Store-Test |
| G09 | Login nutzt Supabase-User-ID via `configure`/`logIn`, seriell und mit Listenern; kein `Purchases.logOut()`-/RC-Reset-Pfad gefunden | 3: Logout, Wiederlogin und Kontowechsel auf Rechte-/Cacheübernahme prüfen, nicht allein aus fehlendem Aufruf einen Fehler behaupten |
| G10 | Auth-Vertrag **bestätigt, kein erfundener Header**: Lokaler Webhook verlangt Authorization und `x-revenuecat-webhook-signature` (`t=...,v1=...`, HMAC-SHA256 über Timestamp/Punkt/Raw-Body, 300 s). Aktuelle Dokumentation unterstützt dies; Dashboard-HMAC ist aktiviert | Offen für 4/9: tatsächliche Secret-Übereinstimmung und Tarifcache-Wirkung durch aussagekräftige Tests belegen. HMAC nicht wegen vermuteter Nichtunterstützung entfernen |
| G11 | Webhook dedupliziert completed-Event-IDs und liest aktuellen RC-Status neu; nur UUID `app_user_id` und Transfer-Listen, keine `aliases`/`original_app_user_id`; max. zehn Kandidaten, mehrere DB-Schreibfehler nicht geprüft | 4: Retry, Konkurrenz, verspätete Ereignisse, Transfer/Aliase und Teilfehler testen. Erneutes Lesen allein beweist keine vollständige Reihenfolge-/Idempotenzsicherheit |
| G12 | Backend `parseRevenueCatTier()` schreibt Entitlement-ID in Cachefeld `product_id`; daraus lassen sich Google-Abo/Basisplan/Herkunftsstore nicht ableiten | 4: Semantik explizit halten/korrigieren, nicht als Store-Produkt-ID weiterverwenden |
| G13 | Lokale Migrationen für Feature-Policy und Tiercache vorhanden; Name `20270822000000_subscription_tier_cache.sql` liegt nach Prüfdatum. Live-Anwendung/Secrets/Policy und Gleichheit des Deployments sind offen | 4/9: Live-Schema und Konfiguration prüfen; Dateiname ist kein Deploymentnachweis |
| G14 | Nativer Android-Release referenziert `signingConfigs.debug`; EAS verwendet remote Versionsquelle. Daraus folgt noch kein Urteil über ein EAS-Artefakt | 2: tatsächliches signiertes AAB/Upload-Zertifikat und Version prüfen |
| G15 | `EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER` kann Client-Tier ohne Produktionsguard setzen; Sonderrollen/Cache können Käufe in Tests verdecken | 2/3/11/13: saubere Release-Umgebung und repräsentative Testkonten, echte Serverfreischaltung prüfen |

Für G10: [RevenueCat Webhook-Dokumentation, HMAC und Retries](https://www.revenuecat.com/docs/integrations/webhooks#webhook-signature-verification-hmac). RevenueCat signiert jeden Zustellversuch neu; die 300-Sekunden-Toleranz bezieht sich auf den Signaturzeitpunkt, nicht auf das ursprüngliche Eventdatum. Lange Retry-Abstände sind deshalb für sich kein Grund, die Toleranz zu entfernen. Keine Produktionsänderungen aus diesem Dokument ableiten, bevor der jeweilige Folgeauftrag sie gezielt umsetzt.

### SDK- und Backend-Vertrag für die Umsetzung

- Installiert: Expo `57.0.14`, React Native `0.86.2`, `react-native-purchases` **9.10.5**; Manifestbereich `^9.6.11`. SDK-Prüfung auf den installierten/gelockten Stand beziehen.
- Installierte Typen unter `node_modules/@revenuecat/purchases-typescript-internal/dist/`: `customerInfo.d.ts` enthält `store`, `productIdentifier`, `productPlanIdentifier`; `offerings.d.ts` enthält `subscriptionPeriod`, `defaultOption`, `subscriptionOptions`, `SubscriptionOption.storeProductId` (`subId:basePlanId`), `productId`, `id` und `isBasePlan`. Kein blindes String-Splitting als Ersatz für überprüfte SDK-Felder.
- Status und Zugang gehören zur angemeldeten Supabase-User-ID. Das aktive Entitlement bestimmt Zugang; Kündigung zum Laufzeitende ist kein sofortiger Rechteentzug. `willRenew = false` bei noch gültigem Ablaufdatum muss Zugang behalten. Ablauf/Erstattung/Zahlungsprobleme anhand des tatsächlichen aktiven Status prüfen.
- Client-Tiercache wird nach 24 h erneuert, Fehlversuche nach 1 h; Backendcache 15 min, bei Fehlern positiver noch gültiger Stand bis maximal 24 h. Frische Käufe/Restore/Accountwechsel müssen die vorhandenen Invalidierungswege nutzen und in Schritt 11 auch serverseitig nachgewiesen werden.
- Google-Abos/Basispläne sind noch nicht aktiv. Kein gemockter Test, Test-Store oder aktueller UI-Fallback gilt als Nachweis eines Play-Kaufs.
