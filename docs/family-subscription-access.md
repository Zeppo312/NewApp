# Familienabo: Backend-Schutz und App-Vertrag

> **Renewal-Korrektur 29.09.2026:** Nach Nutzerentscheidung gilt zusätzlich
> eine maximal 60 Sekunden gültige Freigabe aus einer **frischen**
> RevenueCat-Subscription mit `gives_access=true`, bekanntem Produkt und
> zugeordnetem Entitlement. Sie überbrückt die verzögerte separate
> `active_entitlements`-Liste, auch wenn das neue Periodenende noch fehlt.
> Sie wird nur durch eine weitere erfolgreiche Providerprüfung erneuert.
> `expiresAt` / `paid_expires_at` bezeichnet in diesem Sonderfall das Ende
> dieser Zugangsbestätigung, **kein neu behauptetes bezahltes Store-Ende**.
> Die bisherigen Aussagen unten, dass ausschließlich das Periodenende gilt,
> sind für diesen ausdrücklich freigegebenen Sonderfall überholt.
> Die reguläre Fünfminuten-Lease, Ownership-/Umgebungs-/Umsatzfilter,
> Kontobindung, Entzug und Quoten bleiben erhalten. Ein fehlgeschlagener
> Providerabruf kann keine dieser Fristen verlängern.
>
> Die App prüft im Vordergrund alle 15 Sekunden, ob eine Abfrage nötig ist;
> regulärer Cache weiterhin 60 Sekunden. Bei höchstens 30 Sekunden Restfrist
> wird der authentifizierte Edge-Abgleich vorgezogen. Er liest nach der
> Providerabfrage Beziehung und Cache erneut, auch bei einem Fehler.
> Details und Abnahmegrenzen: [Release-QA vom 29.09.](release-readiness-20260929.md).

> **Aktualisierung 24.09.2026:** Aktueller Live-/QA-Stand, zusätzliche Migration,
> App-Korrekturen, neue Builds, den bestandenen Android→iPhone-Hauptfall in QA
> und die verbleibenden Gerätefälle stehen im
> [Rolloutprotokoll vom 24.09.](family-subscription-test-report-20260924.md).
> Historische Befunde unten (insbesondere leerer Google-Katalog/fehlendes QA-Backend)
> gelten nicht mehr als aktueller Stand. Noch keine Produktionsfreigabe.

Stand: 12.09.2026. App und Backend-Schutz sind im Repository implementiert und
lokal getestet. **Nicht ausgerollt.** Am 12.09.2026 wurde der Live-Stand über die
authentifizierte Supabase-CLI ausschließlich lesend geprüft: Familien-RPC und
Mitgliedertabelle fehlen noch. Der Connector hat keine Berechtigung; der CLI-Zugang
funktioniert. Keine Store-Abos wurden verändert.

## Serverseitige Garantien

- Eigenes Abo und teilbarer Kaufnachweis bleiben getrennt. `paid_tier`,
  `paid_subscription_id`, `paid_expires_at` und `paid_verified_at` werden nur
  durch den Server nach RevenueCat-Abfrage geschrieben. Erforderlich sind
  bekannter Store-Tarif, `gives_access`, eigene `customer_id`,
  `ownership=purchased`, `environment=production`, positiver Umsatz und
  Status `active` oder `in_grace_period`. Trials, Sandbox-Käufe,
  Promotions, Tester-/Adminrollen und Store-Familienfreigaben sponsern niemanden.
- Neue Einladungen erhalten einen zufälligen, serverseitigen Code mit 32 Zeichen.
  Nur der eingeladene, angemeldete Nutzer kann annehmen. Ein eindeutiger
  Mitgliederplatz pro Konto verhindert weitere und umgekehrte Verknüpfungen.
  Die Freigabe folgt genau einer Partnerbeziehung und nur deren Kaufnachweis.
- Clients dürfen weder bezahlte Tarife, Mitgliederplätze noch Quoten schreiben.
  Einladungen können nur selbst erstellt und von Beteiligten beendet werden.
  Debug-RPCs und globale Sichtbarkeit ausstehender Einladungscodes sind gesperrt.
