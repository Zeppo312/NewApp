# ASO-Umsetzung · 17. Oktober 2026

## Aktueller Stand

Der App-Teil ist in App Store Connect zur Prüfung eingereicht. Der
Browser-Login war dafür nicht nötig: Der vorhandene EAS-Zugang und der dort
hinterlegte Apple-Schlüssel funktionieren. Es wurden keine neuen Schlüssel angelegt.

- **Native App:** 1.0.25 (1.0.83) erfolgreich gebaut, hochgeladen und von Apple als
  `VALID` verarbeitet. Dem Versionsentwurf zugeordnet und zur Prüfung eingereicht:
  `WAITING_FOR_REVIEW`, bestätigt am 17.10.2026 um 11:50 Uhr (Europe/Berlin).
- **Bilder und Video:** 63 Screenshots in DE, EN-US und ES (je sieben für drei
  Geräteformate) vollständig verarbeitet. Deutsches Vorschauvideo: `COMPLETE`,
  Poster `00:00:02:27`.
- **Schwangerschaftsseite:** Vorhandene Produktseite „Schwangere“ aktualisiert,
  keine doppelte Seite angelegt. Neun Screenshots vollständig verarbeitet,
  Werbetext gesetzt und genehmigter Suchbegriff „schwangerschaft“ zugeordnet.
  Die Seite ist zusammen mit der App zur Prüfung eingereicht: `WAITING_FOR_REVIEW`.
- **Messphasen:** Für die erste Veröffentlichung bleiben Titel, Untertitel und
  Keywords exakt wie in der veröffentlichten Version 1.0.23. Die neuen DE-
  Suchfelder und en-GB sind als geprüfter Zielstand für die zweite Phase erhalten.
- **Website:** Drei SEO-Seiten und das Einbaupaket sind fertig. Noch nicht auf
  Hostinger veröffentlicht; der Hosting-Login fehlt und der Mac ist gesperrt.

Der öffentliche Store steht bis zu Apples Freigabe und der anschließenden
Veröffentlichung weiterhin auf 1.0.23. Die vorhandene manuelle Release-Einstellung
wird beibehalten. Upload, TestFlight, App Review und öffentliche Verfügbarkeit
sind getrennte Zustände.

## Build und Quellstand

