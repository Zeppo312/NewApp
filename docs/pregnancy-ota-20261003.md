# Schwangerschaftsvorschau per EAS Update

Veröffentlicht am 03.10.2026 um 20:39 MESZ auf ausdrücklichen Nutzerwunsch.

**Aktueller Stand vom 04.10.2026:** Vollbildfoto mit abgehobener Textfläche, direktem Artikelaufruf und Tippen ohne sichtbare Blätterpfeile ist auf demselben Vorschau-Kanal veröffentlicht. Gruppe `2eec6f03-230b-4660-9714-6bdbb31e4229`. Aktuelle Gestaltung, Prüfungen und Auslieferung: [pregnancy-story-photo-20261004.md](pregnancy-story-photo-20261004.md). Die folgenden Abschnitte dokumentieren die vorherige Fassung vom 03.10.2026.

Die Story-Ansichten, der SSW-Wechsler, der normale Header, die an den übrigen App-Stil angeglichenen Glas-Karten und die Entfernung sichtbarer Entwurfshinweise sind als EAS Update für iOS und Android veröffentlicht.

- EAS-Projekt: `@janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`.
- Kanal und Branch: `release-candidate-20261003`.
- Runtime auf beiden Plattformen: `1.0.25`; EAS-Umgebung: `production`, entsprechend dem vorhandenen Kandidatenprofil.
- Update-Gruppe: [`7046dd90-a461-4d3d-820c-abe442e07044`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/7046dd90-a461-4d3d-820c-abe442e07044).
- iOS-Update: `01a10310-6de4-7494-9ab6-032ab44b7d8d`.
- Android-Update: `01a10310-6de4-7dc5-834a-50b42f38454e`.
- Nachricht: „Schwangerschaft: Storys, SSW-Auswahl und einheitlicher App-Stil“.

## Passender installierter Build

Der vorhandene TestFlight-Build **1.0.25 / 1.0.80** enthält den passenden Kanal, Runtime und aktivierte Updates. Der entsprechende Android-Kandidat **1.0.25 / 24** ist ebenfalls kompatibel, wurde durch diesen Auftrag jedoch nicht in einen Play-Track hochgeladen. Ältere QA-Builds mit deaktivierten Updates erhalten dieses OTA nicht.

App vollständig schließen und mit Internetverbindung neu öffnen. Die neue Version wird beim Start im Hintergrund heruntergeladen und beim nächsten vollständigen Start angewendet. Falls die Ansicht noch unverändert ist, kurz warten, die App nochmals vollständig schließen und neu öffnen. Kein neuer TestFlight-Download erforderlich.

## Geprüfter Stand und Schutz der Veröffentlichung

Die OTA-Quelle wurde separat unter `.family-qa/pregnancy-ota-20261003/source` aus der eingefrorenen Quelle des vorhandenen Kandidaten erstellt. Dreizehn App-/Inhaltsdateien und der vorhandene Katalogtest wurden gezielt aktualisiert. Keine neuen Abhängigkeiten oder nativen Änderungen. Dreizehn geschützte Quellen/Konfigurationen einschließlich Paketdateien, native Konfiguration, Home, App-Layout und fachliche Inhaltsmetadaten stimmen unverändert mit dem Kandidaten überein.

Die isolierte App-Typprüfung, fokussierte Test-Typprüfung und 25 vorhandene Schwangerschaftstests sind erfolgreich. Die allgemeine Test-Typprüfung der eingefrorenen Quelle findet dort nicht mitarchivierte Backend-Testmodule; deshalb wurde für diese Auslieferung zusätzlich eine fokussierte Konfiguration außerhalb der App-Quelle verwendet. Jest wurde ebenfalls ohne den Ausschluss des privaten `.family-qa`-Ordners ausgeführt.

Beide Hermes-Bündel wurden vor dem Upload geprüft: Produktionsbackend, bestehende Routen, alle zwölf Bilder anhand SHA-256 sowie derselbe RevenueCat-Schlüssel wie im jeweiligen iOS-/Android-Kandidaten enthalten. EAS bestätigt Veröffentlichung, beide Update-IDs und die aktuelle Zuordnung des Kandidatenkanals zur neuen Gruppe.

Alle bisherigen Kanalzuordnungen sind unverändert. Der öffentliche `main`-Branch enthält weiterhin dieselben Update-Gruppen, zuletzt `a47827a3-b732-4f64-a539-429d3709849a` für Runtime `1.0.23`. Es wurden weder Backend noch Store-Builds geändert. Diese Runtime und der separate Kanal halten die neue Vorschau vom öffentlichen Update getrennt.

Ein zusätzlicher Manifest-Abruf mit Python wurde von Cloudflare wegen der Signatur dieses Kommandozeilen-Clients abgewiesen. Veröffentlichung und Kanalzuordnung wurden über EAS CLI bestätigt; der tatsächliche Download und Start auf dem Gerät sind noch nicht bestätigt.

Nachweise: `output/pregnancy-ota-20261003/{source-preparation.json,export-preflight.json,export-verification.json,typecheck-app.log,typecheck-pregnancy-tests.log,tests.log,published-update.json,published-release-preservation.json,delivery-probe.json}`. Private Quellen und rohe CLI-Ausgaben liegen getrennt unter `.family-qa/pregnancy-ota-20261003/`.

## Nachtrag vom 03.10.2026, 22:18 MESZ

Die anschließende Vollbild-Story mit Timer und Wischgesten wurde auf demselben Kandidatenkanal und Runtime als Gruppe [`082a64ce-5788-4032-9b58-8c6d97ae77aa`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/082a64ce-5788-4032-9b58-8c6d97ae77aa) veröffentlicht. Die zwischenzeitliche Bitte „Nur eas Build ne“ traf unmittelbar danach ein und wurde anschließend zu „Eas Update meinte ich“ korrigiert. Der zusätzliche [iPhone-EAS-Build](pregnancy-story-build-20261003.md) ist remote bestätigt abgebrochen; es gab keinen Store-Upload. Der öffentliche `main`-Branch und alle Kanalzuordnungen sind auch nach diesem OTA unverändert bestätigt. Inhalt und neue Prüfungen: [pregnancy-story-playback-20261003.md](pregnancy-story-playback-20261003.md).

Die abschließende Fassung mit korrekter Rückkehr zum Einstieg ist am 03.10.2026, 22:33 MESZ als Gruppe [`ce57cf04-ec3e-4d08-b9c9-5570fbcf1225`](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/ce57cf04-ec3e-4d08-b9c9-5570fbcf1225) auf demselben Kanal veröffentlicht und remote bestätigt. Der öffentliche `main`-Branch und alle Kanalzuordnungen sind erneut unverändert geprüft.
