# Umsetzungsplan: zuverlässige Kinder-Auswahl

Stand: 7. Oktober 2026. Dies ist der ursprüngliche umfassendere Plan. Der Nutzer hat anschließend den Umfang auf die Aktualisierung beim Öffnen der Kinder-Auswahl eingegrenzt. Die Umsetzung dieser kleinen Variante und die bestandenen Prüfungen sind in [child-list-refresh-20261007.md](child-list-refresh-20261007.md) dokumentiert. Die umfassende Umstellung des App-Starts ist nicht umgesetzt.

## Ziel

Die App zeigt eine bereits vollständig geladene Kinderliste schnell an und aktualisiert sie im Hintergrund. Vorübergehende Ladefehler werden begrenzt automatisch wiederholt. Eine fehlgeschlagene Teilabfrage darf weder eine Schwangerschaft aus der vollständigen Liste entfernen noch die gespeicherte Auswahl überschreiben.

Der reproduzierte Fehler liegt in der Verarbeitung zweier Abfrageergebnisse. Der konkrete Auslöser des gemeldeten Gerätevorfalls ist mangels Live-Zugriff weiterhin offen.

## 1. Vollständigkeit und Cache korrigieren

Datei: `lib/baby.ts`.

- Beide unabhängigen Abfragen für Familienzuordnung und eigene Kinder gleichzeitig starten.
- Das Ergebnis ausdrücklich als vollständig oder unvollständig kennzeichnen. Nur zwei erfolgreiche Abfragen ergeben eine vollständige Liste; null aufgrund eines Fehlers gilt nicht als leeres Ergebnis.
- Vollständige Ergebnisse anhand der Baby-ID zusammenführen und speichern.
- Eine neue Cache-Version mit Vollständigkeitskennzeichnung verwenden. Bisherige v1-Einträge sind nicht als vollständig verifiziert und dürfen nicht für eine endgültige Auswahl verwendet werden.
- Bei der Anmeldung den tatsächlichen Fehler erhalten, damit ein vorübergehender Auth-Netzwerkfehler nicht pauschal als fehlende Anmeldung behandelt wird.
- Unvollständige Ergebnisse nur vorläufig anzeigen, sofern keine vollständige Liste desselben Kontos vorliegt. Keine endgültige Auswahlkorrektur und kein dauerhafter Cache auf Grundlage eines Teilergebnisses.

## 2. Vorübergehende Fehler automatisch wiederholen

Datei: `lib/baby.ts`, gegebenenfalls ein kleines Hilfsmodul für Wiederholungsregeln.

- Bei Verbindungsfehlern, Zeitüberschreitungen und passenden vorübergehenden Serverfehlern maximal zwei weitere Versuche ausführen, beispielsweise nach 500 und 1.500 Millisekunden.
- Nur fehlgeschlagene Teilabfragen wiederholen; erfolgreiche Ergebnisse innerhalb desselben Ladevorgangs mitbenutzen.
- Nicht wiederholbare Anmelde-, Berechtigungs- und Abfragefehler direkt als solche behandeln.
- Anfragen zeitlich begrenzen, damit auch eine hängende Anfrage den Ladevorgang abschließt.
- Gleichzeitige Aktualisierungsaufrufe desselben Kontos auf einen laufenden Vorgang bündeln.
- Während der automatischen Wiederholungen noch keinen störenden Fehlerhinweis anzeigen.

## 3. App-Bereitschaft und Hintergrundladen trennen

Datei: `contexts/ActiveBabyContext.tsx`; bestehende Verbraucher in `app/_layout.tsx` und `contexts/BabyStatusContext.tsx` prüfen und nur bei Bedarf anpassen.

