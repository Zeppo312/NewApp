# Zeitauswahl und Uhr als Startknopf – 13. Oktober 2026

Ausgangspunkt ist das Nutzerfoto mit nach oben versetzten Beschriftungen
in Tag/Woche/Monat und der Wunsch nach etwas flacheren Pills sowie einer
zusätzlichen Startaktion direkt auf der Uhr.

## Änderung

- `PeriodTabs`: sichtbare Mindesthöhe 38 statt 44 Punkte; die Touchfläche
  bleibt mindestens 44 Punkte hoch. Die sichtbare Fläche ist in ihrem
  Touchbereich zentriert. Text und optionales Schloss bleiben in einer
  gemeinsamen Inhaltszeile. Die frühere mehrzeilige Flex-Anordnung der
  Einzel-Pill entfällt. Android-Schriftpadding ist deaktiviert.
- Bei großer Schrift sinkt das horizontale Padding auf zehn Punkte.
  Bei weiterem Platzbedarf dürfen ganze Pills in eine neue Zeile wechseln,
  statt ein Schloss allein unter die Monatsbeschriftung zu setzen.
- `SleepTimerFace`: die ruhende Uhr ist zusätzlich antippbar. Der Hinweis
  mit Play-Symbol und der bereits vorhandenen Übersetzung „Schlaf starten“
  macht die Aktion sichtbar. Sowohl Uhr als auch Hinweis lösen denselben
  Callback aus. Der große Uhr-Touchbereich hat Button-Rolle, lokalisiertes
  Accessibility-Label und Disabled-/Busy-Zustand. Die Uhrtexte bleiben
  separate, zugängliche Texte neben dem transparenten Startbereich.
- `CentralTimerComponent`: der bisher alle Gesten blockierende
  `pointerEvents="none"`-Rahmen entfällt. Der Screen liefert Startaktion,
  Beschriftung und Sperren.
- Uhr und vorhandene Startkarte benutzen `handleStartSleepFromControl`.
  Dieser übernimmt die bisherige Tages-/Nachtentscheidung und ruft den
  vorhandenen `handleStartSleep` auf. Eine pausierte Nacht wird über den
  bestehenden Fortsetzen-Handler weitergeführt. Laden des Live-Status,
  Vorschau ohne Schreibrecht, Start/Stopp und ein bereits aktiver Schlaf
  blockieren den neuen Startweg. Der Uhr-Tap besitzt zusätzlich eine
  unmittelbare Sperre gegen wiederholte Taps vor dem nächsten Parent-Render.
- Bei laufendem Schlaf bietet die Uhr keine Startaktion. Die bisherigen
  Stopp-, Qualitäts-, Pausen- und manuellen Erfassungswege bleiben erhalten.
  Ein fehlgeschlagener Start löst die lokale Tap-Sperre wieder.

Unverändert sind Typografie, Ring, Größe, Puls, bestehende Speicherlogik,
Vorhersageberechnung, Partnerabgleich und Backend-/Feature-Konfiguration.
Die wiederverwendete Uhr bleibt ohne Startcallback eine reine Anzeige,
beispielsweise für eine Vorschau.

## Belege und Prüfung

- Die ursprüngliche Verschiebung ist am Nutzerfoto beobachtet. Der bisherige
  Code verband Flex-Wrap, Mindesthöhe und Padding. Die neue gemeinsame
  Inhaltszeile behebt in der Web-Prüfansicht den Versatz des Textframes.
  Die native Nachher-Darstellung auf dem Benutzergerät bleibt offen.
- 48 Layoutvarianten: Unser Tag/Schlaf, 320/390 Punkte, DE/EN/ES,
  normal/simuliert 1,6-fache Schrift, hell/dunkel und gesperrter Monat.
  Textframes liegen in allen Varianten mittig; keine festgestellten
  horizontalen Überläufe. Normale Pills: 38 Punkte sichtbar, 44 Touchhöhe.
- Die gerenderte Uhr wurde angetippt: Die Fixture wechselt zur laufenden
  Anzeige; Startaktionen verschwinden. Der Vorschau-/Read-only-Zustand
  sperrt den Uhrbutton. Diese Fixture schreibt keine echten Schlafdaten.
- 31 Tests in drei Suites bestehen: neue Uhraktionen, Auswahl und
  bestehender Schlafabgleich. Die sechs neuen Uhrtests prüfen Delegation,
  lokalisiertes Label, Busy-/Disabled-Sperre, reine laufende Anzeige,
  schnelle Doppeltaps und Wiederholen nach erfolglosem Start.
- App-Typecheck im Arbeitsverzeichnis und in der eingefrorenen Quelle sowie
  Typecheck der neuen Uhrtests erfolgreich.
- ESLint in den betroffenen Quelldateien: keine Fehler und keine neuen
  Diagnosen; 39 bestehende Warnungen. Zeilenverschiebungen sind normalisiert.
- 33 bestehende Daten-/Timer-Callbacks sind per normalisiertem TypeScript-AST
  identisch mit der vorher veröffentlichten Quelle.

Vorschau mit Beispieldaten und vorhandenen Hintergrundbildern:
`/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Uhr-als-Startknopf/`.
Native Header/Icons/Blur sind vereinfacht. Dies belegt Web-Layout und
Callback-Verdrahtung, keine installierte App, Systemgesten, native Unschärfe,
Haptik oder physische Geräteabnahme. Die ursprünglichen Nutzerfotos wurden
nicht in die Veröffentlichungsquelle übernommen.

## Veröffentlichungsgrundlage

Eingefrorene Quelle: `.family-qa/sleep-clock-start-20261013/source`.
Basis ist die letzte veröffentlichte Gruppe
`47303d97-7d35-404c-9f0a-15ae6f88efd2`. Nur drei UI-Dateien und der neue
Uhrtest wurden darübergelegt. Bereits veröffentlichte Änderungen bleiben
vollständig erhalten. Parallel bearbeitete Avatar-Dateien im Arbeitsverzeichnis
wurden durch diese Aufgabe nicht verändert und sind kein Bestandteil der
isolierten Veröffentlichung.

Projekt: `@janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`.
Kanal und Branch: `release-candidate-20261003`; Umgebung `production`;
iOS und Android; Runtime `1.0.25`. Native Konfiguration und Abhängigkeiten
bleiben identisch. Die 120 iOS- und 125 Android-Assets entsprechen der Basis.
Prüfnachweise liegen in `output/sleep-clock-start-20261013/`.

Die Veröffentlichung belegt noch keine Installation oder native Geräteabnahme.
Es wurden keine Pakete installiert, keine nativen Builds ausgelöst und keine
Git-Dateien gestaged, committed oder gepusht.

## EAS Update

Veröffentlicht für iOS und Android:
Gruppe `37c6d728-3c09-41c2-87e6-26f2b1fa7ffd`.
https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/37c6d728-3c09-41c2-87e6-26f2b1fa7ffd

Die ausgelieferten Manifest-IDs, Runtime sowie Bundle- und Asset-Hashes
stimmen mit dem geprüften lokalen Export überein. Die Auslieferungsnachweise
stehen in `output/sleep-clock-start-20261013/served-manifest-verification.json`.
Kanalzuordnung und Main-Update sind nach der Veröffentlichung unverändert.
Der direkte CDN-Abruf der Bundle-Bytes liefert hier HTTP 403; Manifest-IDs,
Runtime und sämtliche Bundle-/Asset-Hashes wurden erfolgreich verglichen.
Eine kompatible Installation übernimmt das Update nach vollständigem
Online-Neustart, Download und einem weiteren vollständigen Start.
