# Offline-Startansicht — 8. Oktober 2026

## Befund und Korrektur

Der fotografierte weiße Bildschirm stammt aus `components/paywall/root-paywall-gate.tsx`. Bei einem Kaltstart kann die netzabhängige Zugangsprüfung ohne Internet zunächst kein Ergebnis bestätigen. Der bisherige Zustand zeigte einen kleinen Text und eine blaue Standardschaltfläche auf weißem Hintergrund.

Die Darstellung verwendet jetzt den gewählten Lotti-Baby-Hintergrund, eine abgerundete Karte, das Verbindungssymbol, eine klare Überschrift und eine violette Wiederholen-Schaltfläche. Abmelden bleibt als zweite Aktion erreichbar. Auch die allgemeine Startwiederherstellung in `components/StartupRecovery.tsx` nutzt dieselbe Gestaltung. Ladezustand, helle und dunkle Darstellung sowie deutsche, englische und spanische Texte sind berücksichtigt. Bei großer Schrift kann die Ansicht scrollen; Aktionsflächen sind mindestens 48 Punkte hoch.

Die gemeinsame Darstellung liegt in `components/ui/connection-recovery-screen.tsx`. Auf iOS verwendet das vorhandene `IconSymbol` ein natives SF Symbol; Android bekommt die Material-Zuordnung `wifi-off`.

## Verhaltensgrenze

Die Zugangsentscheidung wurde nicht verändert. Ein unbestätigter Offline-Kaltstart öffnet weiterhin keine geschützte Sitzung. Bereits bestätigte laufende Sitzungen bleiben bei vorübergehenden Prüffehlern erhalten. Wiederholen, Abmelden, die Startwiederherstellung nach 15 Sekunden, automatische Startwiederholungen und der Schutz des weiterhin montierten Navigators bleiben bestehen.

Schlaf-Paket S bleibt deaktiviert. Keine Serverfreigabe, Migration, native Änderung, Git-Veröffentlichung oder Zusammenführung wurde vorgenommen.

## Prüfung

- 40 Tests in fünf Suiten bestanden: Root-Zugangsgrenze, Startwiederherstellung, Paywall-Verfügbarkeit und -Entscheidung sowie Wiederherstellung des Abozugangs.
- TypeScript für App und Tests sowie separat für den isolierten Update-Stand bestanden.
- Lint der berührten Dateien: 0 Fehler, 0 Warnungen. Diff-Prüfung bestanden.
- Lokale Browser-Vorschau mit dem tatsächlichen Bildschirm: 393 Punkte in heller Darstellung; 320 Punkte, dunkle Darstellung, spanischer Text und 1,4-fache Schriftgröße; englischer Ladezustand. Wiederholen und Abmelden lösen ihre jeweiligen Vorschau-Callbacks aus. Kein horizontaler Überlauf; große Aktionsflächen bleiben durch Scrollen erreichbar.
- Die Vorschau simuliert den Zustand der Zugangsprüfung und stellt das native Symbol durch SVG dar. Sie ersetzt keine Prüfung auf dem iPhone.
- Alle fremden lokalen Änderungen erhalten. Der isolierte Update-Stand übernimmt den vorher veröffentlichten Kandidaten und ergänzt ausschließlich diese Darstellung samt angepasster Tests.

## EAS-Auslieferung

- Projekt: `janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`.
- iOS, Kanal und Branch `release-candidate-20261003`, Runtime `1.0.25`, Umgebung `production`.
- Gruppe: `7cd30583-2407-49d1-abb1-62ad0ac7aec1`.
- iOS-Update: `01a11c31-9002-71a9-a22e-aa1df46a4a06`.
- Veröffentlichung: 8. Oktober 2026, 17:46 MESZ.
- [EAS-Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/7cd30583-2407-49d1-abb1-62ad0ac7aec1).

Der Hermes-Export passt zum bisherigen iOS-Kandidaten. Runtime, native Abhängigkeiten, eingebettetes Backend und Abrechnungskonfiguration bleiben kompatibel. Alle 120 Assets entsprechen dem bisherigen Kandidaten.

Das Update-Manifest liefert die neue iOS-ID mit den geprüften Bundle- und Asset-Hashes. Alle fünf Kanalzuordnungen, andere Kanäle, `main` und das Android-Update sind unverändert. Der isolierte Quellstand blieb während der Veröffentlichung unverändert.

Der direkte Bundle-Abruf vom CDN wurde hier mit HTTP 403 beantwortet. Eine Installation dieses Updates und der anschließende Offline-Neustart auf dem physischen TestFlight-iPhone sind daher noch nicht nachgewiesen.

Für die Geräteprüfung die TestFlight-App mit Internet öffnen, kurz warten und vollständig schließen. Erneut öffnen, damit das geladene Update übernommen werden kann; anschließend den Offline-Kaltstart prüfen.

## Nachweise

- `output/offline-start-screen-20261008/local-verification.json`
- `output/offline-start-screen-20261008/export-verification.json`
- `output/offline-start-screen-20261008/served-manifest-verification.json`
- `output/offline-start-screen-20261008/publication-verification.json`
- `output/offline-start-screen-20261008/start-light-393.png`
- `output/offline-start-screen-20261008/start-dark-large-320.png`
- `output/offline-start-screen-20261008/start-loading-320.png`

Private Rohprotokolle liegen lokal unter `.family-qa/offline-start-screen-20261008/`.
