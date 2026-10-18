# EAS-Build der Schwangerschafts-Story

Der zwischenzeitliche Wunsch „Nur eas Build ne“ wurde anschließend ausdrücklich zu „Eas Update meinte ich“ korrigiert. Der gestartete iPhone-Build ist daraufhin abgebrochen worden; gewünscht und ausgeliefert ist das EAS Update auf dem bestehenden Vorschaukanal.

- EAS-Build: [`2535fa15-f387-4658-af46-1800c97cee3d`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/2535fa15-f387-4658-af46-1800c97cee3d).
- Plattform iOS, Profil `release-candidate`, signierte Store-Distribution.
- Version `1.0.25`, native Buildnummer `1.0.81`.
- Separater Kanal `release-candidate-20261003`, Runtime `1.0.25`, Produktionsumgebung.
- Quelle: `.family-qa/pregnancy-story-build-20261003/source`, gezielt aus der abschließend geprüften Story-Quelle kopiert; keine neu eingelesenen fremden Checkout-Änderungen.
- Archivprüfung: alle 1.080 hochgeladenen Quellen entsprechen anhand SHA-256 der isolierten Quelle. Finale Story, Timer-Hook, unveränderte Paketdateien und native Konfiguration sind vorhanden.
- Kein `--auto-submit`, keine Store-Veröffentlichung und kein neuer Android-Build in diesem Auftrag.

Status: **CANCELED**, remote bestätigt. Es wurde kein IPA erzeugt und keine Store-Einreichung ausgeführt. Der EAS-Zähler hat die reservierte Buildnummer 1.0.81 bereits verbraucht; er wurde nicht zurückgesetzt. Die bestehende TestFlight-Version 1.0.25 / 1.0.80 bleibt der passende installierte Kandidat für das EAS Update. Abbruchnachweis: `output/pregnancy-story-build-20261003/build-canceled.json`.

Die Story und ihre 34 bestandenen Tests sind im [Umsetzungsnachweis](pregnancy-story-playback-20261003.md) beschrieben. Öffentliche Nachweise: `output/pregnancy-story-build-20261003/`. Private Quellen, rohe EAS-Antworten und spätere IPA-Datei: `.family-qa/pregnancy-story-build-20261003/`.
