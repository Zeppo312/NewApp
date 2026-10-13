# Schlafuhr ohne zusätzliche Startzeile – 13. Oktober 2026

Die zusätzliche Beschriftung mit Play-Symbol direkt unter der Uhr entfällt.
Die Uhr bleibt über ihren vorhandenen Touchbereich als Startknopf nutzbar.
Der lokalisierte Accessibility-Name, Busy-/Disabled-Zustand und Doppeltap-Schutz
bleiben erhalten. Die reguläre Startkarte unter „Schlaferfassung“ bleibt bestehen.

Nur `components/tracking/SleepTimerFace.tsx` wurde angepasst. Die unveränderten
sechs Uhrtests bestehen; Typecheck und ESLint sind erfolgreich. In der
Web-Vorschau ist die Zeile entfernt; Antippen der Uhr wechselt weiterhin zum
laufenden Timer. Die Vorschau verwendet Beispieldaten und vereinfachte native
Icons/Blur. Die native Nachkontrolle und Installation am Gerät bleiben offen.

Die isolierte Quelle `.family-qa/sleep-clock-label-20261013/source` ergänzt
Gruppe `37c6d728-3c09-41c2-87e6-26f2b1fa7ffd`. Alle anderen Quelldateien,
Abhängigkeiten, native Konfigurationen und Assets sind gegenüber der Basis
identisch. Ziel ist der bisherige Kanal `release-candidate-20261003`,
Runtime `1.0.25`, iOS und Android, EAS-Umgebung `production`.
Prüfnachweise: `output/sleep-clock-label-20261013/`.

Es wurden keine Pakete installiert, keine nativen Builds ausgelöst und keine
Git-Änderungen gestaged, committed oder gepusht.

EAS-Gruppe `7527cee1-cf46-4f0b-9f0a-6fa8b058d8db`:
https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/7527cee1-cf46-4f0b-9f0a-6fa8b058d8db

Die ausgelieferten Manifest-IDs, Runtime und Bundle-/Asset-Hashes stimmen mit
dem geprüften Export überein. Kanalzuordnungen und Main-Update sind unverändert.
Der direkte CDN-Byteabruf liefert hier HTTP 403; die Veröffentlichung wurde
über die gelieferten Manifeste und Hashes geprüft, nicht über eine Installation.
