# Countdown-Seite Dokumentation

## Übersicht

Die Countdown-Seite (`app/(tabs)/countdown.tsx`) ist eine zentrale Komponente der Wehen-Tracker App während der Schwangerschaftsphase. Sie bietet eine visuelle Darstellung der verbleibenden Zeit bis zum errechneten Geburtstermin, zeigt Informationen zur aktuellen Schwangerschaftswoche und ermöglicht es Benutzern, den Geburtstermin festzulegen oder zu ändern. Zudem enthält sie den wichtigen "Ich bin da!"-Button, mit dem Benutzer die Geburt ihres Babys melden können, was die App in die Post-Geburt-Phase umschaltet.

Die Seite ist mit einem warmen, benutzerfreundlichen Design gestaltet, das auf werdende Mütter zugeschnitten ist. Sie verwendet ein helles Hintergrundbild (`Background_Hell.png`) und ein Farbschema mit sanften Pastelltönen, das ein beruhigendes und positives Nutzererlebnis fördert.

## Datenbankstruktur

Die Countdown-Seite interagiert mit der `user_settings`-Tabelle in der Supabase-Datenbank:

### `user_settings` Tabelle
- Speichert benutzerspezifische Einstellungen
- Relevante Felder:
  - `id`: UUID (Primärschlüssel)
  - `user_id`: UUID (Fremdschlüssel zu auth.users)
  - `due_date`: TIMESTAMP WITH TIME ZONE (Errechneter Geburtstermin)
  - `is_baby_born`: BOOLEAN (Gibt an, ob das Baby bereits geboren ist)
  - `updated_at`: TIMESTAMP WITH TIME ZONE (Zeitpunkt der letzten Aktualisierung)

## Funktionalität

### Daten laden

Die Countdown-Seite lädt den errechneten Geburtstermin aus der `user_settings`-Tabelle:

1. Beim Laden der Komponente wird die `loadDueDate`-Funktion aufgerufen, wenn ein Benutzer angemeldet ist.
2. Die Funktion ruft den neuesten Eintrag aus der `user_settings`-Tabelle ab, sortiert nach dem Aktualisierungsdatum.
3. Wenn ein Eintrag gefunden wird, wird der Geburtstermin im lokalen Zustand gespeichert.

### Daten speichern

Die Countdown-Seite ermöglicht das Speichern des errechneten Geburtstermins:

1. Wenn der Benutzer einen Geburtstermin auswählt, wird die `saveDueDate`-Funktion aufgerufen.
2. Die Funktion prüft, ob bereits ein Eintrag in der `user_settings`-Tabelle existiert.
3. Wenn ein Eintrag existiert, wird er aktualisiert; andernfalls wird ein neuer Eintrag erstellt.
4. Nach erfolgreicher Speicherung wird eine Erfolgsmeldung angezeigt.

### Baby-Status ändern

Die Countdown-Seite ermöglicht es Benutzern, die Geburt ihres Babys zu melden:

1. Wenn der Benutzer auf den "Ich bin da!"-Button klickt, wird die `handleBabyBorn`-Funktion aufgerufen.
2. Die Funktion zeigt einen Bestätigungsdialog an.
3. Bei Bestätigung wird die `setIsBabyBorn`-Funktion aus dem `BabyStatusContext` aufgerufen, um den Baby-Status auf `true` zu setzen.
4. Nach erfolgreicher Aktualisierung wird eine Glückwunschmeldung angezeigt und der Benutzer zur Baby-Seite weitergeleitet.

## UI-Komponenten

### Countdown-Timer
- **CountdownTimer-Komponente**: Zeigt einen kreisförmigen Fortschrittsbalken mit der aktuellen Schwangerschaftswoche, dem Trimester und Informationen zur Entwicklung des Babys.
- Die Komponente berechnet automatisch:
  - Verbleibende Tage bis zum Geburtstermin
  - Aktuelle Schwangerschaftswoche und Tag
  - Fortschritt der Schwangerschaft in Prozent
  - Trimester (1., 2. oder 3.)
- **Interaktivität**: Beim Tippen auf den Countdown-Timer wird der Benutzer zur detaillierten Schwangerschaftsstatistik-Seite weitergeleitet.
- **Informationsanzeige**: Zeigt wochenspezifische Informationen zur Entwicklung des Babys aus der `pregnancyWeekInfo`-Konstante an.
- **Größenvergleich**: Zeigt einen Vergleich zur aktuellen Größe des Babys aus der `babySizeComparison`-Konstante an (z.B. "so groß wie eine Avocado").
- **Zeitleiste**: Zeigt eine visuelle Darstellung des Fortschritts von SSW 0 bis SSW 40 mit Markierungen.

