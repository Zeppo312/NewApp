# Absturz beim Öffnen der Schwangerschafts-Story

Stand: 03.10.2026, 23:02 MESZ. Die Korrektur ist als EAS Update für iOS und Android auf `release-candidate-20261003`, Runtime `1.0.25`, veröffentlicht. Aktuelle Gruppe: [`b8c4ae6c-5d68-4435-8554-af55015d0334`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/b8c4ae6c-5d68-4435-8554-af55015d0334). EAS-Projekt und Produktionsumgebung entsprechen dem bestehenden Kandidaten. Es wurde kein neuer nativer Build gestartet oder eingereicht.

## Ursache und Korrektur

Der Aufruf der Story mit echter Expo-Router-/Native-Stack-Navigation ist im vorhandenen iOS-Release-Simulator reproduzierbar abgestürzt: `Maximum update depth exceeded`, anschließend `Unhandled JS Exception`. Der Fehler entsteht im Layout-Effekt von Expo Routers `Screen`, der `navigation.setOptions(options)` aufruft.

`WeekStories` erzeugte bei jedem Render ein neues Optionenobjekt einschließlich eines neuen `contentStyle`. Gleichzeitig abonniert `useIsFocused` Änderungen der Navigation. Das Setzen der frischen Optionen führt dadurch zum nächsten Render und erneut zum Setzen der Optionen. Die früheren Browserprüfungen ersetzten `Stack.Screen` und `useIsFocused` durch Mocks und konnten diesen nativen Navigationskreislauf nicht erkennen.

Die vollständigen Optionen von `Stack.Screen` werden jetzt mit `useMemo` anhand des übersetzten Story-Titels stabil gehalten. Diese Korrektur betrifft ausschließlich `components/pregnancy-guide/week-stories.tsx`. Vollbildgestaltung, Timer, Halten zum Pausieren, Seiten-/Themenwechsel und Wischsteuerung sind weiterhin enthalten. Home, „Dein Tag im Überblick“, Header, Werkzeuge, Wochenreview, Inhalte, Abhängigkeiten und Backend sind unverändert.

## Wiederherstellung und Nachweise

Zunächst wurde um 22:49 MESZ die vorherige Vorschaugruppe `7046dd90-a461-4d3d-820c-abe442e07044` als Wiederherstellung `1a209ab0-e28f-4162-a3d3-078b6d643f21` ausschließlich auf dem Kandidatenkanal erneut veröffentlicht. Die aktuelle Korrektur ersetzt diesen vorübergehenden Rückfall.

Der native Vergleich verwendet eine getrennte Simulator-App aus dem bereits vorhandenen Release-Binary, mit den vorhandenen nativen Versionen, echtem Expo Router und einem minifizierten nativen JavaScript-Export. Konto-, Locale- und Farbkontexte sind isoliert; kein Benutzerkonto oder Backend wurde verwendet. Die geprüfte Story-Datei stimmt bytegenau mit der korrigierten App-Quelle überein.

- Vorher: Absturz direkt nach „Story öffnen“, Fehler im nativen Log dokumentiert.
- Nachher: fünf erneute Aufrufe von Home mit Schließen ohne Absturz; automatischer Wechsel über die Baby-Abschnitte zum Körper-Thema; Öffnen aus der Wochenübersicht und korrekte Rückkehr zur Übersicht.
- Typecheck und fokussiertes ESLint bestanden, 34 Jest-Tests in vier Suites bestanden.
- Beide finalen Hermes-Exporte enthalten dieselben Billing-Schlüssel wie die installierten Kandidaten, das Produktionsbackend, vorhandene Routen, Story-Steuerung und alle zwölf Bilder.
- EAS bestätigt beide Update-IDs, den Ziel-Branch und die Korrektur als neueste Gruppe. Alle fünf Kanalzuordnungen und der öffentliche `main`-Branch sind unverändert. Öffentlich bleibt Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`.

Am 04.10.2026 hat der Nutzer bestätigt, dass die App nicht mehr abstürzt. Die vorherige Absturzbehebung ist damit auf seinem Gerät angenommen. Diese Rückmeldung bestätigt noch nicht die neue Story-Gestaltung vom 04.10.2026. Native Ziehgesten konnten mit der verfügbaren UI-Steuerung nicht abgenommen werden; der Drag-Aufruf wurde vom Werkzeug abgewiesen. Der behobene Absturz beim Öffnen wurde dagegen nativ vor und nach der Korrektur geprüft. Die Sentry-Ansicht enthielt zum Diagnosezeitpunkt noch keine neue Meldung zu diesem Absturz; die Ursache stammt aus der lokalen nativen Reproduktion.

Die bestehende LottiBaby-TestFlight-App **1.0.25 / 1.0.80** vollständig schließen und mit Internetverbindung wieder öffnen. Sie lädt das Update beim Start; gegebenenfalls anschließend ein zweites Mal vollständig schließen und öffnen. Keine Neuinstallation erforderlich.

Nachweise: `output/pregnancy-story-crash-20261003/`, insbesondere `native-crash-before.log`, `native-verification.json`, `fix.patch`, `published-update.json`, `published-release-preservation.json`, Exportprüfungen und Testlogs. Isolierte Quellen und rohe Logs: `.family-qa/pregnancy-story-crash-20261003/`.

## Nutzerrückmeldung und folgende Gestaltung vom 04.10.2026

Der Nutzer bestätigt ausdrücklich: „das ist behoben, dass es nicht mehr abstürzt“. Die danach gewünschte Vollbildfoto-Gestaltung mit abgehobener Textfläche und Artikelaufruf ist separat in [pregnancy-story-photo-20261004.md](pregnancy-story-photo-20261004.md) dokumentiert. Sie erhält die hier beschriebene stabile Navigation und ersetzt lediglich die vorherige Vorschaugruppe auf demselben Kanal.