- Normale Kündigung behält Zugang bis zum bestätigten Ende. Erstattung/Ablauf/
  Tarifwechsel werden aus dem aktuellen RevenueCat-Zustand übernommen, nicht
  aus der Reihenfolge der Ereignisse. Die vorhandene Compare-and-set-Schleife
  verwirft überholte Antworten; eine Subscription-ID darf nur einen Zahler haben.
- Bei Trennung oder Kontolöschung entfällt Familienzugang bei der nächsten
  Backend-Entscheidung. Ein HTTP-Abgleich liest die Zuordnung anschließend neu.
  Lokale Leases und Familien-Kaufnachweise sind höchstens fünf Minuten gültig;
  bei Ausfall wird keine Freigabe verlängert. Webhooks und der Repair-Worker
  ergänzen den Abgleich bei Bedarf.
- Frag Lotti reserviert atomar 3/min, 20/UTC-Tag und 300/UTC-Monat. Partner ohne
  gleichwertiges eigenes Abo verbrauchen den gleichen Zähler des Zahlers.
  Fürsorge reserviert 3 KI-Aufrufe je Zahler/UTC-Tag (bestehende Admin-Ausnahme).
  Nachrichtentexte, `facts.ai_runs`, Babywechsel und Client-Datum bestimmen keine
  Limits. Fehlgeschlagene Provider-Aufrufe geben reservierte Plätze nicht frei.
  Die Partnerentscheidung und Reservierung laufen in derselben Transaktion.

## Schnittstelle

Die App ruft `supabase.rpc('get_family_subscription_access')` ohne Parameter auf.
Bei `P0001: family_verification_required` erfolgt der authentifizierte Aufruf
von `family-subscription-access`; dieser aktualisiert ausschließlich den
serverseitig ermittelten Zahler und prüft danach die Beziehung erneut.
Der Endpunkt muss ausschließlich den angemeldeten Nutzer über `auth.uid()`
ermitteln. Rückgabe: ein JSON-Objekt, kein Array, keine fremden Kontodaten.

Aktiver, vom Backend bestätigter Partnerzugang:

```json
{
  "schemaVersion": 1,
  "userId": "UUID des angemeldeten Nutzers",
  "status": "active",
  "tier": "premium",
  "expiresAt": "2026-10-12T12:00:00.000Z",
  "validUntil": "2026-09-12T12:05:00.000Z"
}
```

`tier`: `lite`, `standard` oder `premium`. `expiresAt` ist das Ende des aktuell
bestätigten Zugangs einschließlich einer vom Store bestätigten Zahlungsfrist.
`validUntil` begrenzt die lokale Freigabe auf höchstens fünf Minuten ab Prüfung
und darf nicht nach `expiresAt` liegen. Keine unbefristeten Partnerfreigaben.
Die App begrenzt längere Leases zusätzlich selbst. Die Daten sind eine
Darstellungsentscheidung im Client, kein Berechtigungsnachweis für Server-APIs.

Bestätigt kein geteilter Zugang:

```json
{ "schemaVersion": 1, "userId": "UUID des angemeldeten Nutzers", "status": "none" }
```

Bei fehlender Verifizierbarkeit muss der Endpunkt einen Fehler liefern; `none`
darf nicht als Ersatz für einen RevenueCat-Ausfall verwendet werden. Nur ein
fehlender RPC (`PGRST202`) erlaubt vor Einführung der Schnittstelle den bisherigen
Kaufablauf. Nach einer gültigen Antwort wird ein verschwundener Endpunkt in der
laufenden Sitzung als Fehler behandelt. Beim Backend-Rollout muss der Endpunkt
dauerhaft bestehen bleiben und auch bei Störungen einen Fehler statt eines
Schema-/Missing-Function-Zustands liefern. Andere Fehler erlauben keinen neuen Kauf.

## Verhalten der App

