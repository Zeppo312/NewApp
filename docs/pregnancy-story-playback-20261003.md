# Schwangerschafts-Story im Wochenreview-Stil

Stand: 03.10.2026. Auf ausdrücklichen Nutzerwunsch ist die Schwangerschafts-Story bildschirmfüllend wie `WochenkarteStory.tsx` gestaltet und erhält zeitgesteuerte Abschnitte sowie Instagram-artige Bediengesten. Diese Entscheidung ersetzt die bisherige manuelle Story-Navigation als Standard.

**Aktueller Stand vom 04.10.2026:** Vollbildfoto mit abgehobener Textfläche, direktem Artikelaufruf und Tippen ohne sichtbare Blätterpfeile ist auf demselben Vorschau-Kanal veröffentlicht. Gruppe `2eec6f03-230b-4660-9714-6bdbb31e4229`. Aktuelle Gestaltung, Prüfungen und Auslieferung: [pregnancy-story-photo-20261004.md](pregnancy-story-photo-20261004.md). Die folgenden Abschnitte dokumentieren die vorherige Fassung vom 03.10.2026.

## Verhalten und Gestaltung

Die Story übernimmt die Farbverläufe, transparente Karte, dünne Abschnittsleiste und das X des vorhandenen Wochenreviews. Bilder und Texte bleiben erhalten. Normale Wissensseiten verwenden weiterhin `Header.tsx`. Home, „Dein Tag im Überblick“, Werkzeuge und der Wochenreview selbst sind unverändert.

- Die aktive Leiste läuft kontinuierlich. Ein Abschnitt dauert je nach Textlänge zwischen 5 und 15 Sekunden. Nach Bild-Laden startet seine Zeit; anschließend folgt der nächste Abschnitt, dann das nächste Thema. Am Ende und beim Wegwischen kehrt die Story zu ihrem Einstieg zurück: Home oder Wochenbegleiter. Ein direkter Link ohne vorherige Seite fällt auf den Wochenbegleiter zurück. Die Hilfe-Story bleibt ein eigenständiger Einstieg.
- Finger auflegen pausiert sofort; Gedrückthalten lässt Zeit zum Lesen. Loslassen setzt mit der verbleibenden Zeit fort. Zusätzlich gibt es eine zugängliche Pause-/Fortsetzen-Taste.
- Antippen links/rechts blättert innerhalb der Abschnitte. Seitliches Wischen wechselt das Thema. Fortschrittssegmente und Pfeile bleiben zusätzlich bedienbar.
- Ziehen nach unten am Textanfang bewegt die gesamte Story mit dem Finger. Eine ausreichend weite oder schnelle Bewegung schließt sie; eine kleine Bewegung federt zurück. Bereits nach unten gescrollter Text erhält seine normale Lesebedienung.
- Artikel, Quellen, Arztfragen, Vorbereitung und Countdown sind weiterhin direkt erreichbar. Während einer darüber geöffneten Seite, App-Hintergrund oder Android-Benachrichtigungsleiste läuft keine Zeit weiter.
- Mit Screenreader oder reduzierter Bewegung ist automatisches Weiterblättern abgeschaltet. System-Inset-Abstände, große Schrift und scrollbarer Lesetext werden berücksichtigt. Eine fehlgeschlagene Bildladung erhält einen Ersatz und hält die Navigation nicht fest.

Die Animationen verwenden die bereits installierten Reanimated-, Worklets- und Gesture-Handler-Versionen. Gestenbewegung und Fortschrittsdarstellung laufen über Shared Values; ein Timer pro Abschnitt koordiniert die Navigation. Es wurden keine Abhängigkeiten, Backend-Funktionen, fachlichen Inhalte oder Review-Metadaten geändert.

## Prüfnachweise

`npm run typecheck` und fokussiertes ESLint sind erfolgreich; keine ESLint-Fehler oder Warnungen. Die isolierte Build-Quelle besteht ihre App- und Test-Typprüfungen. 34 Jest-Tests sind erfolgreich, darunter neun neue Zeitsteuerungsprüfungen: Bildbereitschaft, lange Pause, Artikelabdeckung, Hintergrund/Android-Blur, unterstützte iOS-Ereignisse, manueller Wechsel kurz vor Ablauf, Screenreader, reduzierte Bewegung und vollständiges Aufräumen beim Schließen. Die bestehenden Tests prüfen weiterhin Erreichbarkeit aller Inhalte und Aktionen über 42 Wochen sowie Merkliste und SSW-Berechnung.