- [EAS Build 1.0.83](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/7819b5a5-505b-42ce-a71b-35706e07f0c2)
- [EAS Upload](https://expo.dev/accounts/janzeppi/projects/LottiBaby/submissions/c9ec6d87-277f-4e0c-a719-5e82b27d10fa)
- Basis: `cdc6fc4d`; isolierte Kopie unter `/tmp/lotti-aso-release-20261017`.
- Nur Bewertungsabfrage, passende Abhängigkeit und nötige Release-Konfiguration
  ergänzt. Andere uncommittierte App-Änderungen wurden nicht mitgebaut.
- iOS Runtime `1.0.25-aso-20261017`, Channel `aso-release-20261017`. Das neue native
  Modul wird damit nicht versehentlich einer älteren Runtime zugeordnet.
- App und Widget im tatsächlichen IPA: Version 1.0.25, Build 1.0.83. Native
  `ExpoStoreReview`-Implementierung und StoreKit-Verknüpfung nachgewiesen;
  `codesign --verify --deep --strict` bestanden.
- Einzelne Dateihashes und IDs: `native-release.json`.
- Bestätigte App- und Produktseiten-Einreichung: `app-review-einreichung.json`.
  Review-ID: `a950aa77-d02a-4f1f-a616-542c6d19097b`.

## Bewertungsabfrage

`expo-store-review ~57.0.3` ist eingebaut und jetzt auch im nativen Build enthalten.
Gezählt werden bestehende Erfolgsereignisse für gespeicherte Mahlzeiten-, Pflege-
und Schlaf-Einträge. Frühestens nach sieben Tagen, fünf Ereignissen und Nutzung
an drei verschiedenen Tagen kann die Abfrage angefordert werden.

Ein Eintrag aktiviert eine Gelegenheit in der laufenden Sitzung. Die Anfrage
kommt nach acht Sekunden auf der Baby-Startseite `/home`, mit angemeldetem
Account, bestätigten Nutzungsbedingungen, ohne globale Startnachricht,
Paywall-Sperre oder bekannte laufende Schlaf-/Mahlzeit-Timer. Navigation,
Logout und App-Hintergrund verhindern die Anzeige. Mindestens 120 Tage Abstand,
höchstens drei Versuche in 365 Tagen. Keine Zufriedenheitsfrage, Belohnung oder
Filterung nach erwarteter Sternezahl. Lokal werden nur aggregierte Zähler und
Versuchszeitpunkte gespeichert, keine Kinddaten oder Bewertungsergebnisse.

Das Betriebssystem entscheidet, ob ein Dialog erscheint. TestFlight und
Entwicklungsmodus werden übersprungen; ältere Binaries ohne das native Modul
laufen unverändert weiter. Ein erfolgreicher TestFlight-Upload beweist daher
keine tatsächlich abgegebene Bewertung.

## Zwei Messphasen

Die Ausgangsvorgabe trennt neue Bilder und neue Suchfelder zeitlich. Deshalb
wurden die bisherigen Suchfelder direkt aus der genehmigten Version gelesen und
für die erste Phase wiederhergestellt. Auch en-GB bleibt bis zur zweiten Phase
zurückgestellt. Die fertigen Zieltexte liegen in `store.config.json` und der
abgeglichenen `store-texte.json`.

1. Erste Phase: neue Bilder, Beschreibung und Bewertungsabfrage veröffentlichen.
2. Ab dem tatsächlichen Veröffentlichungstag mindestens vier vollständige Wochen
   messen, bei sehr kleinen Fallzahlen länger. Deutschland, USA und Spanien sowie
   Search/Browse und bezahlten Traffic getrennt betrachten.
3. Danach im nächsten editierbaren Versionsentwurf DE-Titel „Lotti Baby: Tracker &
   Stillen“, Untertitel „Schlaf, Windeln & Fläschchen“, die 95 Keyword-Zeichen und
   en-GB übernehmen. Bilder und Video dabei unverändert lassen.
4. Weitere vier Wochen messen. Änderungen an Website und Bewertungsabfrage mit
   Datum protokollieren; sie können ebenfalls Kennzahlen beeinflussen.

`phase1-bisherige-suchfelder.json` enthält die tatsächlich genehmigte Baseline.
`phase1-entwurf-verifiziert.json` dokumentiert die erste Phase. Die neuen
Suchtexte einschließlich en-GB wurden zwischenzeitlich im Apple-Entwurf samt 84
verarbeiteten Bildern geprüft und danach für die getrennte Messung zurückgestellt;
Nachweis: `ziel-entwurf-verifiziert.json`. Die spätere Phase ist vorbereitet,
aber nicht zeitgesteuert aktiviert. Es wurde keine Automation eingerichtet.

Die Rangliste und 860 Impressionen/30 Tage aus der Ausgangsnachricht wurden nicht
neu gemessen. Apples Such-API liefert einen Suchindikator, keinen verlässlichen
Nachweis des personalisierten Store-Rankings.

## Schwangerschaftsseite und offene Website-Übernahme

Produktseite: `98163514-3af2-4af7-8837-7a1fa34232d6`, Version
`2fc8708f-dd70-41ee-be81-abc4dead326c`. Reihenfolge pro Geräteformat:
Schwangerschaft, gemeinsame Nutzung, Familienalltag. Weitere Angaben stehen in
`produktseite-schwangerschaft.de-DE.json`. „wehen“ und „ssw“ bleiben mögliche
Apple-Ads-Kandidaten; es wurde keine bezahlte Kampagne gestartet und kein Budget
festgelegt.

Website-Ausgabe unter `website/seo/public/`: `/wehen-timer/`, `/stillprotokoll/`,
`/babyschlaf/`, gemeinsame Assets und zusätzliche Sitemap. Einbauanleitung und
Startseiten-Fragment liegen unter `website/seo/`. Der Smart App Banner ist auch
in der bestehenden Links-Seite und ihrem Generator ergänzt. Für Hauptseiten-
Titel/H1 und gemeinsame deutsche Store-Links müssen die tatsächlichen PHP-
Templates auf Hostinger bearbeitet werden. Ältere lokale Transfer-Skripte wurden
gefunden, verlangen aber ein Passwort; ein nutzbarer gespeicherter Website-Zugang
liegt nicht vor. Der Login auf `hpanel.hostinger.com` ist erforderlich.

## Übertragungsfehler behoben

EAS Metadata 23.2.0 brach beim Ersetzen eines deutschen Screenshots ab. Die 27
fehlenden Bilder wurden gezielt über Apples öffentliche API ergänzt und alle
Bildgruppen auf Anzahl, Reihenfolge und `COMPLETE` geprüft. Bereits korrekte
Gruppen wurden dabei erhalten.

Beim Video hatte `eas metadata:pull` eine 1,8-KB-Streaming-Playlist unter einem
MP4-Namen gespeichert. Der anschließende EAS-Upload wurde von Apple als
`ASSET_FAILED` verarbeitet. Das validierte Original (36.745.337 Bytes, H.264/AAC,
886×1920, 30 fps, 27,52 Sekunden) wurde erneut hochgeladen; Verarbeitung und
Poster sind jetzt bestätigt. Beide lokalen Release-Prüfskripte erkennen künftig
solche falsch benannten MP4-Exporte vor einem Upload.

## Prüfung und Grenzen

- 7/7 gezielte Jest-Tests und TypeScript-Prüfung auch im isolierten Build-Stand
  bestanden; gezieltes ESLint und Metadatenprüfungen bestanden.
- Native Archivprüfung, passende App-/Widget-Versionen und tiefe strikte
  Signaturprüfung bestanden.
- Bilder und Video serverseitig verarbeitet; Suchfelder mit der veröffentlichten
  Baseline abgeglichen.
- Alle drei SEO-Seiten lokal auf HTTP 200, Metadaten, Canonical/JSON-LD/Banner,
  Bilder, Links und Sitemap geprüft. Bei 390 Pixel Breite kein horizontaler
  Überlauf. Desktop und mobile Gesamtansicht visuell geprüft.
- Kein nativer Gerätetest und keine echte Store-Bewertung in dieser Sitzung.
  Die Website ist noch nicht veröffentlicht.

## Korrigierte Annahmen und Quellen

Apple führt en-GB als zusätzliche Anzeigesprache für DE/AT/CH/ES auf, garantiert
aber keine Verdopplung des Keyword-Indexes. Die Behandlung deutscher Komposita
ist in den geprüften Quellen nicht fest dokumentiert. Die gewünschten deutschen
Begriffe in en-GB bleiben ein Keyword-Versuch. Alle Zielfelder halten sowohl
100 Zeichen als auch konservativ 100 UTF-8-Bytes ein.

Ein bestehender Wehen-Timer allein ist kein geeignetes In-App-Event. Apple
verlangt einen zeitlich begrenzten Anlass; deshalb wurde kein fingiertes Event
angelegt. Die Website enthielt bereits Suchbegriffe in Keywords und Open Graph;
die Verbesserung betrifft insbesondere sichtbaren H1, Browser-Titel und gezielte
Funktionsseiten.

- [Apple: App-Store-Suche](https://developer.apple.com/app-store/search/)
- [Apple: Metadatensprachen](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/)
- [Apple: In-App-Events](https://developer.apple.com/app-store/in-app-events/)
- [Apple: Custom Product Pages](https://developer.apple.com/app-store/custom-product-pages/)
- [Apple: öffentliche API-Spezifikation](https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip)
- [Expo SDK 57: StoreReview](https://docs.expo.dev/versions/v57.0.0/sdk/storereview/)
