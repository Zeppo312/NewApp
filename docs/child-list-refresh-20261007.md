# Kinder-Auswahl: Aktualisierung beim Öffnen

Lokal umgesetzt am 7. Oktober 2026, im vom Nutzer zuletzt eingegrenzten Umfang.

## Verhalten

Beim Öffnen lädt die Kinder-Auswahl frisch und umgeht dabei den bestehenden Fünf-Minuten-Cache. Vorhandene Kinder bleiben währenddessen sichtbar und auswählbar. Die Anzeige „Kinder werden aktualisiert …“ bleibt während automatischer Wiederholungen stehen.

Vorübergehende Netzwerk-, Timeout- und passende Serverfehler führen zu maximal zwei weiteren Versuchen nach 500 und 1.500 Millisekunden. Jeder Versuch ist auf zehn Sekunden begrenzt. Mehrere gleichzeitige Aktualisierungsaufrufe teilen denselben laufenden Vorgang.

Nach erfolglosen Wiederholungen erscheint „Kinder konnten nicht aktualisiert werden.“ mit „Erneut versuchen“. Die bestehende Liste und die aktive Schwangerschaft bleiben bei vorübergehenden Fehlern erhalten. Berechtigungsfehler und Einwilligungsabbrüche werden nicht wiederholt und erhalten keine inzwischen unzugänglichen Daten in der sichtbaren Liste. Die Texte sind auf Deutsch, Englisch und Spanisch vorhanden.

Beide Listenabfragen müssen erfolgreich sein, bevor das zusammengeführte Ergebnis als vollständig gespeichert oder übernommen wird. Das Resultat einer einzelnen erfolgreichen Abfrage überschreibt den Cache nicht mehr. Fehlgeschlagene Folgeabfragen nach dem Partnerabgleich werden ebenfalls als Fehler behandelt, statt daraus ein neues Platzhalterkind abzuleiten.

Liste und aktive Auswahl werden gemeinsam übernommen. Eine bewusste Auswahl während des Nachladens und ein zwischenzeitlicher Kontowechsel werden nicht durch ältere Antworten überschrieben.

## Dateien

- `lib/baby.ts`: parallele Abfragen, Vollständigkeitsprüfung, unverfälschte Auth-Fehler, Abbruchsignal und Speicherung ausschließlich erfolgreicher Gesamtergebnisse.
- `lib/babyListLoading.ts`: begrenzte Wiederholungen, Zeitlimit und Fehlerklassifizierung.
- `contexts/ActiveBabyContext.tsx`: vorhandene Daten bei vorübergehenden Fehlern erhalten, laufende Aktualisierungen zusammenführen und Auswahl/Kontoschutz.
- `components/BabySwitcherButton.tsx`: Aktualisierung beim Öffnen, Ladeanzeige und manuelle Wiederholung neben vorhandenen Einträgen.

Der bestehende Cache und der bisherige anfängliche Cache-Ladepfad bleiben bestehen. Bereits verkürzte alte Cache-Einträge können daher vor dem Öffnen weiter angezeigt werden; eine erfolgreiche Aktualisierung beim Öffnen ersetzt sie. Die zuvor vorgeschlagene umfassende Umstellung des App-Starts wurde nicht umgesetzt.

## Prüfung

Vier gezielte Jest-Suiten mit 33 bestandenen Tests:

- `babyListLoading.test.ts`: vollständige Listen, beide Richtungen eines Teilabfragefehlers, Cacheerhalt, Wiederholung bis zur Ergänzung der Schwangerschaft, Wiederholungslimit, Auth-Netzwerkfehler, permanente Fehler, hängende/abgebrochene Requests und keine Speicherung verspäteter Ergebnisse.
- `babySwitcherRefresh.test.tsx`: Aktualisierung beim Öffnen, sichtbare Liste während des Ladens, manuelle Wiederholung nach ausgeschöpften Versuchen, Auswahl-/Kontowechsel, gemeinsam übernommene Liste und aktive Auswahl, konkurrierende Aktualisierungen und keine Platzhalteranlage nach fehlgeschlagener Folgeabfrage.
- `babySave.test.ts` und `linked-baby-selection-retry.test.tsx`: vorhandene Prüfungen für Profiländerungen und die verknüpfte Kinder-Auswahl.

TypeScript für App und Tests ist ohne Fehler durchgelaufen. `git diff --check` ist sauber.

Logs: `output/child-list-investigation-20261007/jest.log`, `typecheck-app.log`, `typecheck-tests.log`.

Es wurden keine Produktionsdaten, Datenbankregeln oder Migrationen verändert. Prüfung auf einem realen iOS-/Android-Gerät steht aus. Die konkreten Kontodaten des gemeldeten Vorfalls konnten wegen des fehlenden Live-Zugriffs nicht überprüft werden.

## EAS Update

Am 7. Oktober 2026 um 14:05 Uhr (Europe/Berlin) für iOS und Android veröffentlicht:

- Kanal und Branch: `release-candidate-20261003`.
- Runtime: `1.0.25` auf beiden Plattformen; EAS-Variablenumgebung: `production`.
- Update-Gruppe: `606ca7e0-c28e-4e89-a14a-194816036d31`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/606ca7e0-c28e-4e89-a14a-194816036d31).

Ausgangspunkt ist der vollständig anhand der gespeicherten Dateihashes geprüfte Quellstand des vorherigen Kandidaten-Updates `5b961ae7-458a-40c1-be43-f24241bf74c7`. Darüber wurden ausschließlich die vier oben genannten App-Dateien und zwei neue Testdateien übernommen. Native Abhängigkeiten und das Asset-Paket sind unverändert. Die vier gezielten Test-Suiten mit 33 Tests sowie App-Typecheck und Typecheck der betroffenen Tests bestanden auch in diesem isolierten Quellstand. Der vollständige Test-Typecheck des isolierten Kandidaten scheitert an darin bewusst fehlenden Serverdateien, die unveränderte Backend-Tests importieren; im Hauptverzeichnis war der vollständige Test-Typecheck zuvor erfolgreich.

Die vom Update-Server ausgelieferten Manifeste stimmen auf beiden Plattformen mit den veröffentlichten IDs, Bundle-Hashes und sämtlichen exportierten Assets überein. Alle fünf Kanalzuordnungen und das öffentliche `main`-Update sind unverändert. Nachweise: `output/child-list-update-20261007/publication-verification.json`, `served-manifest-verification.json`, `export-verification.json` und die Test-/Typecheck-Logs im selben Ordner.

Beim ersten Upload wurde das geprüfte Paket aus dem Hauptverzeichnis veröffentlicht; diese EAS-CLI ermittelt die App-Konfiguration aus dem Arbeitsverzeichnis und verwendet dafür `EAS_PROJECT_ROOT` nicht. Dadurch erhielten die beiden Plattformen fälschlich die Runtimes `1.0.24` und `1.0.23`. Beide dadurch erzeugten Update-Gruppen wurden gelöscht und die vorherige Kandidaten-Gruppe erneut als letzter Stand bestätigt, bevor aus dem isolierten Quellverzeichnis korrekt veröffentlicht wurde. Die abgeschlossene Veröffentlichung und die Serverprüfung beziehen sich ausschließlich auf Runtime `1.0.25`.

Zum Anzeigen die installierte Kandidaten-Testversion mit Internetverbindung öffnen, anschließend vollständig beenden und erneut öffnen. Falls zunächst der alte Stand erscheint, nach dem Download noch einmal neu öffnen. Dann die Kinder-Auswahl öffnen. Dieser Abrufhinweis ersetzt keine Bestätigung der Änderung auf einem realen Gerät.
