# Schritt 3 – Android-Abos und Paywall im Client

Stand: 10.09.2026. Client-Implementierung und lokale Android-/iOS-Tests abgeschlossen. Grundlage: [Produktmatrix aus Schritt 1](product-map.md). Keine Store-Produkte angelegt, keine Preise festgelegt, kein Deployment und keine echten Käufe ausgeführt. Die bereits vorhandenen lokalen Änderungen wurden erhalten.

## Ergebnis

- `lib/revenuecatProducts.ts` enthält die sechs Zuordnungen aus Schritt 1. Google verwendet `lottibaby_lite`, `lottibaby_standard`, `lottibaby_premium` mit `monthly`/`yearly`, gebunden an die bestehenden sechs RC-Packages. Das sind weiterhin die noch einzurichtenden IDs, kein Nachweis einer Live-Konfiguration. Standard bleibt als Bestandstarif erkannt und wird weiterhin nicht neu auf der Paywall beworben.
- Preise und Kaufbarkeit werden gemeinsam aus dem Offering `default` ermittelt. Kein Ausweichen auf ein beliebiges Current Offering und kein separater Preisabruf über iOS-IDs. Fehlende, doppelte, falsch gebundene oder ungültig bepreiste Angebote sind nicht kaufbar. Eine seit Anzeige geänderte Preis-/Währungsangabe stoppt den Kauf und lädt neue Preise.
- Android kauft die geprüfte `SubscriptionOption` des Basisplans ausdrücklich über `purchaseSubscriptionOption()`. Die automatische `defaultOption` kann ein Trial-/Rabattangebot sein und wird deshalb nicht ungeprüft gekauft. iOS bleibt bei `purchasePackage()`, seinen sechs bisherigen Produkt-IDs, Apple-Abrechnung und Apple-EULA.
- Die Live-Paywall zeigt bei fehlenden SDK-Preisen „Preis derzeit nicht verfügbar“ statt EUR-Ersatzbeträgen. Der Kaufbutton prüft den gewählten Tarif und die Laufzeit; Restore ist davon unabhängig verfügbar. Monatliche Vergleichswerte verwenden die echte Store-Währung, Ersparnisse nur vergleichbare Preise. Admin-Vorschauen sind nicht kaufbar.
- Vor jedem Kauf: Konfigurationsprüfung, frischer RevenueCat-Kontostatus, Schutz vor aktiven/doppelten Abos und erneute Angebotsprüfung. `test_`-/fremde SDK-Schlüssel und Expo Go sind für diesen Store-Kaufpfad gesperrt; benötigt werden `goog_` bzw. `appl_`. Leere bevorzugte Schlüssel erlauben weiterhin den vorhandenen Legacy-Variablen-Fallback.
- Erfolg verlangt das aktive gewählte Produkt mit passendem Tarif, Laufzeit und Herkunftsstore. Ein beliebiges altes Entitlement reicht nicht. Kaufabbruch wird anhand von `userCancelled` bzw. SDK-Code `1` erkannt, nicht anhand eines beliebigen „cancel“-Worts. SDK-Code `20` zeigt eine ausstehende Zahlung und gewährt keinen Zugang.
- Gemeinsames Bestands-Entitlement `LottiBabyAbo` bleibt kompatibel: der Produktbezug bestimmt Lite/Standard/Premium. Mehrere aktive Lotti-Entitlements werden nach der höchsten zugeordneten Stufe ausgewertet. `willRenew=false` entzieht ein noch aktives Abo nicht.
- `RevenueCatSubscriptionSummary` ergänzt `store` und `basePlanId`. Apple-Abos bleiben auf Android nutzbar und öffnen die Apple-Verwaltung; Google-Abos auf iOS entsprechend Google Play. Ein unbekannter Herkunftsstore wird nicht durch den Gerätestore ersetzt. Auch die Verwaltungslinks in den Kontolöschungsdialogen von Profil/Einstellungen verwenden den ermittelten Ursprung.
- RevenueCat-Aufrufe werden über die gesamte Kontooperation serialisiert. `AuthContext` setzt die Kontoidentität synchron; Logout blockiert alte Aufrufe/Listener sofort und meldet das SDK anschließend ab. Kontowechsel, verspätete Ergebnisse und doppelte Paywall-Taps können keinen Kauf für das vorherige Konto starten. Käufe/Restore nutzen die bestehenden Cache-Invalidierungswege. `EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER` wird nur noch in Development ausgewertet.

## Tatsächlich geprüfter SDK-Vertrag