- Eigenes Abo wird weiterhin durch RevenueCat geprüft. Für normale Konten gilt
  der höhere Tarif aus eigenem Abo und Familienzugang; bei Gleichstand bleibt
  das eigene Abo maßgeblich. Bestehende Admin-/Testerrollen behalten Vorrang.
- Die Familienabfrage wird während aktiver Nutzung alle 60 Sekunden sowie beim
  Aktivieren, nach einer Partneränderung und beim manuellen Aktualisieren gestartet.
  Parallele Anfragen werden zusammengefasst; eine Anfrage endet nach acht Sekunden.
- Bestätigter Entzug entfernt den Familienzugang sofort im Client. Bei
  Netzfehlern bleibt nur die bestehende, höchstens fünfminütige Freigabe bestehen.
  Sie wird bei Fehlern nicht verlängert und beim Fristende aktiv invalidiert.
  Nach einem App-Neustart muss Familienzugang neu bestätigt werden.
- Abmelden und Kontowechsel verwerfen die Freigaben und verspätete Antworten.
  Eine lokal aufgehobene Partnerverknüpfung verwirft die Freigabe sofort.
- Die Paywall erkennt Familienzugang und schließt sich. Direkt vor einem
  Store-Kauf erfolgt eine erneute Familienprüfung. Aktiver oder unbekannter
  Familienstatus blockiert den Kauf. Dies ersetzt keine serverseitige Lösung
  für zwei zeitgleich gestartete Käufe oder verzögert eintreffende Store-Ereignisse.
- Die Abo-Seite zeigt Tarif und Ende des Familienzugangs, keine eigene
  Verlängerungszusage und keine Store-Verwaltung für einen reinen Partnerzugang.
  Ein zusätzliches eigenes Store-Abo bleibt separat verwaltbar und wird nicht
  automatisch gekündigt. Texte sind auf Deutsch, Englisch und Spanisch vorhanden.

## Rollout

**Produktions-Hotfix vom 24.09.2026 erhalten:** Die isolierten Deployments und
der SQL-Guard sind unter [subscription-tier/README.md](../supabase/hotfixes/subscription-tier/README.md)
dokumentiert. Beim Familien-Rollout die produktbasierte Auflösung und
`cachedSubscriptionTier` einschließlich `product_id` in frischem Cache und
Ausfall-Fallback beibehalten. `caretaker_private.has_premium` darf die gemeinsame
Entitlement-ID auch nach diesem Rollout niemals als Premium-Nachweis akzeptieren.
Die alten Hotfix-Kopien ersetzen nicht die Familien-/Löschlogik.

1. Voraussetzungen prüfen: bisheriger Tarifcache, Feature-Matrix,
   Account-Links, Moderationsschutz und Account-Deletion-Migrationen müssen
   vorhanden sein. Das Repository enthält historische Migrationen mit
   Zukunftsdatum 2027: die neue CLI-erzeugte Migration
   `20260912185037_family_subscription_security.sql` daher **nach den genannten
   Voraussetzungen** anwenden, keinen ungeprüften vollständigen DB-Reset/Push.
2. Datenbankmigration und zusammengehörige Functions koordiniert ausrollen:
   `revenuecat-webhook`, `ask-lotti`, `advisor-generate`, `voice-log-parse`,
   `family-subscription-access`, `reconcile-family-subscriptions` und sonstige
   Deployments mit `_shared/premiumAccess.ts`. Neue Spalten sind vor dem neuen
   Sync-Code erforderlich. Alte Function-Versionen aktualisieren keinen
   Kaufnachweis. Während des Übergangs bleibt Familienzugang geschlossen.
3. RevenueCat-v2-Secrets und HMAC-Webhooks verifizieren. Einen eigenen
   `SUBSCRIPTION_RECONCILE_SECRET` setzen und denselben Wert in Vault unter
   `subscription_reconcile_secret` hinterlegen; `supabase_url` ebenfalls in
   Vault konfigurieren. `scripts/schedule-family-subscription-rechecks.sql`
   installiert den minütlichen Reparaturjob. Je Lauf werden maximal 20 Konten
   verarbeitet; fehlgeschlagene Versuche verlängern keine Berechtigung.
