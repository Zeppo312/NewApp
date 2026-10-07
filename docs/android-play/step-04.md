# Schritt 4 – Backend-Freischaltungen und RevenueCat-Webhook

Stand: 10.09.2026. Lokal implementiert und geprüft. **Kein Deployment, keine Dashboard-/Secret-Änderung und keine Testzustellung an Produktion ausgeführt. Inbetriebnahme bleibt Schritt 9.** Grundlage: [Produktmatrix](product-map.md) und [Client-Vertrag aus Schritt 3](step-03.md).

## Ergebnis und Authentifizierungsnachweis

Das bestehende Signaturformat ist unterstützt und bleibt verpflichtend:

- `Authorization` muss exakt dem in RevenueCat konfigurierten Wert entsprechen. RevenueCat ergänzt kein automatisch angenommenes `Bearer`; ein solches Präfix gehört gegebenenfalls zum gespeicherten Wert.
- `X-RevenueCat-Webhook-Signature: t=<Unix-Sekunden>,v1=<SHA-256-HMAC als Hex>`; signiert werden Timestamp, Punkt und die unveränderten Body-Bytes. Vergleich ohne vorzeitigen Abbruch; maximal 300 Sekunden Zeitabweichung.
- RevenueCat signiert **jeden Zustellversuch neu**, einschließlich Retry. Ein altes `event_timestamp_ms` blockiert deshalb kein frisch signiertes Ereignis. Fehlende/falsche Authentifizierung: 401; fehlende Serverkonfiguration: 503. Es gibt keinen ungesicherten Fallback.