Die echte React-Native-Web-Komponentenvorschau bestätigt laufenden Fortschritt, automatische Abschnitte und Themenwechsel, Tippen links/rechts, horizontales Wischen, Wegwischen nach unten, Zurückfedern, Pause, Artikel/Rückkehr und automatisches Schließen am Ende. Bei 320 × 568 Pixeln mit spanischem Text und Schriftfaktor 1,6 bleiben Lesetext und Aktion scrollbar erreichbar; Dokumentbreite 320 Pixel ohne seitlichen Überlauf. Ein Ziehen nach unten im bereits gescrollten Text schließt die Story nicht. Der temporäre Browser-Viewport wurde zurückgesetzt.

Die Browser-Hülle ersetzt Konto-, Locale-, Router- und einige Plattformkontexte. Eine Rückkehr im Browser bestätigt Abschnitt und Ziel, während verbleibende Lesezeit separat im Hook-Test geprüft ist. Physische iPhone-/Android-Gesten, VoiceOver/TalkBack, native Fokuswechsel und Fingergefühl sind dadurch noch nicht abgenommen.

Beide finalen Hermes-Bündel sind erfolgreich exportiert. Produktionsbackend, Billing-Schlüssel anhand echter EAS-Länge und Fingerprint im jeweiligen installierten Kandidaten, alle zwölf Bilder anhand SHA-256 und neue Story-Bedienung sind enthalten. Der native Babel-Durchlauf transformiert 16 Gesten-/Animations-Worklets. Zwölf geschützte Checkout-Dateien und 13 installierte Kandidatenquellen sind unverändert.

Nachweise: `output/pregnancy-story-playback-20261003/`. Rohdaten und isolierte Quellen liegen unter `.family-qa/pregnancy-story-playback-20261003/`.

![Aktuelle Story-Komponente](../output/pregnancy-story-playback-20261003/story-final.png)

## Auslieferung und anschließende Einschränkung auf EAS Build

Das Vorschau-OTA wurde am 03.10.2026 um 22:18 MESZ unmittelbar vor der Klarstellung „Nur eas Build ne“ veröffentlicht. Es verwendet ausschließlich `release-candidate-20261003`, Produktionsumgebung und Runtime `1.0.25`; Gruppe [`082a64ce-5788-4032-9b58-8c6d97ae77aa`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/082a64ce-5788-4032-9b58-8c6d97ae77aa). Beide Plattformen und die Ziel-Branch-Zuordnung sind remote bestätigt. Öffentlicher `main`-Branch samt Update-Gruppen und alle Kanalzuordnungen sind unverändert; dessen letzte Gruppe bleibt `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`.

Die zwischenzeitliche Bitte um einen reinen EAS-Build wurde zu „Eas Update meinte ich“ korrigiert. Der gestartete iPhone-Build `2535fa15-f387-4658-af46-1800c97cee3d` ist remote bestätigt **CANCELED**, ohne IPA oder Store-Einreichung. Die bestehende TestFlight-App **1.0.25 / 1.0.80** bleibt passend. Der Abbruch und die verbrauchte EAS-Buildnummer 1.0.81 sind im [Build-Nachweis](pregnancy-story-build-20261003.md) dokumentiert.

Die abschließende Korrektur stellt sicher, dass direkt auf Home geöffnete Storys beim Schließen wieder Home zeigen. Typprüfung, ESLint, beide finalen Hermes-Exporte und die tatsächliche Rückkehr im Browser sind erneut geprüft. Das abschließende EAS Update ist unten dokumentiert.

## Ersetztes EAS Update: 03.10.2026, 22:33 MESZ

Gruppe [`ce57cf04-ec3e-4d08-b9c9-5570fbcf1225`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/ce57cf04-ec3e-4d08-b9c9-5570fbcf1225), Kanal `release-candidate-20261003`, Runtime `1.0.25`, iOS und Android. Die abschließende Fassung enthält die Rückkehr zum ursprünglichen Einstieg auch für direkt auf Home geöffnete Storys. EAS bestätigt beide Update-IDs und die Ziel-Branch-Zuordnung. Alle Kanalzuordnungen und der öffentliche `main`-Branch sind nach dieser Veröffentlichung erneut unverändert bestätigt. Kein neuer Store-Build wurde eingereicht.

In der bestehenden LottiBaby-TestFlight-App 1.0.25 / 1.0.80 die App vollständig schließen, mit Internetverbindung öffnen und den Download abwarten; falls nötig nochmals vollständig schließen und öffnen. Das native Gefühl der Gesten und die tatsächliche Geräteübernahme sind noch nicht bestätigt.
