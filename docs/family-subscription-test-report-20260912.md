# Familienabo: Testprotokoll vom 12.09.2026

> **Aktualisierung 24.09.2026:** Aktueller Live-/QA-Stand, zusätzliche Migration,
> App-Korrekturen, neue Builds und offene Geräteabnahme stehen im
> [Rolloutprotokoll vom 24.09.](family-subscription-test-report-20260924.md).
> Historische Befunde unten (insbesondere leerer Google-Katalog/fehlendes QA-Backend)
> gelten nicht mehr als aktueller Stand. Noch keine Produktionsfreigabe.

## Ergebnis

**Lokale Prüfungen bestanden; noch keine Freigabe für einen vollständigen Produktionsrollout.**

| Prüfung | Ergebnis | Aussagegrenze |
| --- | --- | --- |
| Jest: App, RevenueCat-Anbindung, Familien-Endpunkte, QR-Einladungen | 214 Tests in 11 Suites bestanden | SDK, Provider-HTTP und Supabase-Client teilweise simuliert |
| Nativer PostgreSQL 15.18: SQL-Migration, Rechte, Trigger, Quoten, konkurrierende Annahmen | 60 Prüfungen bestanden | Isoliertes Basisschema mit relevanten Originalmigrationen; kein vollständiger Produktionsklon |
| PGlite mit erweitertem Einlöse-/Baby-Sync-Test | 58 Prüfungen bestanden | Gleiche Kernfälle, Ausführung seriell; nicht zu den 60 addieren |
| TypeScript für App und Tests | Bestanden | Kein nativer Geräte-Build |
| ESLint auf geänderten TypeScript-Dateien | 0 Fehler, 4 bestehende Import-Warnungen in revenuecat.test.ts | Kein vollständiger Repository-Lint |
| Live-Katalog, ausschließlich SELECT | Familien-RPC und Mitgliedertabelle fehlen; Code-Einlöse-RPC vorhanden | Keine Produktionsänderung |

Protokolle liegen unter `output/family-subscription-tests-20260912/`:
`jest.json`, `jest.log`, `postgres.log`, `typecheck.log`, `lint.log`,
`qr-before-fix.log` und `manifest.json` mit Prüfsummen der geprüften Dateien.

## Gefundener und behobener Fehler

Der QR-Parser akzeptierte nur achtstellige Einladungscodes. Die neue
Datenbank erzeugt 32-stellige Hex-Codes; das Eingabefeld war bereits angepasst,
der Scanner nicht. Zwei neue Regressionstests schlugen vor der Korrektur fehl.

Der Parser akzeptiert jetzt beide Formate. Die Herkunftsprüfung für gescannte
Links bleibt bestehen. Zusätzliche Tests prüfen direkte Codes, Links, den
Kamera-Callback und ungültige lange Codes. Das korrigiert den Arbeitsstand;
bereits installierte alte App-Versionen werden dadurch nicht aktualisiert.

## Zusätzlich nachgewiesene Fälle

- Apple `family_shared` behält Lite, Standard und Premium im Backend und darf
  die jeweils freigegebenen Funktionen verwenden. Es entsteht kein teilbarer
  Kaufnachweis und damit keine Weitergabe an einen weiteren Partner.
- Der SDK-Pfad erkennt Apple `FAMILY_SHARED` für alle sechs Tarif-/Laufzeitkombinationen
  weiterhin als aktiv und startet keinen zusätzlichen Kauf.
- Eigene bezahlte Käufe aus App Store und Play Store erzeugen Kaufnachweise.
  Sandbox, Trials, Promotions und fremde Käuferidentität tun dies nicht.
- Einlösen über den von der App verwendeten
  `redeem_invitation_code_and_sync_due_date` funktioniert mit Großschreibung
  des Servercodes. Baby-Mitgliedschaft und Geburtsstatus werden mit übertragen.
