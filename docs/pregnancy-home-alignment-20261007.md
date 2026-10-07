# Schwangerschafts-Home angeglichen · 7. Oktober 2026

„Dein Tag im Überblick“ steht wieder linksbündig im Kopf der Zahlenkarte, mit derselben Schrift, demselben Abstand und Chevron wie auf der Baby-Home. Die separate Überschrift oberhalb und die zusätzliche Überschrift „Deine Schwangerschaft in Zahlen“ entfallen. Die drei Schwangerschaftswerte und die Navigation zum Countdown bleiben erhalten.

Beide Home-Modi verwenden `HomeOverviewHeading` und `HomeCarouselDots` aus `components/ui/home-overview.tsx`. Die sichtbaren Punkte sind jeweils 6 × 6 px groß, liegen 14 px von Mittelpunkt zu Mittelpunkt auseinander und nutzen dieselben Farben für den aktiven/inaktiven Zustand. In der Schwangerschaft bleiben sie antippbar; ihre Trefferfläche ist vertikal erweitert. Die Kachelbreiten, Zahlenbereiche und Android-Emojiabstände folgen der Baby-Home. Bei großer Systemschrift werden die Kacheln auf beiden Plattformen untereinander angeordnet. Der Shop bleibt der zweite Slide.

## Verifikation

- Anwendungs-TypeScript: erfolgreich.
- ESLint: keine Fehler; die 4 Baby-Home- und 16 Schwangerschafts-Home-Warnungen wurden mit dem gesicherten Ausgangsstand verglichen und sind unverändert. Die neuen bzw. bearbeiteten UI-Komponenten haben keine Warnungen.
- Lokale React-Native-Web-Komponentenvorschau: 414 px, hell, Normalschrift; beide Überschriften mit 22 px, Gewicht 700, identischer Farbe und Ausrichtung. Zahlenkarte 374 × 270 px, ohne horizontalen Überlauf. Punkte 6 × 6 px, Abstand 14 px.
- 320 px, dunkel, simulierte Schriftgröße 160 %: Zahlenkarte 280 × 730,79 px, Kacheln untereinander, kein horizontaler Überlauf. Die natürliche Kartenhöhe wird weiterhin für beide Slides verwendet.
- Antippen der Punkte bewegt das Karussell zum zweiten Slide und zurück. Antippen der Zahlenkarte löst den vorgesehenen Callback aus. Keine Browser-Konsolenfehler.

Die Vorschau verwendet die aktuellen UI-Komponenten; Account, Fokus, Theme-Kontext und Shop-Inhalt sind simuliert. Sie ist keine Abnahme der angemeldeten App auf einem physischen iOS-/Android-Gerät. Die UI wurde anschließend im unten dokumentierten EAS-Update veröffentlicht.

Nachweise einschließlich Ausgangsdateien, Diff, Typprüfung, Lintvergleich, Vorschau und Browsermessungen: `output/pregnancy-home-alignment-20261007/`.

## EAS Update

Am 7. Oktober 2026 um 14:29 Uhr MESZ als [Update 07c6f976-adb5-4110-a6c1-3488c554fd1d](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/07c6f976-adb5-4110-a6c1-3488c554fd1d) für iOS und Android veröffentlicht. Kanal und Branch: `release-candidate-20261003`; EAS-Umgebung: `production`; Runtime: `1.0.25` auf beiden Plattformen.

Die vollständig anhand der gespeicherten Dateihashes geprüfte Ausgangsquelle ist das unmittelbar zuvor veröffentlichte Kinder-Auswahl-Update `606ca7e0-c28e-4e89-a14a-194816036d31`. Genau die fünf Dateien der Home-Angleichung wurden übernommen; 991 weitere Quelldateien, Paketdateien, native Konfiguration und das Asset-Paket bleiben unverändert. Die aktuelle Kinder-Auswahl-Korrektur bleibt enthalten. Die Anwendungs-Typprüfung ist auch in dieser isolierten Quelle erfolgreich. Beide exportierten Bundles enthalten `HomeOverviewHeading` und `HomeCarouselDots` sowie die vorhandenen Kinder-Auswahl- und Wiederholungsabläufe.

Das geprüfte Exportpaket wurde unverändert mit `--skip-bundler` aus dem isolierten Quellverzeichnis veröffentlicht. Die für den Kandidatenkanal und Runtime `1.0.25` ausgelieferten Manifeste stimmen für beide Plattformen mit den veröffentlichten IDs, geprüften Bundle-Hashes und sämtlichen Assets überein. Alle fünf Kanalzuordnungen und das öffentliche `main`-Update sind unverändert. Die gespeicherten Arbeitsordnerdateien und der isolierte Quellstand sind nach Veröffentlichung unverändert bestätigt. Eine physische Geräteabnahme erfolgte nicht.

Zum Laden die installierte Kandidaten-App vollständig beenden und erneut öffnen. Falls zunächst der alte Stand erscheint, nach dem Download noch einmal vollständig beenden und öffnen.

Veröffentlichungsnachweis: `output/pregnancy-home-alignment-20261007/publication-verification.json`; Manifest- und Exportprüfung im selben Ordner. Isolierte Quelle und private EAS-Rohdaten: `.family-qa/pregnancy-home-alignment-20261007/`.
