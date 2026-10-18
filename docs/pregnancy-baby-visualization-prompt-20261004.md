# Einbau-Prompt: Babyansicht passend zur Schwangerschaftswoche

## Auftrag zum direkten Kopieren

Implementiere in `/Users/janzeppenfeld/Developer/LottiBaby` eine anschauliche, zur ausgewählten SSW passende Darstellung des Babys im Bauch. Prüfe zuerst den aktuellen Arbeitsstand und bewahre vorhandene Änderungen. Verwende den bestehenden Glas-/Pastellstil, Typografie, Abstände und Header. Behalte „Dein Tag im Überblick“, vorhandene Funktionen und den Countdown-Link vollständig bei.

### Wo die Darstellung erscheinen soll

- In `components/pregnancy-guide/week-overview.tsx` unter beziehungsweise im Bereich „Dein Baby“ eine kompakte, gut sichtbare Entwicklungskarte anbieten.
- In `components/pregnancy-guide/week-article.tsx` im Abschnitt „Dein Baby“ dieselbe Darstellung einbinden.
- Die Darstellung folgt ausschließlich `dossier.week` der bestehenden SSW-Auswahl. Keine zweite unabhängige Wochenauswahl oder zufällige Zuordnung einführen. Beim Wechsel aktualisieren Bild und Beschriftung gemeinsam.
- Text: ausgewählte SSW und eine kurze Erklärung aus dem bestehenden Wochenkatalog, mit Übersetzungen Deutsch/Englisch/Spanisch. Bild und Entwicklungstext sollen getrennt von den fotografischen Story-Titelbildern erkennbar sein.
- „Entbindungstermin ansehen“ öffnet weiterhin `/(tabs)/countdown`. Optional kann „Größenvergleich ansehen“ die bestehende Route `/baby-size` mit `week: String(dossier.week)` öffnen; das ersetzt die Entwicklungsdarstellung nicht.

### Geeignete Assets zuerst beschaffen

Erstelle einen Satz fachlich geprüfter oder passend lizenzierter Entwicklungsillustrationen. Gewünscht ist eine ruhige, natürlich wirkende medizinische Illustration mit räumlicher Tiefe: Baby/Embryo im Bauch, dezente Umgebung, klare Kontur, keine grellen Farben, keine comicartigen Gesichter und kein glänzender Plastiklook. Anatomie und Entwicklungsstadium müssen zur Wochenzuordnung passen.

Statische, optimierte Illustrationen mit 3D-Anmutung reichen für die erste Umsetzung. Keine neue native Rendering-Bibliothek und kein neuer Build sind allein hierfür nötig. Echte drehbare 3D-Modelle sind ein separater Auftrag.

Lege die freigegebenen Dateien unter `assets/images/pregnancy-development/` ab. Erfasse in einer lokalen Manifestdatei für jedes Bild den abgedeckten SSW-Bereich, Quelle, Lizenz und tatsächlichen fachlichen Prüfstatus. Keine medizinische Freigabe behaupten, wenn diese nicht vorliegt. Fehlen geeignete Assets, liefere den konkreten Beschaffungsbedarf und baue keine vermeintlich fertige Darstellung mit ungeprüften Bildern ein.

### Wochenlogik und Inhalte

- Referenz für die Wochenzählung ist `lib/pregnancy-guide/weeks.ts` und die vorhandene Zählweise des Wochenbegleiters. Unterscheide laufende SSW von abgeschlossenen Wochen.
- Für frühe Wochen verwende eine dazu passende sachliche Illustration und die bereits vorhandene Erklärung; zeige keinen fertig entwickelten Fötus lediglich kleiner skaliert.
- Die Wochen 41 und 42 bleiben in der späten Entwicklungsphase; niemals am Ende des Bildarrays zu einer frühen Woche zurückspringen.
- Falls ein Bild mehrere Wochen abdeckt, ordne den Zeitraum explizit zu und benenne die Darstellung als schematische Orientierung. Nicht 42 scheinbar exakt wöchentliche Bilder aus nur einem unveränderten Motiv vortäuschen.
- Übernimm Entwicklungsbehauptungen oder Maße aus `lib/baby-size-data.ts` nicht ungeprüft. Dieser ältere Größenvergleich verwendet eine andere Darstellung; gleiche medizinische Angaben mit aktuellen Primärquellen und dem bestehenden Wochenkatalog ab.

### Umsetzung und Prüfung

Eine gemeinsame Komponente `components/pregnancy-guide/baby-development.tsx` und eine lokale, typisierte Zuordnung in `lib/pregnancy-guide/development-media.ts` sind sinnvoll. Verwende stabile Asset-IDs und bei wechselnden Expo-Images einen `recyclingKey`. Lade Bilder lokal, bewahre Offline-Verfügbarkeit und biete passende barrierefreie Beschriftungen. Quellen/Illustrationshinweise sind über die vorhandene Quellenansicht erreichbar, ohne große technische Hinweise im Lesefluss.

Prüfe die Auswahl und Rücknavigation für SSW 1, 2, 7, 12, 20, 32, 40, 41 und 42. Prüfe außerdem dunkles Design, große Systemschrift, schmale Displays und die bestehenden Story-Übergänge zwischen „Dein Baby“ und „Dein Körper“. Vorhandenes Runterziehen zum Schließen und die memoisierten Story-Screen-Optionen müssen erhalten bleiben.

Nutze für eine anschließende Vorschau ausschließlich den vorhandenen EAS-Kandidatenkanal `release-candidate-20261003` mit dessen kompatibler Runtime. Prüfe die aktuelle Konfiguration neu. Verändere weder den öffentlichen `main`-Updatezweig noch native Konfiguration, Backend, Einwilligungen oder Abos im Rahmen dieses UI-Auftrags.
