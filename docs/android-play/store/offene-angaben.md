# Play Console: Stand und offene Angaben

## Stand 14.10.2026

Die Console bestätigt **7 von 11 Einrichtungsaufgaben** (zuvor 2 von 11). Fünf der acht zusätzlich beauftragten Aufgaben sind gespeichert; bei Finanzfunktionen muss die später entdeckte Klarna-Option vor Einreichung noch abgegrenzt werden. Anmeldedaten waren die neunte ursprüngliche Lücke.

| Aufgabe | Tatsächlicher Console-Stand |
| --- | --- |
| Anzeigen | Gespeichert: keine Werbung. Betreiber bestätigt keine Fremdwerbung, Affiliate-Links oder bezahlten Empfehlungen; eigener Shop vorhanden. |
| Inhaltsbewertung | Nach ausdrücklicher IARC-Zustimmung gespeichert. Ergebnis u. a. USK 0, PEGI 3, Brasilien 14. Private Familienfreigaben, KI-/Online-Inhalte und digitale Käufe berücksichtigt; keine öffentliche Community im Kandidaten. |
| Zielgruppe | Durch fehlenden vollständigen Review-Zugang blockiert. Betreiber: keine Alterssperre/Mindestalter; App richtet sich an Eltern, auch minderjährige Eltern. Keine pauschalen Kinder-Altersgruppen oder ausschließlich Erwachsene ausgewählt. |
| Datensicherheit | Entwurf gespeichert: Erhebung, HTTPS, E-Mail/Passwort und OAuth, öffentliche Lösch-URL und belegte Datentypen. Datennutzung/Weitergabe je Typ noch nicht final deklariert; Shop und Dienstleister einbeziehen. |
| Finanzfunktionen | Gespeichert: keine Finanzfunktionen. **Vor Einreichung Klarna prüfen:** Shop-Checkout bietet Klarna; späteres Bezahlen/Ratenkauf noch unbestätigt und kann die Antwort ändern. |
| Gesundheit | Gespeichert: tatsächliche Tracking-, Schwangerschafts-, Zyklus-, Selfcare-, Rückbildungs-, Vitamin-D- und Organisationsfunktionen. Keine Medizinproduktzulassung behauptet. Begründung nennt die Entfernung von ACTIVITY_RECOGNITION in Build 26. |
| Kategorie/Kontakt | Gespeichert: App, Kategorie **Eltern**, **support@lottibaby.de**, **https://lottibaby.de**. E-Mail laut Betreiber betreut; optionale öffentliche Telefonnummer leer. |
| Store-Eintrag | Deutsche und englische Titel/Kurz-/Langtexte inkl. Gesundheitshinweis sowie bestehendes veröffentlichtes App-Symbol 512×512 als Entwurf gespeichert. Vorstellungsgrafik 1024×500 und aktuelle Android-Screenshots fehlen. |

Datenschutz-URL und Behörden-App-Angabe waren bereits erledigt. Gespeicherte Angaben sind keine Google-Freigabe. Kein Review eingereicht und kein Release ausgerollt; nur öffentliche Support-Kontaktdaten über die vorgesehene Sofortveröffentlichung gespeichert.

## Neuer Android-Build

