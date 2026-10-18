# Produktions-Hotfix: produktbasierte Tarife (24.09.2026)

Dieser **separate Deployment-Arbeitsbereich** repariert Produktion
`kwniiyayhzgjfqjsjcfu` mit deren acht Cache-Spalten. Die normalen Functions unter
`supabase/functions` enthalten den noch separat auszurollenden Familien-/Löschschutz.
Sie dürfen für diesen Hotfix nicht als Deployment-Quelle verwendet werden.

## Herkunft und Grenzen

Alle 14 Live-Functions wurden vor Änderungen in getrennte Verzeichnisse unter
`/tmp/lotti-abo-hotfix-20260924/before/<slug>/` geladen. Nur vier verwenden den Cache.
`deployments-before.json` enthält deren Versionen und JWT-Einstellungen;
`baseline-sha256.json` ihre ursprünglichen Datei-Hashes. Die drei Feature-Handlers
und ihre übrigen Abhängigkeiten sind unverändert aus diesen Live-Bundles übernommen.
Der Webhook nutzt den getesteten Repository-Handler mit unveränderter Pflicht zu
Authorization **und** zeitgestempelter HMAC-Signatur, aber ohne fehlenden Lösch-RPC.
Seine Ereignisbehandlung prüft Datenbankfehler, Aliase, Transfers und Duplikate.

`_shared/revenuecatState.ts` ist eine identische Kopie des kanonischen Resolvers:
`gives_access`, aktuelles Produkt, exakte Store-Allowlist, Pagination, begrenzte
HTTP-Zeit, kein Widerruf aus HTTP-Fehlern. `premiumAccess.ts` ist dessen Adapter
für das alte Schema: keine `paid_*`-Spalten, Familien-RPCs oder Löschabhängigkeiten.
Compare-and-set auf `checked_at` liest vor HTTP und fragt nach Konflikten erneut
ab. Gemeinsame Entitlement-IDs sind weder frisch noch bei Ausfall Tarifnachweise.
Bestätigte positive Caches bleiben bei Ausfall höchstens 24 Stunden und nie über
ihr Ablaufdatum nutzbar; negative/abgelaufene Einträge werden erneut geprüft.

Auch `caretaker_private.has_premium` muss die gemeinsame ID ablehnen. Dafür allein
`supabase/migrations/20260924064154_subscription_tier_cache_guard.sql` anwenden.
Die Funktion behält ihren privaten Sicherheitskontext und ihre Rollen-Ausnahmen.
Kein Migration-Push, kein Familien-Rollout, keine pauschale Cache-Herabstufung.
`get_admin_dashboard` liest den Cache nur für Statistik; nach Abgleich sind dessen
Premium-Zahlen korrigiert. Vor Abschluss können dort noch alte Zahlen stehen.

## Reproduzieren und prüfen

Vom Repository-Root:

```sh
node scripts/verify-subscription-tier-hotfix.mjs
npm test -- --runInBand --silent --runTestsByPath lib/__tests__/subscriptionTierHotfix.test.ts lib/__tests__/revenuecatBackend.test.ts lib/__tests__/familySubscriptionBackend.test.ts --testPathIgnorePatterns /node_modules/ /.local-disabled/ /output/ /tmp/
npm install --prefix /tmp/lotti-abo-hotfix-tools --save-exact @electric-sql/pglite@0.3.14
node scripts/tests/subscription-tier-hotfix-sql.mjs /tmp/lotti-abo-hotfix-tools/node_modules/@electric-sql/pglite/dist/index.js
```

Der SQL-Test führt den tatsächlichen Hotfix-Code gegen die live erfassten Spalten
und Constraints aus `production-schema.json` aus. Fixtures decken zwölf Store-/
Tarif-/Laufzeitkombinationen, gemeinsame Alt-IDs, Providerfehler, Ablauf,
Wiederherstellung, SQL-Rechte und konkurrierende Writes ab. Das separate
Familien-QA-Projekt ist hierfür kein Kompatibilitätsnachweis.

## Koordinierter Rollout und kontrollierter Abgleich

1. RevenueCat-v2-Schlüssel benötigt Customer information (Read only) und Products
   Configuration (Read only). Am 24.09. fehlte letzteres (HTTP 403); nur diese
   Produkt-Leseberechtigung wurde beim bestehenden Schlüssel „Supabase Ask Lotti“
   ergänzt. Keine Rotation, keine Schreibrechte, keine Store-Produktänderung.
   Live-Versionen, Schema und Dateien erneut vergleichen; bei Drift neu prüfen.
   Vollständigen Cache und betroffene IDs nur in einem privaten lokalen Ordner
   sichern (Verzeichnis 0700, Dateien 0600). Keine Kundendaten ins Repository.