4. Bestehende Verknüpfungen werden aus Sicherheitsgründen nicht als bestätigte
   Abo-Mitgliedschaft übernommen. Für Familienzugang die alte Verknüpfung lösen
   und eine neue Einladung annehmen. Die UI unterstützt alte 8-stellige und
   neue 32-stellige Codes. Ein App-Update muss vor Nutzung der neuen Codes
   bereitstehen.
5. Datenbank-Advisors und Löschinventar erneut prüfen: neue Cache-Spalten ändern
   den bestehenden Account-Deletion-Fingerprint; dessen Freigabe nach der
   Inventarprüfung erneuern. Mitgliedsplätze verschwinden über Foreign-Key-
   Cascades bei Link-/Kontolöschung.

## Lokale Prüfung

- Jest: Familienparser, Lease-Ablauf, Kaufblockierung, bezahlte RC-Nachweise,
  Manipulationsversuche, Trennung während HTTP-Abgleich, Authentifizierung,
  Feature-Verbraucher und geschützter Repair-Worker.
- `scripts/tests/family-subscription-sql.test.mjs` führt die Migration und echte
  PostgreSQL-Rechte, Trigger, Constraints und Quoten in PGlite aus.
  Beispiel: `node scripts/tests/family-subscription-sql.test.mjs /path/to/pglite/dist/index.js`.
- Zusätzlich läuft derselbe Test mit einem isolierten nativen PostgreSQL 15:
  `node scripts/tests/family-subscription-sql.test.mjs /path/to/embedded-postgres/dist/index.js --postgres`.
  Dieser Modus erzeugt ausschließlich eine temporäre lokale Datenbank, verwendet
  getrennte Verbindungen für gleichzeitige Quotenabfragen und Einladungsannahmen
  und entfernt die Datenbank anschließend. Er akzeptiert keine Produktions-URL.
- Der tatsächliche Code-Einlöse-Wrapper einschließlich Settings-/Baby-Sync wird
  mitgeprüft. Apple-Familienzugang bleibt in den Provider-/SDK-Tests erhalten,
  ohne als eigener teilbarer Kauf zu gelten. QR-Codes unterstützen auch die
  neuen 32-stelligen Servercodes.
- Ergebnisse und offene Geräte-/Store-Abnahme: [Testprotokoll](family-subscription-test-report-20260912.md).
  Kein echter Store-Kauf und kein schreibender Live-Test wurde ausgeführt.

Quellen für den Providervertrag: [RevenueCat Subscription Data Model](https://www.revenuecat.com/docs/api-v2/subscription-data-model),
[Webhook-Signaturen und Wiederholungen](https://www.revenuecat.com/docs/integrations/webhooks).

## Abnahme vor Veröffentlichung

Mit tatsächlichen Release-Builds beide Richtungen
iOS → Android und Android → iOS prüfen. Alle drei Tarife, vorhandenes eigenes
Abo, Kauf vor/nach Einladung, automatische Verlängerung, Wechsel, Kündigung bis
Laufzeitende, Erstattung, Trennung, Logout/Login, Neustart, unterbrochenes Netz,
Backend-Ausfall und verspätete/doppelte Ereignisse einbeziehen. Insbesondere
KI-Endpunkte prüfen: Eine sichtbare Freigabe allein belegt keinen Serverzugang.
Diese geräteübergreifenden Tests sind mit dem noch fehlenden Backend ausstehend.

Sandbox-Käufe dürfen in Produktion ausdrücklich keinen Partner freischalten.
Für positive End-to-End-Tests eine isolierte Testumgebung mit kontrollierten
Provider-Fixtures verwenden; den Produktionsfilter nicht für Tests lockern.
Zwei unabhängig bereits gestartete Store-Checkouts lassen sich durch diese
Datenbankänderung nicht atomar zusammenlegen oder automatisch kündigen. Beide
Käufe bleiben verwaltbar; daraus entstehen keine zusätzlichen Partnerplätze.
