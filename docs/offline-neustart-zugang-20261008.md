# Offline-Neustart mit gespeichertem Zugang — 8. Oktober 2026

## Umsetzung

Die Startfreigabe überlebt jetzt einen vollständigen Neustart. Ein bestätigter Zugang wird mit Backend-Host, Konto-ID, Zugangsgrund, ursprünglichem Prüfzeitpunkt und Ablauf gespeichert. Der Nachweis gilt höchstens **24 Stunden**; ein bekanntes früheres Abo-Ende verkürzt ihn. Beschädigte, fremde, zukünftige oder abgelaufene Nachweise öffnen die App nicht.

Der Nachweis dient der lokalen Anzeige. Er enthält keine Auth-Tokens, Gesundheitsdaten oder Abo-Tiers. Die bestehenden Tier-Prüfungen, die kurze Familienabo-Lease, Einwilligungen und serverseitigen Berechtigungen bleiben eigenständig.

`lib/startupAccess.ts` speichert den Nachweis. Schreibvorgänge werden serialisiert. Abmelden, Kontowechsel und bestätigter Zugangsentzug invalidieren laufende Vorgänge sofort und entfernen den Nachweis nach bereits begonnenen Schreibvorgängen. Auch ein zusammengefasster Abmelden-/Anmelden-Vorgang mit derselben Konto-ID darf keine frühere Freigabe oder verspätete Antwort übernehmen.

`lib/startupAccessVerification.ts` prüft Auth und Sonderrollen frisch. Eigene Store-Abos verwenden das ursprüngliche `CustomerInfo.requestDate` und das bekannte Abo-Ende. Wiederholtes Lesen eines Provider-Caches verlängert den Nachweis nicht. Familienzugang behält bei einem Netzausfall ebenfalls seinen letzten tatsächlichen Prüfzeitpunkt. Eine alte negative Provider-Antwort oder ein fehlgeschlagener Zugriff gilt als unbekannt. Bestätigte Abwesenheit aller Zugangspfade oder die ausdrücklichen Auth-Serverantworten `user_not_found`/`session_not_found` führen zur Sperre.

Die Startgrenze liest den gespeicherten Nachweis vor Abschluss der Netzprüfung. Netzprüfungen sind auf 15 Sekunden begrenzt. Nach erfolgreichem Serverkontakt oder Rückkehr in den Vordergrund wird erneut geprüft; bei unbekanntem Zugang läuft ein begrenzter Versuch alle 30 Sekunden, solange die App aktiv ist. Ein unbekanntes Ergebnis lässt einen noch gültigen Nachweis bestehen, erneuert ihn aber nicht. Auch während einer geöffneten App wird sein Ablauf berücksichtigt.

Ein abgelaufener Auth-Token darf die lokale Wiederherstellung nicht blockieren. `AuthContext` liest daher parallel zur normalen SDK-Wiederherstellung die vorhandene Supabase-Sitzung aus deren bestehendem Speicher. Diese lokale Anzeige wird nur mit gültigem Zugangsnachweis geöffnet. Der SDK-Token-Refresh läuft weiter; bestätigte Auth-Änderungen gewinnen vor verspäteten Speicher- oder Netzantworten. Dabei wird auch die lokale Einwilligungsidentität wiederhergestellt. Ein unaufgelöstes `INITIAL_SESSION: null` darf sie nicht verwerfen.

Der bereits gespeicherte Onboarding-Abschluss wird vor den Profil-/Einstellungsabfragen geladen. Damit kann auch eine hängende Auth-Erneuerung diese Startvoraussetzung nicht länger blockieren. Die normale Prüfung läuft weiter im Hintergrund.

Gespeicherte Kinderauswahl, Baby-Status, Einwilligung, bestätigte lokale Daten und unterstützte Entwürfe verwenden weiterhin die vorhandenen Speichermechanismen. Ein lokaler Einwilligungswiderruf bleibt wirksam. Der Zugangsnachweis eröffnet keine neue Einwilligung.

## Lokaler Nachweis

Der Integrationstest `lib/__tests__/offlineStartupIntegration.test.tsx` erzeugt einen neuen Provider-Baum mit echten Auth-, Einwilligungs-, Kinderauswahl-, Baby-Status-, Onboarding- und Startgrenzen-Komponenten. Die SDK-, Profil-, Einstellungs- und Serverabfragen hängen absichtlich. Die Daten im Speicher sind synthetisch.