- 20 gleichzeitige Frag-Lotti-Quotenanfragen über unabhängige PostgreSQL-Verbindungen:
  genau drei zugelassen, gemeinsamer Zähler des Zahlers.
- Zwölf gleichzeitige Fürsorge-Quotenanfragen: genau drei zugelassen.
- Zwölf konkurrierende Annahmen derselben Einladung durch zwei Konten:
  genau eine erfolgreich, genau zwei Mitgliederplätze entstehen.
- Bereits vorhandene Fälle zu Fremdzugriff, Rechteänderung, Abo-Entzug,
  Verknüpfungstrennung, Ablauf, unbekanntem Backend-Status, verspäteten Antworten,
  Kontowechsel und begrenzter Offline-Freigabe wurden erneut ausgeführt.

## Reproduzieren

Die nativen PostgreSQL-Testwerkzeuge wurden außerhalb der App-Abhängigkeiten
installiert. Dafür wurde weder package.json noch der Lockfile geändert.

```sh
npm install --prefix /tmp/lotti-family-postgres-tools --save-exact embedded-postgres@15.18.0-beta.17
node scripts/tests/family-subscription-sql.test.mjs /tmp/lotti-family-postgres-tools/node_modules/embedded-postgres/dist/index.js --postgres
npx jest --runInBand lib/__tests__/familySubscriptionAccess.test.ts lib/__tests__/familySubscriptionTier.test.ts lib/__tests__/familySubscriptionScreen.test.tsx lib/__tests__/familySubscriptionBackend.test.ts lib/__tests__/revenuecatBackend.test.ts lib/__tests__/revenuecat.test.ts lib/__tests__/subscriptionAccess.test.ts lib/__tests__/premiumStatusCache.test.ts lib/__tests__/paywall-screen.test.tsx lib/__tests__/account-linking-qr.test.ts lib/__tests__/account-linking-qr-modal.test.tsx
npm run typecheck
```

## Was für die Geräteabnahme noch fehlt

Der Nutzer hat bestätigt, dass noch keine Store-Testzugänge eingerichtet sind.
ADB zeigt kein angeschlossenes Android-Gerät. Sechs iOS-Simulatoren sind verfügbar;
sie wurden für diese Tests nicht gestartet. Über die Supabase-CLI ist nur das
Produktivprojekt verfügbar. Keine separate gehostete Testumgebung wurde angelegt.

1. **Apple-Testfamilie:** In App Store Connect unter „Users and Access → Sandbox“
   mindestens zwei Sandbox-Konten derselben Region anlegen. Unter „Family Sharing“
   eine Testfamilie erstellen, Organisator und Mitglied auswählen und Teilen/Empfangen
   aktivieren. Die Abo-Produkte müssen Family Sharing unterstützen.
   [Apple-Anleitung](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings).