### Geburtstermin-Karte
- **Geburtstermin-Anzeige**: Zeigt den aktuell festgelegten Geburtstermin im deutschen Datumsformat (TT.MM.JJJJ) oder "Nicht festgelegt" an.
- **Ändern/Festlegen-Button**: Öffnet einen DateTimePicker zur Auswahl des Geburtstermins, mit Kalender-Icon für bessere Erkennbarkeit.
- **DateTimePicker**: Ermöglicht die Auswahl eines Datums mit einer Begrenzung auf zukünftige Daten und maximal 40 Wochen in der Zukunft.
- **Kartendesign**: Abgerundete Ecken, leichter Schatten und heller Hintergrund für bessere Lesbarkeit.

### "Ich bin da!"-Button
- **Prominenter Button**: Großer, auffälliger Button in Akzentfarbe mit Baby-Emoji, der es Benutzern ermöglicht, die Geburt ihres Babys zu melden.
- **Bestätigungsdialog**: Fordert eine Bestätigung an, bevor der Baby-Status geändert wird, um versehentliche Änderungen zu vermeiden.
- **Erfolgsmeldung**: Zeigt eine Glückwunschmeldung an und leitet zur Baby-Seite weiter.
- **Positionierung**: Prominent platziert zwischen dem Countdown-Timer und der Geburtstermin-Karte für optimale Sichtbarkeit.

### Geburtsplan-Karte
- **Informationstext**: Erklärt die Bedeutung eines Geburtsplans und warum er wichtig für die Vorbereitung auf die Geburt ist.
- **Geburtsplan erstellen-Button**: Leitet zur Geburtsplan-Seite weiter, gestaltet in der Akzentfarbe mit abgerundeten Ecken.
- **Kartendesign**: Leicht abgesetzte Farbe vom Haupthintergrund, um als Informationsbereich erkennbar zu sein.

## Datenfluss

1. **Laden der Daten**:
   - Die Komponente wird geladen und ruft `loadDueDate` auf, wenn ein Benutzer angemeldet ist.
   - `loadDueDate` ruft den Geburtstermin aus der `user_settings`-Tabelle ab und setzt den lokalen Zustand.

2. **Ändern des Geburtstermins**:
   - Der Benutzer klickt auf den "Ändern/Festlegen"-Button und wählt ein Datum aus.
   - `handleDateChange` wird aufgerufen und ruft `saveDueDate` auf.
   - `saveDueDate` speichert den Geburtstermin in der `user_settings`-Tabelle.
   - Der lokale Zustand wird aktualisiert und eine Erfolgsmeldung wird angezeigt.

3. **Melden der Geburt**:
   - Der Benutzer klickt auf den "Ich bin da!"-Button.
   - `handleBabyBorn` wird aufgerufen und zeigt einen Bestätigungsdialog an.
   - Bei Bestätigung wird `setIsBabyBorn(true)` aufgerufen, was den Baby-Status in der Datenbank aktualisiert.
   - Eine Glückwunschmeldung wird angezeigt und der Benutzer wird zur Baby-Seite weitergeleitet.

## Abhängigkeiten

### Komponenten
- `ThemedText` und `ThemedView`: Für themenfähige Text- und View-Komponenten, die sich an das gewählte Farbschema anpassen
- `IconSymbol`: Für Icons wie Kalender, Pfeil und andere UI-Elemente
- `CountdownTimer`: Eigenständige Komponente für die Anzeige des Countdown-Timers mit kreisförmigem Fortschrittsbalken
- `DateTimePicker`: Native Komponente für die Auswahl des Geburtstermins mit plattformspezifischem Verhalten (iOS/Android)
- `ImageBackground`: Für das Hintergrundbild der Seite
- `SafeAreaView` und `StatusBar`: Für die korrekte Anzeige auf verschiedenen Geräten und Betriebssystemen

### Hooks
- `useAuth`: Für den Zugriff auf den Authentifizierungsstatus und Benutzerinformationen
- `useBabyStatus`: Für den Zugriff auf den Baby-Status und die Funktion zum Ändern des Status
- `useColorScheme`: Für den Zugriff auf das aktuelle Farbschema des Geräts (hell/dunkel)
- `useRouter`: Für die Navigation zwischen den Seiten

### API-Funktionen
- `supabase`: Für direkten Zugriff auf die Supabase-Datenbank
- `getBabyBornStatus` und `setBabyBornStatus` (indirekt über `useBabyStatus`): Für den Zugriff auf den Baby-Status

### Konstanten
- `pregnancyWeekInfo`: Detaillierte Informationen zur Entwicklung des Babys in jeder Schwangerschaftswoche (SSW 4-42)
- `babySizeComparison`: Anschauliche Vergleiche für die Babygröße in den verschiedenen Schwangerschaftswochen mit passenden Emojis
- `Colors`: Farbdefinitionen für verschiedene Themen und UI-Elemente

## Besonderheiten und Einschränkungen

