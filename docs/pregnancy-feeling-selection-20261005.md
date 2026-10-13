# Tagesauswahl gemeinsam einordnen · 5. Oktober 2026

Die vorherige Ansicht zeigte jeweils einen Artikel hinter Themenumschaltern. Jetzt wählt die Nutzerin die Beschwerden des Kalendertags und tippt auf **Meine Auswahl einordnen**. Das Ergebnis listet alle angeklickten Beschwerden mit Häkchen auf. Jede zugeordnete Beschwerde erhält anschließend eine eigene farbige Erklärung mit der SSW dieses Tages und erreichbaren Quellen. Es stehen alle gewählten Themen gleichzeitig im Ergebnis, ohne Artikel-Umschalter.

- Gleiche Artikelthemen werden gebündelt, etwa Übelkeit und Erbrechen. Beide tatsächlich gewählten Bezeichnungen bleiben in der Liste und im Erklärungstitel sichtbar.
- Abwählen, Tageswechsel, geänderte SSW, Stimmung oder Stärke blenden die alte Einordnung aus. Erneutes Einordnen nutzt ausschließlich die aktuelle Auswahl. Unveränderte Ergebnisse bleiben beim Wechsel zwischen Tagebuch und Verstehen erhalten; Notizen werden nicht medizinisch interpretiert.
- Allgemeine Wochenartikel bleiben separat eingeklappt. Sie werden nicht als individuell ausgewählte Beschwerden ausgegeben. Hilfetexte bleiben auch vor dem Einordnen erreichbar.
- Neuer Auswahlpunkt **Empfindliche / schmerzende Brüste** in Körper & Entlastung, samt Artikel, frühen und späteren Erklärungen, Quellen und Hinweisen zur Abklärung. 18 Auswahlpunkte, 30 Artikel. Brustschmerzen wurden als Schmerzen der Brüste umgesetzt; die optionale Rückfrage blieb bislang unbeantwortet und diese Annahme wurde im Chat benannt. Schmerzen im Brustkorb werden ausdrücklich unterschieden.

Die Einordnung wird lokal aus der Tagesauswahl und quellenbasierten Inhalten zusammengestellt. Es wurde kein KI- oder Serveraufruf hinzugefügt und keine Diagnose aus einer Symptomkombination abgeleitet. Bestehende lokale Speicherung, Einwilligungs- und Kontogrenzen bleiben erhalten. Alle Inhalte sind auf Deutsch, Englisch und Spanisch vorhanden. Redaktioneller Status bleibt `draft`; keine medizinische Fachprüfung wird behauptet.

## Quellen zu den Brustbeschwerden

[BIÖG: Progesteron](https://www.familienplanung.de/service/lexikon/progesteron/), [BIÖG: Körperveränderungen](https://www.familienplanung.de/schwangerschaft/beschwerden-und-krankheiten/beschwerden-in-der-schwangerschaft-wie-sich-der-koerper-veraendert/), [BIÖG: Brustspannen in der 13.–16. SSW](https://www.familienplanung.de/schwangerschaft/schwangerschaftswochen/13-bis-16-schwangerschaftswoche/), [NHS: Breast pain](https://www.nhs.uk/symptoms/breast-pain/) und [CDC: mütterliche Warnzeichen](https://www.cdc.gov/hearher/maternal-warning-signs/index.html), am 5. Oktober 2026 geprüft. Eigene Zusammenfassungen. Nicht abrufbare NHS-PDF-Links wurden nicht in die App übernommen.

## Prüfung

**82 Tests in 9 Testgruppen bestanden**, App- und Test-TypeScript sowie ESLint für geänderte Dateien bestanden. Die Tests prüfen alle Beschwerdeerklärungen in SSW 1–42 und drei Sprachen, neue Brustartikel/Quellen/Speicherung, gemeinsame Tagesliste, Zusammenfassung gemeinsamer Themen, das Ausblenden veralteter Ergebnisse, unterschiedliche gespeicherte Tagesauswahlen, Stimmung ohne Beschwerden, leere Auswahl, Entwurfserhalt und bestehende Speicherfehler-/Einwilligungs-/Navigationsfälle.

Die lokale Vorschau nutzt echte Guide-Komponenten mit simulierten Datierungs-, Konto- und Plattformdiensten. Kopfschmerzen, Bauchschmerzen und Brustempfindlichkeit waren in der 25. SSW gemeinsam sichtbar. Abwählen und erneutes Einordnen entfernten die Kopfschmerzen korrekt. Quellen zu Brustbeschwerden wurden aufgeklappt. In der 38. SSW bei 320 Pixel Breite, dunklem Design und Schriftfaktor 1,6 gab es keinen horizontalen Überlauf. Kein Konsolenfehler beobachtet. Browsergröße wieder zurückgesetzt. Kein physischer Gerätetest in diesem Durchgang.

## Veröffentlichung

**Veröffentlicht am 5. Oktober 2026 um 14:53 MESZ:** [EAS Update 64034c76-7953-4a56-a018-528494b7d5d6](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/64034c76-7953-4a56-a018-528494b7d5d6). Channel/Branch `release-candidate-20261003`, Environment `production`, iOS und Android Runtime `1.0.25`. Isolierte Quelle aus dem letzten veröffentlichten Update `8644736e-829e-4891-bed9-961ab97a3687`: 12 gezielt übernommene Dateien, 1023 andere Quelldateien unverändert. Keine Änderungen an nativen Abhängigkeiten oder Konfiguration. iOS- und Android-Exporte auf die bestehende Runtime `1.0.25`, Produktionsbackend, plattformspezifische Billing-Schlüssel der Release-Kandidaten, bestehende Story-Funktionen und alle 30 Guide-Fotos geprüft. Nachweise enthalten nur Fingerabdrücke, keine Schlüssel.

Nachweise: `output/pregnancy-feeling-selection-20261005/`; EAS-Rohdaten und vorbereitete Quelle privat in `.family-qa/pregnancy-feeling-selection-20261005/`.

Beide vom EAS-Server ausgelieferten Manifeste enthalten die erwarteten Update-IDs, Hashes der geprüften Bundles und alle 30 Fotos. Kanalzuordnungen und öffentliches `main` sind unverändert. Die Manifest-Prüfung bestätigt die Auslieferungsmetadaten; CDN-Bundlebytes und ein physischer Gerätetest wurden in diesem Durchgang nicht unabhängig geprüft. Kein neuer Store-Build erstellt.