Geprüft werden die Wiederherstellung bei abgelaufenem Auth-Token, die ausgewählte Baby-Ansicht, bestätigte Tagesdaten, der unveränderte Fläschchen-Entwurf mit ursprünglicher Startzeit, der weiterhin offene Bildschirm nach Netz-Timeout und ein weiterer Neustart. Abgelaufener Zugang und lokal widerrufene Gesundheitseinwilligung öffnen den geschützten Inhalt nicht.

Zusätzliche Tests decken Konto-/Backend-Isolation, Zeitgrenzen, frühere Abo-Enden, beschädigte Daten, Schreibfehler, laufende Schreibvorgänge bei Abmeldung, verspätete Antworten, Kontowechsel, bestätigten Entzug und Wiederverbindung ab. Bestehende Abo-, Paywall-, Datenschutz-, Cache- und Entwurfstests wurden ebenfalls ausgeführt.

- **253 Tests in 26 Suiten bestanden**. Ergebnisse: `output/offline-startup-access-20261008/test-results.json`.
- TypeScript für App und Tests bestanden: `npm run typecheck`.
- ESLint: `output/offline-startup-access-20261008/lint-results.json`; keine Fehler, bestehende Warnungen zu Effekt-/Ref-Mustern und Legacy-Imports.
- `git diff --check` bestanden.

## Auslieferung und Geräteprüfung

Der Stand wurde am **8. Oktober 2026 um 20:07 MESZ** per EAS Update für den bestehenden **iOS-TestFlight-Kandidaten** veröffentlicht:

- Projekt: `janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`.
- Kanal/Branch: `release-candidate-20261003`; iOS-Runtime `1.0.25`; EAS-Environment `production`.
- Update-Gruppe: [`569f3d69-cba3-48f0-a1fa-ad05b374529a`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/569f3d69-cba3-48f0-a1fa-ad05b374529a).
- iOS-Update: `01a11cb3-2fc9-748d-a43b-3c4302b529bd`.

Die isolierte Quelle basiert auf der zuletzt veröffentlichten Startansicht (`7cd30583-2407-49d1-abb1-62ad0ac7aec1`) und ergänzt ausschließlich die zehn App-Dateien des Offline-Neustart-Fixes sowie acht Testdateien. Paket-/Lock-Dateien und native Konfiguration bleiben identisch. Auch in dieser Quelle bestanden alle 253 Tests in 26 Suiten, die App-Typeprüfung und die Typeprüfung der ausgewählten Clienttests.

Das ausgelieferte Manifest bestätigt die iOS-Update-ID, Runtime, den geprüften Hermes-Bundle-Hash und alle 120 unveränderten Assets. Alle fünf Kanalzuordnungen und die anderen Update-Gruppen bleiben unverändert; der Android-Kandidat bleibt bei `01a11656-ef91-71a3-bc06-a4c2093a1849`. Direkter CDN-Bundleabruf lieferte HTTP 403, daher besteht keine zusätzliche Byte-Prüfung am CDN. Nachweise: `output/offline-startup-access-20261008/{source-preparation,export-preflight,export-verification,served-manifest-verification,publication-verification}.json`.

Installation und Offline-Neustart auf einem physischen Gerät sind noch nicht bestätigt. Der automatisierte Neustarttest ersetzt keine Prozessbeendigung auf einem iPhone oder Android-Gerät.

Die Kandidaten-App zunächst mit Internet öffnen, den Download abwarten, vollständig beenden und erneut öffnen; gegebenenfalls ist ein zweiter Neustart nötig. Nach Aktivierung des Updates muss die App einmal mit Internet einen Zugang bestätigen und den Nachweis speichern. Bereits vorhandene Tier- oder Gesundheits-Caches werden nicht nachträglich als neuer Startnachweis ausgegeben.

Für die Geräteabnahme:

1. Mit Internet anmelden, Zugang bestätigen, ein Kind wählen und Tagesdaten laden. Einen unterstützten Fläschchen-/Windel-Entwurf vorbereiten.
2. Die App vollständig beenden, Internet ausschalten und erneut starten. Kind, Ansicht, bestätigte Daten und ursprüngliche Entwurfswerte müssen erhalten sein.
3. Internet wieder einschalten und die Hintergrundprüfung beobachten. Ein gültiger Zugang muss bestehen bleiben; bestätigter Entzug muss sperren.
4. Abmelden und erneut offline starten. Das vorherige Konto darf nicht wiederhergestellt werden. Einen Kontowechsel sowie einen abgelaufenen Nachweis mit einer kontrollierten QA-Fixture separat prüfen.

Neue Offline-Schlafstarts bleiben offen. Schlaf-Paket S wird durch diese Änderung nicht aktiviert. Es wurden keine Server-Migrationen, Store-Freigaben, Git-Commits oder Pushes vorgenommen.
