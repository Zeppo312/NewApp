# Auftrag 1: Android-Abo-Zuordnung in Produktion korrigieren

**Status 24.09.2026: abgeschlossen.** Dieser Prompt ist nur noch die historische Auftragsbeschreibung. Das tatsächliche Ergebnis mit Produktionsversionen, 122/122 abgeglichenen Einträgen und erfolgreichem Lite-Gerätetest steht am Anfang von `docs/android-play/step-10.md`. Auftrag 1 nicht erneut ausführen; für den Familienzugang `agent-prompt-2-familienzugang.md` verwenden.

Arbeite im Projekt `/Users/janzeppenfeld/Developer/LottiBaby`. Behebe die falsche serverseitige Tarifzuordnung vollständig: Implementierung, passende Tests, koordinierter Produktionsrollout, kontrollierter Abgleich bestehender Einträge und erneuter kostenloser Android-Testkauf. Erkläre Fortschritt und Ergebnis kurz auf Deutsch. Beginne mit der Prüfung des aktuellen Zustands; bleibe nicht bei einem Plan stehen.

## Verbindlicher Ausgangspunkt

Lies `docs/android-play/step-10.md`, `docs/android-play/product-map.md`, `docs/family-subscription-access.md` und geltende AGENTS-/Skill-Anweisungen. Der Stand vom 24.09.2026 ist eine Übergabe, keine Garantie für den aktuellen Live-Zustand.

- Produktion: Supabase `kwniiyayhzgjfqjsjcfu`. Der Root-CLI-Arbeitsbereich ist damit verknüpft. Die authentifizierte Supabase-CLI funktionierte; der Connector hatte keinen Zugriff auf dieses Projekt.
- Separates Familien-QA-Projekt: `ggyonianphloycmqrwvj`, dokumentiert in `docs/family-qa-setup.md`. Dieses besitzt bereits ein erweitertes Schema; ein erfolgreicher Test dort beweist deshalb noch keine Kompatibilität mit dem alten Produktionsschema.
- Alle sechs Google-Basispläne sind aktiv und bei RevenueCat zugeordnet. Preise und Produktkatalog sind fertig.
- Ein kostenloser Google-Lizenztest auf dem Samsung war erfolgreich. Die App zeigte Lite, der Produktions-Webhook speicherte jedoch `tier=premium`, `is_premium=true`, `product_id=entl7a7b4e9838`. Nach Kündigung/Ablauf wurde der Zugang wieder entzogen.
- Die gemeinsame RevenueCat-Berechtigung `LottiBabyAbo` / `entl7a7b4e9838` gilt für alle Tarife. Die bereitgestellte `_shared/premiumAccess.ts` interpretiert sie fälschlich als Premium.
- Vier bereitgestellte Functions verwenden diese Logik: `revenuecat-webhook`, `ask-lotti`, `advisor-generate`, `voice-log-parse`. Prüfe auch weitere Leser/Schreiber des Tarifcaches.
- Zuletzt enthielten 122 Cache-Zeilen diese gemeinsame ID als angebliches Premium-Produkt. Das bedeutet nicht, dass alle 122 Konten tatsächlich falsch eingestuft sind. Ihre echten Tarife müssen neu ermittelt werden.

## Umsetzung