Installiert: `react-native-purchases` **9.10.5**, `@revenuecat/purchases-typescript-internal` **17.41.1**. Keine SDK-Aktualisierung.

| Objekt | Verwendete Felder / Bedeutung |
| --- | --- |
| `PurchasesPackage` | `identifier`: bestehendes RC-Package, unabhängig von Store-Produkt-ID |
| `PurchasesStoreProduct` | `identifier`, `subscriptionPeriod`, `subscriptionOptions`; iOS zusätzlich `price`, `priceString`, `currencyCode` |
| `SubscriptionOption` | `id` = Basisplan bei `isBasePlan=true`; `productId` = Google-Abo-ID; `storeProductId` = `subId:basePlanId`; alle werden gegeneinander geprüft |
| Basisplan-Preis | `fullPricePhase.price.amountMicros / 1_000_000`, `formatted`, `currencyCode`; `billingPeriod.iso8601` und wiederkehrende Preisphase |
| Aktives Entitlement | `productIdentifier` plus `productPlanIdentifier`; unterstützt getrennte Google-Felder und kombinierte RC-ID, ohne fehlende Laufzeit zu erraten; `store`, `willRenew`, `expirationDate` |

Lokale Quellen: `node_modules/@revenuecat/purchases-typescript-internal/dist/offerings.d.ts`, `customerInfo.d.ts`, `errors.d.ts` sowie `node_modules/react-native-purchases/dist/purchases.d.ts`.

## Google-Angebote und Tarifwechsel: bewusst begrenzter Umfang

Schritt 1 enthält **keine bestätigte Entscheidung zu Trials, Rabatten, Prepaid, Ratenplänen oder Replacement-Modi**. Die Implementierung erfindet keine Abrechnungspolitik. Der aktuelle Google-Kaufpfad unterstützt normale, automatisch verlängernde Basispläne mit genau einer Preisphase. Trial-/Rabattoptionen, Prepaid und Ratenpläne werden nicht automatisch ausgewählt. Sollen sie später angeboten werden, müssen Kauf-/Preisphasendarstellung und Tests gezielt erweitert werden.

**Vorläufige Schutzregel:** Auf Android wird bei einem laufenden Abo jeder weitere Kauf einschließlich Tarif-/Laufzeitwechsel gesperrt. Es gibt einen Hinweis und den Weg zur Verwaltung im Herkunftsstore. Auch ein bereits gekündigtes, aber noch nicht abgelaufenes Abo bleibt gesperrt. Ein Wechsel von Apple zu Google darf erst nach tatsächlichem Ablauf des Apple-Abos neu gekauft werden. Umgekehrt verhindert iOS einen zweiten Kauf bei einem aktiven Google-/fremden Abo. Bestehende Apple-zu-Apple-Wechsel bleiben möglich; ein erst später wirksamer Wechsel wird nicht als bereits aktive Zielstufe ausgegeben.