2. SQL-Schutzfunktion gezielt mit `supabase db query --linked --file ...` anwenden.
   Migrationshistorie gesondert und ohne Ausführen anderer Migrationen erfassen.
3. Aus diesem Arbeitsbereich die vier Functions explizit deployen, Features zuerst,
   Webhook zuletzt; `--jobs 1`. `config.toml` erhält pro Function das Live-JWT-Flag:
   nur `ask-lotti=true`, die anderen drei `false`. Ihre eigene Auth bleibt erhalten.
4. Temporären `subscription-tier-repair`-Endpunkt deployen. Er verlangt einen
   separaten zufälligen `SUBSCRIPTION_TIER_REPAIR_SECRET` als Bearer-Token;
   User-/Anon-/Service-JWTs allein genügen nicht. Secret per privater env-Datei
   setzen, niemals in CLI-Argumente oder Logs schreiben. `inspect` prüft Provider
   ohne Cache-Schreibzugriff, `sync` gleicht genau ein Konto ab, `verify` führt
   die echten drei serverseitigen Feature-Entscheidungen aus.
5. API-Keys per `supabase projects api-keys --project-ref kwniiyayhzgjfqjsjcfu -o json`
   in private Datei umleiten. Der CLI-Secret-List-Aufruf liefert **nur Hashes**.
   Den temporären Token daneben als `repair-secret.txt` speichern.
6. `node scripts/reconcile-subscription-tier-hotfix.mjs KEYS_JSON PRIVATE_DIRECTORY`.
   Das Skript sichert zuerst betroffene Zeilen, arbeitet seriell mit drei Sekunden
   Pause und schreibt Ergebnis nach jedem Konto. Wiederholung überspringt Erfolge
   und versucht Fehler erneut. Fehler ändern keinen Cache; alte gemeinsame IDs
   bleiben trotzdem in HTTP- und SQL-Gates gesperrt. Abschluss zählt verbleibende
   Legacy-Zeilen erneut. Keine pauschale Änderung auf `tier=null`.
7. Echten kostenlosen Gerätetest samt Produktionscache und Feature-Gate belegen.
   Danach temporäre Function und ihr einzelnes Secret entfernen. Versionen,
   Abgleichzahlen und offene Verifikationen in `docs/android-play/step-10.md` halten.

Keine Cache-Sicherung pauschal zurückspielen: neuere Store-Käufe könnten dadurch
verloren gehen. Bei Fehlern gezielt korrigieren und aus RevenueCat neu abgleichen.
Ein Rollback auf den alten Resolver würde den Premium-Fehler wieder einführen.

## Übergabe an den Familien-Rollout

Die kanonische `supabase/functions/_shared/revenuecatState.ts` und die dortige
`cachedSubscriptionTier`-Prüfung sind auch in der normalen Familienimplementierung
enthalten. Dort `product_id` mitlesen und die Prüfung bei frischem Cache **und**
Fehler-Fallback erhalten. Familien-/Löschmigrationen bleiben Voraussetzung für
die normalen Functions; diese Hotfix-Kopien haben bewusst keinen Familienschutz.
Den SQL-Guard nicht überschreiben. Vor späterem Rollout beide Backend-Suites und
die Hotfix-Regression ausführen; Produktionsdaten bleiben Provider-abgeleitet.


Konkreter gezielter Deployment-Befehl vom Repository-Root (nur nach den oben
beschriebenen Prüfungen, niemals ohne explizite Function-Namen):

```sh
supabase functions deploy ask-lotti advisor-generate voice-log-parse revenuecat-webhook --jobs 1 --project-ref kwniiyayhzgjfqjsjcfu --use-api --workdir supabase/hotfixes/subscription-tier
```

Ergebnis 24.09.2026: Versionen in `deployments-after.json`; 122/122 abgeglichen
(118 Standard, 3 Lite, 1 Premium), 0 offen, 0 Legacy-IDs. Lite-Testkauf,
Kündigung und Ablauf produktiv bestätigt. Temporärer Prüfendpunkt und Secret
wieder entfernt. Vollständiges Ergebnis in `docs/android-play/step-10.md`.