2. **Google-Lizenztester:** Ein dediziertes Google-Konto als Lizenztester konfigurieren
   und auf dem Android-Testgerät anmelden. Bei Nutzung des internen Testtracks zusätzlich
   für den Track freischalten. Ein interner Testtrack allein verhindert keine echten
   Zahlungen; im Kaufdialog muss die Testzahlungsart erscheinen.
   [Google-Anleitung](https://developer.android.com/google/play/billing/test).
3. **Isoliertes Backend für Geräte:** Auth, relevante Migrationen, Funktionen und
   RevenueCat-Anbindung bereitstellen; passende App-Testbuilds damit verbinden.
   Normale App-Konten verwenden, keine Admin-/Tester-Sonderrechte.
4. **Positive Sandbox-Partnerfreigabe vorbereiten:** Der aktuelle Produktionscode
   verlangt `environment=production` und positiven Umsatz. Sandbox-Käufe dürfen
   dort keinen Partner freischalten. Ein ausschließlich für die isolierte
   Testumgebung geltender Prüfpfad für ausgewählte Sandbox-Konten ist noch nicht
   implementiert. Ohne ihn wäre ein erfolgreicher Store-Kauf noch kein positiver
   Ende-zu-Ende-Test der Partnerfreigabe. Simulierte Providerdaten ersetzen diesen
   letzten Nachweis nicht.

## Verbindliche Gerätefälle – alle noch offen

| ID | Schritte | Erwartetes Ergebnis |
| --- | --- | --- |
| G01 | Apple-Käufer A und Apple-Familienmitglied B mit bisheriger App vorbereiten; dann Testbackend und App aktualisieren | Beide behalten ihren Tarif ohne erneuten Kauf; B braucht keine LottiBaby-Verknüpfung |
| G02 | A lädt Android-Konto C ein; C scannt QR und nimmt an | C erhält den passenden Tarif; B behält Apple-Zugang; beide geschützten API-Pfade prüfen |
| G03 | B versucht eigenen Partner D freizuschalten | Kein Abo-Zugang für D durch weitergereichte Apple-Freigabe |
| G04 | Google-Käufer mit iPhone-Partner verbinden | Gleicher Ablauf in Gegenrichtung; Lite/Standard/Premium und monatlich/jährlich prüfen |
| G05 | Partner hat bereits ein eigenes Abo | Höherer Tarif gilt; bestehendes eigenes Abo bleibt verwaltbar und wird nicht automatisch gekündigt |
| G06 | Reguläre Kündigung, Ablauf, Erstattung und Zahlungsfrist jeweils separat auslösen | Kündigung behält Zugang bis bestätigtem Ende; Entzug folgt bestätigt verarbeitetem Store-Zustand |
| G07 | Verbindung lösen, neu anmelden, App neu starten, zwischen Konten wechseln | Keine Übernahme fremder Rechte; Trennung wirkt bei nächster Backend-Entscheidung |
| G08 | Netzwerk/Provider/Webhooks in Testumgebung unterbrechen und wiederherstellen | Keine unbefristete Verlängerung; lokale Partnerfreigabe endet spätestens mit ihrer fünfminütigen Gültigkeit; Erholung erneut prüfen |
| G09 | Doppelte und verspätete Store-Ereignisse sowie verlorenen Webhook nachstellen | Kein Wiederaufleben widerrufener Rechte; geplanter Abgleich repariert den Zustand |
| G10 | Alte installierte App gegen vorbereiteten Backend-Rollout testen | Bestehende Einladungs-/Babyabläufe bleiben nutzbar; aktueller 8-/32-Zeichen-Konflikt ist ein offener Rolloutblocker |
| G11 | Abschließende kontrollierte Produktionsprüfung mit eigenen Konten und echtem Apple-Familienabo | Sandbox-spezifische Unterschiede und Bestandsschutz prüfen; keine unbeteiligten Kundenkonten verwenden |

Für jeden Fall speichern: Build und Backend-Version, pseudonyme Testkonto-IDs,
Start-/Endzeit, Store-/RevenueCat-Status, RPC-/API-Ergebnis, gemessene Verzögerung,
erwartetes und tatsächliches Resultat. Keine Passwörter oder Tokens in Protokollen.
Store-Verarbeitung und unsere lokale Fünfminutenfrist sind getrennte Messwerte;
ein Store-Widerruf ist nicht zwangsläufig innerhalb fünf Minuten zugestellt.

## Verbleibende Rolloutfragen

- Alte Apps verstehen die neuen Codes noch nicht. Der Gesamtrollout verändert
  außerdem bestehende Verknüpfungsrechte und KI-Prüfungen; er ist nicht wirkungslos.
- Alte LottiBaby-Verknüpfungen werden nicht automatisch zu bestätigten
  Abo-Mitgliedschaften. Dafür braucht es einen geprüften Übergang. Apple-Familienzugang
  ist davon unabhängig.
- App-Tests, Datenbankprüfungen und echte Store-Abnahme sind getrennte Nachweise.
  Dieser Bericht bestätigt keine vollständige Ausfallsicherheit oder Unumgehbarkeit.