Dies ist eine dokumentierte technische Schutzregel, **keine vom Nutzer bestätigte kommerzielle Wechselentscheidung**. Google-Tarifwechsel sind damit aktuell keine unterstützte Funktion. Vor Freigabe eines Wechselpfads müssen alter Produktbezug und ein fachlich gewählter `GoogleProductChangeInfo.replacementMode` übergeben und getestet werden. Insbesondere sind sofortiger Mehrpreis, Zeitgutschrift, Abrechnung zur bisherigen Verlängerung und aufgeschobene Umstellung verschiedene Entscheidungen; nicht pauschal einen iOS-Kaufaufruf übernehmen. Bei `DEFERRED` muss auch die Serverbenachrichtigung eingerichtet sein. Siehe [RevenueCat: Wechselregeln](https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions) und [Google-Produktmodell](https://www.revenuecat.com/docs/getting-started/entitlements/android-products).

## Prüfungen

**10 Jest-Suiten / 131 Tests erfolgreich**, einschließlich aller sechs Android-Formate und aller sechs iOS-Produkte:

```sh
npm test -- --runInBand \
  lib/__tests__/revenuecat.test.ts \
  lib/__tests__/revenuecatProducts.test.ts \
  lib/__tests__/paywall-screen.test.tsx \
  lib/__tests__/paywall-plans.test.tsx \
  lib/__tests__/subscriptionManagement.test.ts \
  lib/__tests__/paywallState.test.ts \
  lib/__tests__/paywallContent.test.ts \
  lib/__tests__/subscriptionAccess.test.ts \
  lib/__tests__/subscriptionFeaturePolicy.test.ts \
  lib/__tests__/subscriptionTranslations.test.ts
```

Die Tests prüfen Angebot/Preis, fehlende oder widersprüchliche SDK-Daten, falsche Keys, fremde Währungen, Zielentitlement, Abbruch, Zahlungsfehler/Pending, Restore, Ablauf, aktive gekündigte Abos, höchste Stufe, Herkunftsstore, Kontowechsel/Logout auch während laufender SDK-Aufrufe und UI-Kaufsperren. Fixtures entsprechen den installierten SDK-Feldern und ersetzen keinen nativen Play-Kauf.

- `tsc --noEmit`: erfolgreich für die App.
- Gezieltes ESLint für die geänderten Abo-/Auth-Kernpfade: keine Fehler; eine bereits bestehende Warnung zu `setLoading(false)` im Auth-Initialisierungseffekt.
- `tsc -p tsconfig.tests.json --noEmit`: weiterhin nicht global grün. Fehler außerhalb dieses Auftrags in `account-linking-qr-modal.test.tsx:50`, `shopping.test.ts:293/317/329/580/589` sowie `.ts`-Importen in `supabase/functions/ask-lotti/answerRecovery.ts:1` und `pregnancy.ts:20`. Keine Fehler in den hier ergänzten Abo-Tests. Diese fremden Bereiche wurden nicht geändert.

## Geänderte Dateien dieses Auftrags

- `lib/revenuecatProducts.ts`, `lib/revenuecat.ts`, `lib/subscriptionManagement.ts`, `lib/subscriptionAccess.ts`
- `app/paywall.tsx`, `components/paywall/PaywallPlansExperience.tsx`, `lib/paywallTranslations.ts`
- `contexts/AuthContext.tsx`, `app/subscription.tsx`, `app/profil.tsx`, `app/app-settings.tsx`
- `lib/__tests__/revenuecatProducts.test.ts`, `revenuecat.test.ts`, `fixtures/revenuecat.ts`, `paywall-screen.test.tsx`, `paywall-plans.test.tsx`, `subscriptionManagement.test.ts`
- Diese Übergabe und ein Fortschrittsverweis in `product-map.md`.

Die schon vorher vorhandenen Änderungen insbesondere an Android-Oberflächen, Build-Konfiguration und RevenueCat-Key-Fallback/Logging gehören nicht vollständig zu diesem Schritt. Kein Commit und keine Staging-Änderung.

## Offen für Folgeaufträge

1. **Schritte 4/9:** Serverseitige Tarife für das gemeinsame Bestands-Entitlement korrekt zuordnen; Google-Ereignisse und Cache-/Featurewirkung prüfen. Dieser Client-Auftrag verändert weder Backend noch Entitlement-Bindungen.
2. **Schritte 9/10:** Google-App/Key, Dienstaccount und sechs reale Basisplan-/Package-Bindungen mit bestätigten Preisen und Regionen einrichten. Vor Anlage den Bestand erneut lesen. Die derzeit fehlenden Produkte bleiben korrekt nicht kaufbar.
3. **Schritt 11:** Über Play installierter interner Build und echte Lizenztester-Testzahlungsmethoden. Native Kaufdialoge, alle angebotenen Tarife, Abbruch/Pending/Fehler, Restore nach Neuinstallation, Abonnementablauf/Erstattung/Zahlungsprobleme und Serverfreischaltungen tatsächlich testen. Apple-Bestandskonto auf Android sowie Google-Bestandskonto auf iOS prüfen; aktuell gesperrte Google-Wechsel dürfen keinen zweiten Kaufdialog öffnen.
4. **Kontozuordnung:** Die Prüfung vor Kauf sieht die aktiven Abos des angemeldeten RC-Kontos. Abos anderer App-Konten können daraus nicht ermittelt werden. RevenueCats tatsächliche Restore-/Transfer-Einstellung und Fälle „gleicher Apple-/Google-Store-Account, anderes App-Login“ in Schritt 9/11 explizit abgleichen. Kein automatisches Restore/Synchronisieren fremder Käufe zur Umgehung der Kontozuordnung eingebaut. [RevenueCat: Identitäten](https://www.revenuecat.com/docs/customers/identifying-customers).
5. Eine spätere Unterstützung von Google-Tarifwechseln benötigt die oben genannte Produktentscheidung, einen ausdrücklichen Replacement-Pfad und Store-Tests. Es wurde keine erfolgreiche Wechsel-/Kauf-/Backendprüfung im echten Store behauptet.