Quelle, am 10.09.2026 erneut geprüft: [offizielle Webhook-Dokumentation](https://www.revenuecat.com/docs/integrations/webhooks#webhook-signature-verification-hmac).

Zusätzlich live und ausschließlich lesend geprüft: [Supabase Premium Sync in RevenueCat](https://app.revenuecat.com/projects/46375297/integrations/webhooks/whintgr0477099de6). Die UI zeigt den HMAC-Schalter **an**, benennt exakt `X-RevenueCat-Webhook-Signature`, bietet `Rotate secret`, zeigt das Authorization-Feld mit `Edit`, Ziel `https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/revenuecat-webhook`, `Both Production and Sandbox`, `All apps`, `All events`. Zustellungen stehen auf `Sent`. Kein Secret geöffnet/kopiert/rotiert, kein Save/Test/Retry ausgelöst. Das belegt Dashboard-Unterstützung und Versand; **nicht** die Übereinstimmung der verborgenen Secrets oder die fachliche Richtigkeit des Live-Caches.

`supabase/config.toml` bleibt für den externen Webhook bei `verify_jwt=false`. Seine eigene Authorization-/HMAC-Prüfung ersetzt hier den Supabase-User-JWT. Die übrigen Endpunkte behalten ihre bestehenden Einstellungen. Abgleich: [Supabase Function Configuration](https://supabase.com/docs/guides/functions/function-configuration). Supabase-Changelog als Markdown erfolgreich gelesen; keine relevante Breaking Change für die verwendeten APIs gefunden.

## Fachliche Verarbeitung

Der Eventname verändert keine Berechtigung direkt. Der Server liest aktuelle RevenueCat-Daten zur betroffenen ID:

1. Vollständige aktive Entitlements einschließlich Pagination.
2. Aktuelle Subscriptions einschließlich Pagination und `gives_access`.
3. Zu aktiven Subscriptions die RC-Produkte; `product_id` der API ist eine interne `prod…`-ID, `store_identifier` enthält die Store-Produkt-ID.

Quelle: [Customer Resources](https://www.revenuecat.com/docs/api-v2/customer/resources), [Subscription](https://www.revenuecat.com/docs/api-v2/subscription), [Product](https://www.revenuecat.com/docs/api-v2/product). Die API-v2-OpenAPI-Dateien wurden ergänzend gelesen; insbesondere bedeutet `gives_access`, ob die Subscription aktuell Zugang gewährt. `ends_at` beschreibt das Ende der letzten Billing-Periode, nicht automatisch das Ende einer Grace Period.

**Kompatibilität mit dem Live-Bestand:** `entl7a7b4e9838` / `LottiBabyAbo` wird ausdrücklich als gemeinsames Bestands-Entitlement erkannt und niemals allein zu Premium hochgestuft. Die sechs bestehenden iOS-Produkte bestimmen ihren tatsächlichen Tarif; Google-Produkte werden anhand der sechs `subscription:basePlan`-Zuordnungen aus Schritt 3 erkannt. Die Google-IDs bleiben noch einzurichtende Zielwerte. Ein automatischer Vertragstest vergleicht die Server-Zuordnung mit `lib/revenuecatProducts.ts`. Keine Client- oder Kauf-Schnittstelle wurde geändert.

Eigene konfigurierte Tier-Entitlements bleiben für explizite/grant-basierte Freischaltungen verwendbar. Doppelte Tier-Bindungen werden als Konfigurationsfehler abgewiesen. Ein unbekanntes Produkt am gemeinsamen Entitlement erzeugt einen wiederholbaren Fehler statt einer stillen falschen Tarifzuordnung. Ein fehlendes/abgelaufenes Abo ist kein Lite-Abo. Höchster gültiger Tarif gewinnt; bei gleichem Tarif zählt die längere gültige Laufzeit.

| Situation | Verhalten |
| --- | --- |
| Kündigung zum Laufzeitende / Pause angekündigt | Zugang bleibt bei aktuellem `gives_access=true`; weder Eventname noch `will_not_renew` entziehen ihn |
| Billing Issue mit Zugangs-Grace-Period | Aktueller Zugang bleibt. Liegt das reguläre Periodenende bereits zurück, wird spätestens nach 15 Minuten erneut geprüft; kein erfundenes lebenslanges Abo |
| Account Hold / Billing Retry ohne Zugang / Ablauf | Ohne aktuelle Berechtigung keine Freischaltung; andere aktive Abos werden weiterhin berücksichtigt |
| Erstattung / Widerruf | Neu gelesener Zustand entscheidet. Ein weiterhin aktives Lite-Abo bleibt Lite, auch wenn Premium erstattet wurde |
| Wiederherstellung / erneute Aktivierung / Verlängerung | Aktueller Zustand aktiviert den Cache wieder; auch ein frischer negativer oder gerade abgelaufener Cache wird beim Featureaufruf erneut geprüft |
| Altes EXPIRATION nach neuer RENEWAL | Aktueller Status wird erneut gelesen; kein Zurücksetzen auf den alten Eventzustand |
| Mehrere parallele Abos | Premium läuft nur bis zu seiner eigenen bekannten Grenze; das spätere Ende eines Lite-Abos verlängert Premium nicht |
| API 401/403/404/429/5xx, ungültige Daten, Paginationfehler | Kein negativer Cache aus einem Fehler; Webhook antwortet 503, sodass RevenueCat wiederholen kann |
| Explizites Lifetime-Entitlement | Nur echtes `expires_at=null` zählt als Lifetime; fehlende, leere oder fehlerhafte Werte werden nicht umgedeutet |

Zusätzliche Ereignissemantik: [RevenueCat Event Types](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields). iOS und Google werden durch denselben Handler verarbeitet; neue Eventtypen werden bei vorhandener Nutzerzuordnung ebenfalls abgeglichen. Ein signiertes Dashboard-`TEST` prüft die Zustellung ohne Nutzerrechte zu verändern.

## Nutzerzuordnung, Wiederholungen und Cache

- Berücksichtigt `app_user_id`, `original_app_user_id`, `aliases`, `transferred_from` und `transferred_to`. UUIDs werden dedupliziert; keine stille Begrenzung auf die ersten zehn. Anonyme RC-IDs selbst werden nicht als Supabase-UUID verwendet.
- Jede UUID wird gegen Supabase Auth geprüft. Gelöschte/unbekannte Nutzer werden übersprungen; vorübergehende Auth-Fehler führen zu Retry. Jede bestehende Identität wird unabhängig bei RevenueCat abgefragt. Ein Transfer kopiert keine Rechte vom Abgeber zum Empfänger.
- Events werden mit `ON CONFLICT DO NOTHING` angelegt. Ein paralleler Retry kann `completed` nicht wieder auf `processing` setzen. Alle Event-Tabellenoperationen und Cache-Schreibvorgänge prüfen Fehler und relevante Zeilenanzahl.
- `completed` gibt es erst nach allen Synchronisierungen. Teilfehler bleiben wiederholbar (`processing` + HTTP 503); ein Retry liest den aktuellen Zustand erneut. Gleichzeitige Duplikate dürfen mehrfach lesen, aber keine unkontrollierten alten Cachewerte schreiben.
- Cache-Schreibschutz ohne neue Cache-Spalte: `checked_at` vor der RC-Abfrage lesen, danach nur per bedingtem Update auf exakt diese Version schreiben. Beim erstmaligen Insert gilt ebenfalls `ON CONFLICT DO NOTHING`. Konflikte verwerfen das gelesene Ergebnis und fragen RC erneut ab, maximal drei Versuche.
- Positiver Featurecache maximal 15 Minuten frisch. Bei API-Ausfall gilt der bestehende positive Fallback nur innerhalb von 24 Stunden und niemals über `expires_at` hinaus. Vor dem Fallback wird nochmals geprüft, ob ein Webhook den Cache inzwischen ersetzt hat. Fehlende, ungültige oder zukünftige Cachezeitpunkte werden nicht als frisch gewertet.
- `product_id` im Cache enthält eine tatsächlich aufgelöste Store-ID; bei reiner Entitlement-Freischaltung `null`, keine als Produkt ausgegebene Entitlement-ID. Vorhandene Admin-Auswertungen bleiben kompatibel.
- Die Featurematrix wird weiterhin serverseitig aus `subscription_plan_features` gelesen. Sonderrollen kommen aus den geschützten Profilfeldern; keine Nutzer-Metadaten oder clientseitig behaupteten Tarife als Freigabequelle. `ask-lotti`, `advisor-generate` und `voice-log-parse` ermitteln den Nutzer über `auth.getUser`; `advisor-daily` bleibt durch das Cron-Secret geschützt.

Zusätzlicher SQL-Befund: `caretaker_private.has_premium` prüft den synchronisierten Tarif und `expires_at`, führt aber keine externe Neusynchronisierung aus. Deshalb erhält er bewusst keine neue starre 24-Stunden-Sperre: Ohne neuen authentifizierten Refresh-Pfad würde diese gültige Monats-/Jahresabos vorzeitig blockieren. Die zuvor lokal erwogene zusätzliche Migration wurde verworfen; keine SQL-Produktionsänderung ist Teil dieser Übergabe. Diese RPCs sind bei Widerrufen auf zuverlässige Webhook-Zustellung bzw. gezielte Nachsynchronisierung angewiesen. Ein verpasstes Erstattungsereignis kann dort bis zum bekannten Ablaufdatum nachwirken; das ist eine konkrete Betriebsgrenze, die Schritt 9 überwachen muss. Der bestehende private SECURITY-DEFINER-Helper bleibt für `PUBLIC`, `anon` und `authenticated` gesperrt und hat einen festen leeren `search_path`. Die aufrufenden Betreuer-RPCs prüfen Akteur/Besitzer; kein zusätzlicher Gleichheitszwang zum Besitzer im Helper, der legitime Betreuerzugriffe beschädigen würde.

## Lokale Prüfung

**161 Jest-Tests in 9 Suiten bestanden**, davon 62 neue Backendfälle. Unter anderem echte WebCrypto-HMAC-Prüfung, Manipulation/Replay, alter Eventzeitpunkt mit neuer Signatur, Testevent, UTF-8, Aliase, Transfers, mehr als zehn IDs, gelöschte Nutzer, DB-/Auth-Teilfehler, gleichzeitige Erst-Inserts/Updates/Duplikate, verspäteter Ablauf nach Restore, Google-/iOS-Tarifvertrag, Grace Period, Erstattung mit verbleibendem Lite, Pagination, fehlerhafte API-Antworten, Fallback-Grenzen und zwischenzeitliche Cache-Widerrufe.

```sh
npm test -- --runInBand \
  lib/__tests__/revenuecatBackend.test.ts \
  lib/__tests__/serverSubscriptionAccess.test.ts \
  lib/__tests__/subscriptionFeaturePolicyMigration.test.ts \
  lib/__tests__/revenuecatProducts.test.ts \
  lib/__tests__/revenuecat.test.ts \
  lib/__tests__/subscriptionAccess.test.ts \
  lib/__tests__/subscriptionManagement.test.ts \
  lib/__tests__/subscriptionFeaturePolicy.test.ts \
  lib/__tests__/entitlements.test.ts
```

**17 zusätzliche SQL-Assertions bestanden** in isoliertem PostgreSQL/PGlite 0.5.8: tatsächliche Ausführung der bestehenden Cache-DDL und des privaten Betreuer-Helpers, Tier-/Laufzeitgrenzen, unveränderter SQL-Zugang nach 24 Stunden bei weiter gültigem Abo, Sonderrollen, RLS/ACL, `search_path`, bedingte Updates und konfliktfreie Eventanlage. Keine Produktivdaten, keine Projektabhängigkeit installiert. Reproduzierbar:

```sh
npm install --prefix /tmp/lotti-step4-postgres --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8
node scripts/tests/revenuecat-cache-sql.test.mjs /tmp/lotti-step4-postgres/node_modules/@electric-sql/pglite/dist/index.js
```

Gezielter TypeScript-Check des Edge-Einstiegspunkts und seiner neuen Imports bestanden:

```sh
npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --allowImportingTsExtensions \
  --moduleResolution bundler --module esnext --target es2022 \
  supabase/functions/revenuecat-webhook/index.ts \
  supabase/functions/revenuecat-webhook/handler.ts \
  supabase/functions/_shared/premiumAccess.ts
```

`tsconfig.tests.json` erlaubt nun die von Deno benötigten `.ts`-Imports. Der projektweite Test-Typecheck meldet weiterhin sechs bereits bestehende Signaturfehler in `account-linking-qr-modal.test.tsx:50` und `shopping.test.ts:293,317,329,580,589`; keine Fehler in den bearbeiteten Backenddateien/Tests. Kein vollständiger App-Build behauptet.

`supabase db advisors --local` konnte mangels laufendem PostgreSQL auf `127.0.0.1:54322` nicht ausgeführt werden. PGlite prüft die gezielten SQL-Verträge, ersetzt aber keinen vollständigen Supabase-Stack, RLS-Advisor oder Migration-Replay. Keine fremde/Produktionsdatenbank als Testersatz verwendet. Live-Secretwerte, API-Key-Berechtigungen, deployed Source und tatsächliche Kundentarife wurden nicht vollständig ausgelesen. Echte Play-Käufe bleiben Schritt 11.

## Konkrete Inbetriebnahme für Schritt 9

1. **Zielbestand sichern und vergleichen:** ausschließlich Supabase-Projekt `kwniiyayhzgjfqjsjcfu` und RC-Projekt `46375297`. Deployed Code aller fünf folgenden Funktionen, aktuelle SQL-Funktionsdefinition, Migrationshistorie, Cache-ACL und Secret-Konfiguration prüfen. Der aktuelle Arbeitsbaum enthält viel andere Arbeit; diese Übergabe ist kein Auftrag zum Deployment des gesamten Arbeitsbaums.
2. **Server-Key-Rechte prüfen:** vorhandener RC-v2-Secret-Key braucht `customer_information:customers:read` (aktive Entitlements), `customer_information:subscriptions:read` und neu `project_configuration:products:read`. Zusätzliche Rechte ausschließlich in Schritt 9 gezielt konfigurieren. Keine v1-Key-Umstellung nötig. An einer freigegebenen Test-ID muss der Key alle drei GET-Endpunkte bedienen können, bevor der Code live geht.
3. **Entitlements korrekt konfigurieren:** die bestehenden `REVENUECAT_PREMIUM_ENTITLEMENT_ID`, `…STANDARD…`, `…LITE…` sind optionale **interne REST-IDs eigener Tier-Entitlements**. Keine Anzeigenamen/SDK-Lookup-Keys und keine doppelte gemeinsame ID eintragen. Für den vorhandenen gemeinsamen Bestand genügt die verifizierte Produktauflösung; ein fehlendes separates Premium-Entitlement blockiert den Receiver nicht mehr. Bestehende iOS-Produkte und `LottiBabyAbo` erhalten. Tatsächliche Google-ID-Abweichungen vor Aktivierung mit Schritt 3 und Server-Allowlist synchronisieren.
4. **Auth beibehalten:** vorhandene `REVENUECAT_WEBHOOK_AUTHORIZATION` und `REVENUECAT_WEBHOOK_SIGNING_SECRET` mit der Integration abstimmen. Nicht beiläufig rotieren; eine RC-Rotation macht den alten HMAC-Schlüssel sofort ungültig. Kein Supabase-User-JWT oder erfundener Zusatzheader erforderlich. HMAC ist im Dashboard bereits an; kein neuer Schalter nötig.
5. **SQL-Voraussetzungen:** private Tabellen `lotti_subscription_entitlements` (einschließlich `tier`) und `lotti_revenuecat_webhook_events`, service-role-Schreibrechte, Featurematrix, vorhandener Betreuer-Helper. Keine neue Migration aus diesem Schritt nötig. Repository-Migrationen besitzen bereits Zeitstempel bis 2027; nicht blind `db push` ausführen. Besonders Cache-DDL `20270723000000…`, Tier-Erweiterung `20270822000000…` und Betreuer-Migration `20260910045915…` gegen den tatsächlich ausgerollten Bestand prüfen. Lokaler SQL-Test stellt diese Voraussetzungen ausdrücklich her.
6. **Alle Consumer zusammen aktualisieren:** `revenuecat-webhook`, `ask-lotti`, `advisor-generate`, `advisor-daily`, `voice-log-parse`. Jede Edge-Funktion bündelt ihre eigene Kopie von `_shared/premiumAccess.ts` und `_shared/revenuecatState.ts`. Ein reines Webhook-Deployment lässt alte Tarifauflösung und ungeschützte Cache-Upserts in den übrigen Funktionen zurück. Nach Freigabe mit den jeweils geprüften Quellständen beispielsweise:

   ```sh
   supabase functions deploy revenuecat-webhook ask-lotti advisor-generate advisor-daily voice-log-parse \
     --project-ref kwniiyayhzgjfqjsjcfu --use-api
   ```

   Die bestehenden individuellen JWT-Einstellungen aus `config.toml` verwenden; **kein globales `--no-verify-jwt` für diese Gruppe**. Dieses Kommando wurde hier nicht ausgeführt.
7. **Alte Tarifsnapshots gezielt verwerfen:** nach Umstellung aller Schreiber und Ablauf noch laufender alter Instanzen den vorhandenen RC-Cache einmal zur Neuprüfung markieren, z. B. `UPDATE public.lotti_subscription_entitlements SET checked_at = '1970-01-01T00:00:00Z', updated_at = now();`. Das entfernt keine Käufe und erzwingt beim nächsten Edge-Featureaufruf eine neue Prüfung. Reine SQL-Betreuerfreigaben prüfen `checked_at` nicht: bestehende bezahlte Nutzer deshalb zusätzlich kontrolliert neu synchronisieren, damit eventuell falsch klassifizierte Alttarife auch dort korrigiert werden. Anschließend Betreuer-Freigabe prüfen; eine schon `completed` gespeicherte Event-ID löst absichtlich keine erneute Synchronisierung aus. Vor dieser geplanten Cacheumstellung Erreichbarkeit/Rechte der RC-API belegen und betroffenen Umfang festhalten.
8. **Zustellung und fachliche Wirkung getrennt abnehmen:** zuerst signiertes Dashboard-Testevent (200, `test_event`, keine Nutzeränderung), anschließend freigegebene echte Sandbox-Käufe/Restore/Transfer für beide Stores. Cache-Tier, echte Store-ID, Laufzeit und serverseitige erlaubte/verbotene Features prüfen. Ein `Sent` oder `TEST` allein belegt keine Freischaltung. Sandbox und Produktion sind derzeit bewusst gemeinsam ausgewählt und fließen beide in denselben Nutzercache ein; eine gewünschte Trennung benötigt eine eigene abgestimmte Konfiguration und ist hier nicht heimlich eingeführt worden.
9. **Betrieb und Rückfall:** auf 401/503, `processing` ohne Abschluss, `revenuecat_unmapped_product`, `revenuecat_ambiguous_entitlements`, API-429 und Cache-Konflikte achten. RevenueCat wiederholt endlich (5, 10, 20, 40, 80 Minuten); nach Behebung fehlgeschlagene Events gezielt erneut zustellen. Verarbeitung ist synchron und kann bei sehr vielen Identitäten/API-Problemen die 60-Sekunden-RC-Wartezeit überschreiten: nie vor Abschluss 200 quittieren; bei dauerhaftem Rückstau eine persistente Queue ergänzen. Ein Rückfall muss alle fünf Consumer zusammen berücksichtigen; Authentifizierung bleibt in jedem Fall an. Supabase-Advisors auf dem autorisierten Ziel/Staging nachholen.

## Geänderte Dateien dieses Schritts

- `supabase/functions/revenuecat-webhook/index.ts`, neuer testbarer `handler.ts`
- `supabase/functions/_shared/premiumAccess.ts`, neue RC-v2-Auflösung `revenuecatState.ts`
- `lib/__tests__/revenuecatBackend.test.ts`, `lib/__tests__/fixtures/revenuecatBackend.ts`
- `scripts/tests/revenuecat-cache-sql.test.mjs`
- `tsconfig.tests.json`
- dieses Dokument

Keine anderen begonnenen Android-/iOS-/UI-Arbeiten zurückgesetzt, keine Commits/Staging-Aktionen, keine Agenten oder Nachrichten an andere gestartet. G06/G11/G12 aus Schritt 1 sind lokal behandelt; die Live-Abnahme bleibt ausdrücklich offen für Schritte 9/11.