- **Datumseinschränkungen**: Der Geburtstermin kann nur in der Zukunft liegen und maximal 40 Wochen (280 Tage) vom aktuellen Datum entfernt sein, um realistische Schwangerschaftszeiträume zu gewährleisten.
- **Automatische Aktualisierung**: Die CountdownTimer-Komponente aktualisiert sich stündlich und um Mitternacht, um die verbleibenden Tage und die aktuelle Schwangerschaftswoche korrekt anzuzeigen, ohne dass ein manuelles Neuladen erforderlich ist.
- **AppState-Erkennung**: Die Komponente erkennt, wenn die App in den Vordergrund kommt, und aktualisiert die Anzeige entsprechend, um immer aktuelle Informationen zu zeigen.
- **Wochenspezifische Informationen**: Die CountdownTimer-Komponente zeigt spezifische Informationen zur Entwicklung des Babys und anschauliche Vergleiche zur Größe des Babys basierend auf der aktuellen Schwangerschaftswoche an (SSW 4-42).
- **Geburtsbenachrichtigung**: Wenn das Baby bereits geboren sein sollte (daysLeft <= 0), zeigt die CountdownTimer-Komponente eine Glückwunschmeldung an, anstatt negative Tage anzuzeigen.
- **Bedingte Sichtbarkeit**: Die Countdown-Seite ist nur in der Schwangerschaftsphase (is_baby_born = false) in der Tab-Navigation sichtbar und wird nach der Geburt durch andere Ansichten ersetzt.
- **Responsive Design**: Die Komponenten passen sich an verschiedene Bildschirmgrößen an, wobei der Countdown-Timer proportional zur Bildschirmbreite skaliert wird.
- **Plattformübergreifende Anpassungen**: Der DateTimePicker berücksichtigt plattformspezifische Unterschiede zwischen iOS und Android für eine native Benutzererfahrung.

## Verbesserungsmöglichkeiten

1. **Personalisierung**: Hinzufügen von Möglichkeiten zur Personalisierung des Countdowns, z.B. mit einem benutzerdefinierten Hintergrundbild oder Farbschema, um die App noch persönlicher zu gestalten.
2. **Meilensteine**: Hinzufügen von wichtigen Meilensteinen während der Schwangerschaft, z.B. Ultraschalltermine, Vorsorgeuntersuchungen, etc., mit visueller Darstellung auf der Zeitleiste.
3. **Erinnerungen**: Implementierung von Erinnerungen für wichtige Termine oder Aufgaben vor der Geburt, mit Push-Benachrichtigungen und Kalenderintegration.
4. **Teilen-Funktion**: Hinzufügen einer Möglichkeit, den Countdown und aktuelle Schwangerschaftsinformationen mit Freunden und Familie über soziale Medien oder Messaging-Apps zu teilen.
5. **Mehrlingsschwangerschaften**: Anpassung der Informationen und des Countdowns für Mehrlingsschwangerschaften, mit spezifischen Entwicklungsinformationen für Zwillinge, Drillinge, etc.
6. **Historische Daten**: Speichern der historischen Daten, wenn der Geburtstermin geändert wird, um Änderungen nachverfolgen zu können und eine Verlaufsansicht anzubieten.
7. **Offline-Modus**: Implementierung eines Offline-Modus, der auch ohne Internetverbindung funktioniert und die Daten später synchronisiert, um die App jederzeit nutzbar zu machen.
8. **Automatische Berechnung**: Implementierung einer automatischen Berechnung des Geburtstermins basierend auf dem ersten Tag der letzten Periode oder dem Datum der Befruchtung, mit Anpassungsmöglichkeiten nach Ärztlichen Untersuchungen.
9. **Schwangerschaftstagebuch**: Integration eines Tagebuchs direkt in die Countdown-Seite, um besondere Momente, Gedanken und Gefühle während der Schwangerschaft festzuhalten.
10. **Erweiterte Statistiken**: Hinzufügen von detaillierteren Statistiken zur Schwangerschaft, wie z.B. Gewichtszunahme, Babygewicht-Schätzungen, etc.
11. **Interaktive 3D-Visualisierung**: Implementierung einer 3D-Darstellung des Babys in der aktuellen Entwicklungsphase, die gedreht und vergrößert werden kann.
12. **Schwangerschafts-Community**: Integration einer Community-Funktion, um sich mit anderen werdenden Müttern auszutauschen, die einen ähnlichen Geburtstermin haben.
13. **Schwangerschafts-Quiz**: Hinzufügen von interaktiven Quiz-Elementen, um spielerisch mehr über die Schwangerschaft und Babyentwicklung zu lernen.
14. **Verbesserte Schwangerschaftsstatistik**: Erweiterung der Statistik-Seite mit Diagrammen und Visualisierungen zur Schwangerschaftsentwicklung.
15. **Sprachsteuerung**: Implementierung von Sprachbefehlen, um die App händefrei bedienen zu können, besonders nützlich in späteren Schwangerschaftsphasen.
