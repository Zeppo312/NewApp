# Dynamische Abo-Funktionen: Rollout

## Reihenfolge

1. Die Migrationen `20260822183715_subscription_feature_policy.sql` und
   `20270822000000_subscription_tier_cache.sql` anwenden.
2. In den Supabase-Function-Secrets die internen RevenueCat-Entitlement-IDs
   setzen:
   - `REVENUECAT_PREMIUM_ENTITLEMENT_ID` (bereits erforderlich)
   - `REVENUECAT_STANDARD_ENTITLEMENT_ID`
   - `REVENUECAT_LITE_ENTITLEMENT_ID`
3. `ask-lotti`, `voice-log-parse`, `advisor-generate`, `advisor-daily` und
   `revenuecat-webhook` deployen.
4. Erst danach das App-Update veröffentlichen.

Ohne die neuen Standard-/Lite-Secrets bleibt das bisherige Premium-Verhalten
unverändert. Eine serverseitig geprüfte Funktion darf in der Admin-Oberfläche
erst für Standard oder Lite aktiviert werden, wenn die jeweilige interne
RevenueCat-Entitlement-ID konfiguriert wurde.

## Cache- und Fehlerverhalten

- Die App startet ausschließlich mit der eingebetteten Standardmatrix oder dem
  letzten gültigen lokalen Stand. Kein Netzwerkaufruf blockiert den Start.
- Nach 24 Stunden gilt der Stand als veraltet. Bei vorhandener Sitzung wird im
  Hintergrund aktualisiert; parallele Abfragen werden zusammengeführt.
- Ein Netz-, Server- oder Validierungsfehler überschreibt den letzten gültigen
  Stand nie. RevenueCat-Fehler werden höchstens einmal pro Stunde erneut
  versucht; die Feature-Matrix kann unabhängig davon aktualisiert werden.
- Der lokale Cache ist Komfortzustand und keine Sicherheitsgrenze. Die
  kostenpflichtigen Online-Funktionen Frag Lotti, Sprach-Logging und Lottis
  Fürsorge prüfen Tarif und veröffentlichte Matrix erneut im Edge-Backend.
- Das Edge-Backend nutzt einen privaten RevenueCat-Cache (15 Minuten) und bei
  einem vorübergehenden RevenueCat-Ausfall nur einen zuvor positiven Stand für
  maximal 24 Stunden. Negative oder unbekannte Zustände werden nie hochgestuft.

## Sicher veröffentlichen

- Die Admin-Seite schreibt immer die vollständige Matrix in einer Transaktion.
- Eine Versionsprüfung verhindert, dass zwei Admins Änderungen gegenseitig
  überschreiben.
- Jede Veröffentlichung erzeugt einen Audit-Eintrag mit Version, Matrix,
  Zeitpunkt und Admin-ID.
- Zum Zurückrollen die vorherige Matrix aus dem Audit-Log erneut als neue
  Version veröffentlichen; keine Datenbankzeilen manuell zurücksetzen.