**1.0.26 / Versionscode 26** ist fertig gebaut, geprüft, hochgeladen und im [internen Release-Entwurf 13](https://play.google.com/console/u/1/developers/5489758252378517452/app/4974510685496048236/tracks/4700496565960497773/releases/13/prepare) gespeichert. Er ersetzt Build 25. Die einzige funktionale Korrektur gegenüber dessen eingefrorenem Quellstand ist die Entfernung der ungenutzten Berechtigung `ACTIVITY_RECOGNITION`, die `expo-sensors` eingebracht hatte.

[EAS-Build 26](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/44732dae-fa78-401d-b00c-4dee6210833a), Runtime `1.0.26`, Kanal `release-candidate-20261003`. Bundle-SHA-256: `0a860ad37c038fe1adb0bd083637187afaa93b82c0075275836d363a41f4fce2`.

1127 eingefrorene Quelldateien stimmen mit dem Upload-Archiv überein. Native und Expo-Konfiguration entfernen die Berechtigung; ihr Fehlen ist am fertigen AAB geprüft. Signatur, Produktionsbackend/Billing-Konfiguration, Ziel-SDK 36, nicht-debugfähiger Stand und 68 native 64-Bit-Bibliotheken mit 16-KiB-Ausrichtung bestehen die Prüfung. 76 Assets stimmen bytegenau, 46 AAPT-PNGs in sichtbaren Pixeln überein; drei kompilierte XML-Assets nicht byteweise verglichen. Die am 07.10. entfernten exklusiven Schwangerschaftsseiten/Fotos bleiben entfernt.

Nachweise: `output/android-release-20261014-permission-fix/checkpoints.json`, `aab-verification.json`, `assets-verification.json`, `play-upload-draft.png`. Die zuvor korrigierte Billingschlüssel-Prüfung hat 13 bestandene Konfigurationstests. Die vorherige App-Typprüfung und aktuelle Archiv-/AAB-Prüfung ersetzen keine native Geräteabnahme. Cloud-Doctor-Wartungshinweise bleiben offen.

## Noch vom Betreiber benötigt

1. **Premium-Testzugang:** Vorhandenen App-Store-Demozugang wie angekündigt freischalten und Bescheid geben. Anmeldung funktioniert; weiterhin `tester`/Standard, kein Admin. Erst danach vollständigen Review-Zugang bestätigen/speichern; das entsperrt auch die Zielgruppe. Keine neuen Zugangsdaten nötig. [Details](reviewer-zugang.md).
2. **Klarna:** Ist „später bezahlen“ oder Ratenkauf im eigenen Shop aktiv? Die sichtbare Zahlungsart beweist den Modus noch nicht. Googles Finanzformular führt „Buy now, pay later“ separat auf.
3. **Dienstleister-/Löschangaben:** Keine zusätzlichen Analyse-/Marketing-Weiterleitungen laut Betreiber; diese Rückfrage ist beantwortet. Für die finale Erklärung bleiben die regulären Dienstleisterrollen, Zwecke und tatsächlich geltenden Aufbewahrungs-/Löschfristen abzugleichen. [Dateninventar](dateninventar.md), [Antwortentwurf](datensicherheit.md).
4. **Store-Bilder:** Vorstellungsgrafik 1024×500 und mindestens zwei aktuelle Android-Screenshots. Kein Android-Gerät verbunden; bisheriges Emulator-Verzeichnis auf diesem Mac fehlt. Vorhandene iOS-Werbegrafiken und alte Android-QA-Bilder ersetzen keine aktuellen Android-Produktansichten. App-Symbol ist übernommen.

Die Antworten zu Eltern-Zielgruppe, Werbung und Support-E-Mail liegen vor und müssen nicht erneut geliefert werden. Keine neuen Demo-Passwörter, optionale Telefonnummer oder erfundene Zertifikate nötig.

## Weitere Release-Checkpoints

- **Datenschutz:** Öffentliche Datenschutzerklärung nennt Sentry-Replays mit 10 % der Sitzungen/100 % der Fehler. Im neuen Kandidaten sind beide Raten 0. Vor Einreichung abgleichen. Die [öffentliche Kontolöschungsseite](https://lottibaby.de/datenschutz?lang=de#konto-loeschen) ist vorhanden; ältere Hinweise auf fehlende Lösch-URL sind überholt.
- **Shop:** Browserprüfung ohne Bestellung bestätigt Shopify-Checkout, E-Mail, Name, Liefer-/Rechnungsadresse, optionales Telefon, Kartenfelder/PayPal/Klarna. Keine Kundendaten eingegeben oder Bestellung aufgegeben. Browserprüfung ersetzt keine Android-WebView-/Netzwerkabnahme.
- **Datenverarbeitung:** Nutzung, Erforderlichkeit und Weitergabe pro Typ finalisieren, einschließlich Shop-Zahlungsdaten und optionaler Newsletter-/Shop-Kontowege. Anbieterfristen/Löschrestbestände getrennt von der bloßen Existenz des Löschlinks prüfen. Keine unabhängige Sicherheitszertifizierung belegt.
- **Geräteabnahme:** Build 26 über Play installieren; Anmeldung, Einwilligungen/Widerruf, Tracking/Offline/Neustart, Familienfreigaben, Premium/KI, Käufe/Wiederherstellung prüfen. Bundle-Hash/Premium-Testrolle beweisen keinen echten Play-Kauf.
- **Entwicklerkontotyp:** Zulässigkeit des bisherigen privaten Kontos für den tatsächlichen Gesundheitsfunktionsumfang klären. [Google nennt Organisationskonten für Gesundheits-Apps](https://support.google.com/googleplay/android-developer/answer/13634885?hl=de). Keine Umstellung/neuen Verträge vorgenommen. [Bisheriger Supportfall](../step-07.md).
- **Geschlossener Test:** Aktuell **0 von mindestens 12 Testpersonen** angemeldet. Zwölf müssen mindestens 14 Tage fortlaufend angemeldet teilnehmen, bevor Produktionszugriff beantragt werden kann. Ein interner Entwurf startet die Frist nicht. [Google-Vorgaben](https://support.google.com/googleplay/android-developer/answer/14151465?hl=de). Länder/Testerkoordination und reale Opt-ins bleiben für den nächsten Schritt festzulegen; keine Einladungen versendet.

Keine öffentliche Android-Veröffentlichung und keine vollständige Release-Freigabe behauptet.
