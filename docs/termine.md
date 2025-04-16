# Dokumentation: Termine-Seite

## Übersicht

Die Termine-Seite (`app/termine.tsx`) ist eine Funktion der App, die es Benutzern ermöglicht, wichtige Termine im Zusammenhang mit ihrer Schwangerschaft und ihrem Baby zu verwalten. Die Seite bietet eine übersichtliche Darstellung aller anstehenden Termine, Filterfunktionen und die Möglichkeit, neue Termine hinzuzufügen oder bestehende zu löschen.

## Funktionalität

### Hauptfunktionen

1. **Terminübersicht**:
   - Anzeige aller Termine in chronologischer Reihenfolge
   - Farbliche Kennzeichnung verschiedener Termintypen (Arzttermin, Vorsorgeuntersuchung, Sonstiges)
   - Detaillierte Informationen zu jedem Termin (Datum, Uhrzeit, Ort, Notizen)

2. **Terminverwaltung**:
   - Hinzufügen neuer Termine mit Titel, Datum, Uhrzeit, Ort, Notizen und Termintyp
   - Löschen bestehender Termine mit Bestätigungsdialog
   - Suchen nach Terminen durch Filterung nach Titel, Ort oder Notizen

## Technische Details

### Datenstruktur

Die Termine werden als Array von `Appointment`-Objekten mit folgenden Eigenschaften gespeichert:
- `id`: Eindeutige ID des Termins
- `title`: Titel des Termins
- `date`: Datum und Uhrzeit des Termins (JavaScript Date-Objekt)
- `location`: Ort des Termins
- `notes`: Zusätzliche Notizen zum Termin
- `type`: Art des Termins ('doctor', 'checkup' oder 'other')

### Komponenten und Hooks

Die Seite verwendet folgende React-Komponenten und Hooks:
- `useState`: Für die Verwaltung des Zustands (Termine, Suchbegriff, Formularanzeige, neuer Termin)
- `DateTimePicker`: Für die Auswahl von Datum und Uhrzeit
- `FlatList`: Für die effiziente Darstellung der Terminliste
- `Alert`: Für Bestätigungsdialoge beim Löschen von Terminen
- `format` aus `date-fns`: Für die Formatierung von Datum und Uhrzeit
- `de` aus `date-fns/locale`: Für die deutsche Lokalisierung der Datumsformatierung

### Datenfluss

1. **Initialisierung**:
   - Die Seite wird mit Beispieldaten initialisiert (SAMPLE_APPOINTMENTS)
   - In einer realen Implementierung würden die Daten aus einer Datenbank geladen

2. **Datenmanipulation**:
   - Neue Termine werden dem Zustand hinzugefügt und in einer realen Implementierung in der Datenbank gespeichert
   - Gelöschte Termine werden aus dem Zustand entfernt und in einer realen Implementierung aus der Datenbank gelöscht
   - Die Suche filtert die Termine basierend auf dem eingegebenen Suchbegriff

3. **Datenvisualisierung**:
   - Die Termine werden nach Datum sortiert und in einer Liste angezeigt
   - Jeder Termin wird mit seinen Details und einer farblichen Kennzeichnung des Typs dargestellt

## UI-Elemente

### Layout

Die Seite ist in folgende Abschnitte unterteilt:
1. **Header**: Mit Zurück-Button und Titel "Termine"
2. **Suchleiste**: Zum Filtern der Termine
3. **Terminliste**: Zeigt alle Termine in chronologischer Reihenfolge an
4. **Hinzufügen-Button**: Schwebender Button zum Hinzufügen neuer Termine
5. **Formular**: Erscheint, wenn ein neuer Termin hinzugefügt werden soll

### Styling

- **Farbschema**: Verwendet die Farbpalette der App mit spezifischen Farben für verschiedene Termintypen:
  - Arzttermin: Rosa (#FF9F9F)
  - Vorsorgeuntersuchung: Hellblau (#9FD8FF)
  - Sonstiges: Grau (#D9D9D9)
- **Karten**: Termine werden als Karten mit abgerundeten Ecken dargestellt
- **Icons**: Verwendet verschiedene Icons für verschiedene Informationstypen (Kalender, Uhr, Ort, Notizen)
- **Hintergrund**: Verwendet das gleiche Hintergrundbild wie andere Seiten der App

## Termintypen

Die App unterstützt drei verschiedene Arten von Terminen:

1. **Arzttermin (doctor)**:
   - Für reguläre Arztbesuche
   - Farblich in Rosa dargestellt

2. **Vorsorgeuntersuchung (checkup)**:
   - Für spezielle Vorsorgeuntersuchungen wie U-Untersuchungen
   - Farblich in Hellblau dargestellt

3. **Sonstiges (other)**:
   - Für alle anderen Arten von Terminen (z.B. Hebammenbesuche, Kurse)
   - Farblich in Grau dargestellt

## Formular zum Hinzufügen von Terminen

Das Formular zum Hinzufügen neuer Termine enthält folgende Felder:
- **Titel**: Pflichtfeld für den Namen des Termins
- **Datum & Uhrzeit**: Auswahl über einen DateTimePicker
- **Ort**: Optionales Feld für den Ort des Termins
- **Notizen**: Optionales Feld für zusätzliche Informationen
- **Typ**: Auswahl zwischen Arzttermin, Vorsorgeuntersuchung und Sonstiges

## Fehlerbehandlung

Die Seite enthält Fehlerbehandlung für folgende Szenarien:
- Validierung des Titels beim Hinzufügen eines neuen Termins (darf nicht leer sein)
- Bestätigungsdialog beim Löschen eines Termins
- Anzeige eines leeren Zustands, wenn keine Termine vorhanden sind oder kein Termin den Suchkriterien entspricht

## Verwendung

Die Termine-Seite ist über den "Mehr"-Tab in der Tab-Navigation zugänglich, unter dem Abschnitt "Baby & Familie". Sie kann verwendet werden, um wichtige Termine wie Arztbesuche, Vorsorgeuntersuchungen und andere Ereignisse im Zusammenhang mit der Schwangerschaft und dem Baby zu verwalten.

## Zukünftige Erweiterungen

Mögliche zukünftige Erweiterungen für diese Seite könnten sein:
- Integration mit der Kalender-App des Geräts
- Erinnerungsfunktion für anstehende Termine
- Wiederholende Termine
- Teilen von Terminen mit Partnern oder Familienmitgliedern
- Synchronisierung mit einer Datenbank für persistente Speicherung
- Kategorisierung nach Zeiträumen (heute, diese Woche, nächster Monat)
- Detailansicht für jeden Termin mit zusätzlichen Informationen