- Eine gültige vollständige Liste aus dem neuen Cache zunächst laden und das gespeicherte aktive Kind darin auflösen. Anschließend immer eine frische Hintergrundabfrage ausführen.
- App-Bereitschaft von laufender Aktualisierung und Vollständigkeit der Liste trennen. Eine bereits nutzbare App bleibt während der Aktualisierung nutzbar.
- Bei vorübergehenden Fehlern die vorhandene vollständige Liste, das aktive Kind und die aktuelle Ansicht erhalten.
- Beim ersten Start ohne vollständigen Cache kann die App bereit werden, sobald das gespeicherte aktive Kind zuverlässig geladen wurde. Ist gerade dieses Kind noch unbekannt, bleibt dessen Auflösung offen; es wird nicht ersatzweise Levi ausgewählt.
- Wenn gar keine frühere Auswahl existiert, kann ein erfolgreich geladenes Kind vorläufig verwendet werden. Die übrige Liste bleibt sichtbar als noch nicht vollständig gekennzeichnet.
- Den Wechsel auf ein anderes Kind wegen eines fehlenden Eintrags erst anhand einer vollständig erfolgreichen Liste entscheiden.
- Ein zwischenzeitlich bewusst gewähltes Kind darf nicht durch die verspätete Antwort eines älteren Ladevorgangs ersetzt werden.
- Kontowechsel und Abmeldung über eine Vorgangskennung absichern; alte Antworten dürfen weder Zustand noch Cache oder Auswahl des neuen Kontos verändern. Bestehende Zugriffs- und Einwilligungsprüfungen gelten weiter.
- Partnerabgleich und automatische Platzhalteranlage nur bei einem bestätigt vollständig leeren Ergebnis ausführen. Auch Fehler nach einem Partnerabgleich müssen erhalten bleiben.

## 4. Kinder-Auswahl aktualisieren und Status anzeigen

Datei: `components/BabySwitcherButton.tsx`.

- Beim Öffnen der Auswahl eine frische Aktualisierung anstoßen; einen bereits laufenden Vorgang mitbenutzen.
- Vorhandene Kinder währenddessen anzeigen und auswählbar halten, soweit sie zuverlässig bekannt sind.
- Einen dezenten Status wie „Kinder werden aktualisiert …“ anzeigen, während fehlende Einträge noch geladen werden.
- Bei unvollständiger Liste keine endgültige Aussage „Keine Kinder gefunden“ anzeigen und keine Verwaltungsentscheidung aus einer vermeintlich vollständigen Kinderanzahl ableiten.
- Nach ausgeschöpften Wiederholungen einen kleinen Hinweis mit „Erneut versuchen“ auch neben einer vorhandenen Liste anzeigen.
- Neue sichtbare Texte auf Deutsch, Englisch und Spanisch ergänzen.
- Bereits vorhandene Änderungen am Modal und der Navigation erhalten.

## 5. Gezielte Prüfung

Tests für Datenladen, Providerzustand und Kinder-Auswahl ergänzen. Die vorhandene Fehlerreproduktion wird als Ausgangsfall verwendet.

Abnahmekriterien:

1. Erfolgreicher Start zeigt Levi und Schwangerschaft ohne doppelte Einträge.
2. Eine fehlgeschlagene Teilabfrage mit anschließend erfolgreicher Wiederholung ergänzt den fehlenden Eintrag automatisch; es erscheint zuvor kein störender Fehlerhinweis.
3. Wiederholt fehlgeschlagene Aktualisierung überschreibt weder vollständigen Cache noch gespeicherte Schwangerschaftsauswahl und aktuelle Ansicht.
4. Erster Start ohne vollständigen Cache zeigt vorläufige Daten erkennbar als noch ladend. Eine gespeicherte, noch nicht geladene Schwangerschaft wird nicht durch Levi ersetzt.
5. Beide fehlgeschlagenen Abfragen erzeugen weder ein falsches leeres Ergebnis noch ein neues Platzhalterkind.
6. Öffnen der Auswahl lädt frisch. Mehrfaches Öffnen und parallele Aufrufer erzeugen keine konkurrierenden Ladevorgänge.
7. Konto- und Kindwechsel während eines laufenden Requests werden nicht durch dessen spätere Antwort rückgängig gemacht.
8. Nicht wiederholbare Fehler werden nicht wiederholt; temporäre Fehler bleiben innerhalb des festgelegten Limits.
9. Ein tatsächlich vollständig leerer oder geänderter Datenbestand wird weiterhin korrekt verarbeitet.

Danach gezielte Jest-Prüfungen und TypeScript-Prüfung ausführen. Den Ablauf anschließend auf iOS und Android mit simuliertem kurzem Verbindungsabbruch prüfen. Lokale Tests, Geräteprüfung und Veröffentlichung werden getrennt dokumentiert.