1. Sichere und prüfe die aktuellen bereitgestellten Function-Versionen und das tatsächliche Datenbankschema. Lade Function-Bundles bei Bedarf in getrennte Verzeichnisse, damit Downloads ihre jeweiligen Shared-Dateien nicht gegenseitig überschreiben. Der alte Audit-Download unter `/tmp/lotti-prod-webhook-audit-20260924/` ist nur ein historischer Hinweis.
2. Verwende die produktbasierte Auflösung aus `supabase/functions/_shared/revenuecatState.ts`: aktuell zugangsberechtigtes RevenueCat-Abonnement, tatsächliche Store-Produktkennung, exakte Zuordnung zu Lite/Standard/Premium. Vergleiche mit `lib/revenuecatProducts.ts`. Google verwendet `lottibaby_<tier>:monthly` bzw. `:yearly`; Apple Standard verwendet `lottibaby_monthly` und `lottibaby_yearly`.
3. Übernimm die nötige Korrektur in eine zum aktuellen Produktionsschema passende Lösung. Der aktuelle Repository-Stand von `premiumAccess.ts` schreibt bereits `paid_*`-Spalten und benötigt Familien-/Account-Deletion-Infrastruktur, die zuletzt in Produktion fehlte. Für diesen Auftrag die Tarifkorrektur ohne den umfassenden Familienabo-Rollout umsetzen. Vorhandene Familienimplementierung erhalten und die Reparatur reproduzierbar im Repository dokumentieren.
4. Alte Cache-Werte mit der gemeinsamen Entitlement-ID dürfen auch bei einem Providerfehler nicht wieder als bestätigtes Premium dienen. API-Ausfälle nicht als Kündigung behandeln; Ablauf, Wiederherstellung und gleichzeitig eintreffende Webhooks berücksichtigen. Alle vier Functions müssen die korrigierte Logik erhalten. Bestehende Authentifizierung, Signaturprüfung und Deployment-Einstellungen erhalten.
5. Teste die tatsächlich zu deployende Lösung gegen das Produktionsschema, einschließlich Lite, Standard, Premium, beiden Stores, alten Cache-Einträgen, API-Fehlern und Ablauf. Vorhandene Tests in `lib/__tests__/revenuecatBackend.test.ts` und `familySubscriptionBackend.test.ts` sind hilfreich; deren bisherige 88 erfolgreichen Tests allein belegen keinen erfolgreichen Hotfix.
6. Rolle die geprüfte Korrektur koordiniert aus. Gleiche danach die betroffenen Cache-Einträge einzeln mit RevenueCat ab, mit begrenzter Rate, Fehlerprotokoll und wiederholbarer Verarbeitung. Keine pauschale Herabstufung aller 122 Konten und kein ungeprüfter Migration-Push. Offene Verifikationsfehler ausdrücklich ausweisen.
7. Wiederhole den kostenlosen Android-Test und prüfe App-Anzeige, Datenbank und echte serverseitige Feature-Entscheidung: Lite muss `tier=lite`, `is_premium=false` und die passende Produkt-ID ergeben; Premium-only-Funktionen bleiben gesperrt. Kündigung und Ablauf ebenfalls nachweisen. Standard/Premium sinnvoll mitprüfen; nicht ausgeführte Gerätefälle als offen markieren.

## Geräte- und Arbeitsregeln

Samsung SM-A528B, Android 14, zuletzt ADB-Seriennummer `RZCT41N7CWR`; Verbindung neu prüfen. Google-Konto ausschließlich `jan.zepp1999@gmail.com`. Das andere Google-Konto nicht erneut anmelden oder verändern. Im Kaufdialog müssen dieses Konto, eine Testkarte und ausdrücklich keine reale Belastung erkennbar sein. Die zuletzt installierte Play-Version `1.0.23 (4)` nutzt Produktion. Die frühere QA-APK hatte eine andere Signatur und ein Problem mit der Google-Kontowahl; daher nicht blind darüberinstallieren oder erneut App-Daten löschen.

Das Repository enthält viele bestehende, teils uncommittete Änderungen. Erhalte sie. Ein neuer Worktree enthält diese Änderungen nicht automatisch. Keine Secrets oder Kundenlisten ausgeben, keine echten kostenpflichtigen Käufe auslösen. Preise und Store-Produkte für diese Reparatur erhalten.

## Abschluss und Übergabe

Aktualisiere `docs/android-play/step-10.md` mit Deployment-Versionen, tatsächlichen Tests, Zahl erfolgreich abgeglichener/offener Konten und klarer Trennung zwischen lokal, QA und Produktion. Gib dem nächsten Agenten die genaue technische Umsetzung weiter, damit der Familienabo-Rollout die Tarifkorrektur nicht überschreibt. Melde den Auftrag erst als abgeschlossen, wenn der Produktionsfehler behoben und der erneute Kaufnachweis erbracht ist; fehlenden Gerätezugang oder andere echte Hindernisse konkret benennen.
