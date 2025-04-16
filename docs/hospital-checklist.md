# Dokumentation: Krankenhaus-Checkliste

## Übersicht

Die Krankenhaus-Checkliste (`app/(tabs)/explore.tsx`) ist eine Funktion der App, die werdenden Müttern hilft, alle wichtigen Dinge für ihren Krankenhausaufenthalt zu organisieren. Die Seite bietet eine kategorisierte Liste von Gegenständen, die für den Krankenhausaufenthalt benötigt werden, mit der Möglichkeit, Einträge abzuhaken, zu löschen und neue hinzuzufügen.

## Funktionalität

### Hauptfunktionen

1. **Vordefinierte Checkliste**: 
   - Beim ersten Öffnen wird automatisch eine vordefinierte Liste mit wichtigen Gegenständen erstellt
   - Einträge sind in Kategorien wie "Dokumente", "Kleidung für Mama", "Kleidung für Baby", "Hygieneartikel" und "Sonstiges" organisiert

2. **Interaktive Funktionen**:
   - Abhaken von Einträgen, wenn sie eingepackt wurden
   - Löschen von nicht benötigten Einträgen
   - Hinzufügen neuer, individueller Einträge mit Kategorie und optionalen Notizen

3. **Fortschrittsanzeige**:
   - Jede Kategorie zeigt den Fortschritt an (z.B. "3/5 (60%)")
   - Kategorien können ein- und ausgeklappt werden für bessere Übersicht

## Technische Details

### Datenstruktur

Die Checklisten-Einträge werden in der Supabase-Datenbank in der Tabelle `hospital_checklist` gespeichert mit folgenden Feldern:
- `id`: Eindeutige ID des Eintrags
- `user_id`: ID des Benutzers, dem der Eintrag gehört
- `item_name`: Name des Gegenstands
- `is_checked`: Status (abgehakt oder nicht)
- `category`: Kategorie des Gegenstands
- `notes`: Optionale Notizen zum Gegenstand
- `position`: Position in der Liste für die Sortierung
- `created_at` und `updated_at`: Zeitstempel

### Komponenten

Die Seite verwendet folgende Komponenten:
- **ParallaxScrollView**: Für das Scrolling mit Parallax-Effekt im Header
- **ChecklistCategory**: Zeigt eine Kategorie mit ihren Einträgen an
- **ChecklistItem**: Zeigt einen einzelnen Eintrag mit Checkbox und Lösch-Button an
- **AddChecklistItem**: Formular zum Hinzufügen neuer Einträge
- **Collapsible**: Ermöglicht das Ein- und Ausklappen von Kategorien

### Datenfluss

1. **Laden der Daten**:
   - Beim Öffnen der Seite werden die gespeicherten Einträge aus der Datenbank geladen
   - Wenn keine Einträge vorhanden sind, werden die vordefinierten Einträge automatisch hinzugefügt
   - Die Daten werden bei jedem Fokus auf den Tab neu geladen

2. **Datenmanipulation**:
   - Neue Einträge werden in der Datenbank gespeichert und lokal im State aktualisiert
   - Änderungen am Status (abgehakt/nicht abgehakt) werden sofort in der Datenbank aktualisiert
   - Gelöschte Einträge werden aus der Datenbank entfernt und aus dem lokalen State gefiltert

3. **Datengruppierung**:
   - Die Einträge werden nach Kategorien gruppiert für die Anzeige
   - Innerhalb jeder Kategorie werden die Einträge nach ihrer Position sortiert

## UI-Elemente

### Layout

Die Seite ist in folgende Abschnitte unterteilt:
1. **Header**: Mit Parallax-Effekt und Checklisten-Icon
2. **Titel und Beschreibung**: Erklärt den Zweck der Checkliste
3. **Kategorien**: Aufklappbare Abschnitte mit den Einträgen
4. **Hinzufügen-Button**: Am Ende der Liste zum Hinzufügen neuer Einträge

### Styling

- **Farbschema**: Beige-Töne (#F9F1EC, #E9C9B6) und Braun-Töne (#5C4033)
- **Kategorien**: Aufklappbare Karten mit Fortschrittsanzeige
- **Einträge**: Zeilen mit Checkbox, Text und Lösch-Button
- **Hinzufügen-Button**: Gestrichelte Umrandung mit Plus-Icon

## Vordefinierte Einträge

Die Checkliste enthält folgende vordefinierte Kategorien und Einträge:

### Dokumente
- Mutterpass
- Personalausweis
- Krankenversicherungskarte
- Familienstammbuch
- Geburtsplan (falls vorhanden)

### Kleidung für Mama
- Bequeme Nachthemden
- Warme Socken
- Bademantel
- Stillbustier/Still-BHs
- Bequeme Unterwäsche
- Hausschuhe
- Bequeme Kleidung für die Heimreise

### Kleidung für Baby
- Bodys
- Strampler
- Mützchen
- Söckchen
- Jäckchen
- Heimfahrt-Outfit

### Hygieneartikel
- Zahnbürste & Zahnpasta
- Haarbürste & Haargummis
- Duschgel & Shampoo
- Wochenbetteinlagen
- Brustwarzensalbe
- Lippenpflegestift
- Feuchttücher für Baby
- Windeln für Neugeborene

### Sonstiges
- Handtücher
- Waschlappen
- Handy & Ladekabel
- Snacks & Getränke
- Kamera
- Lektüre/Zeitschriften
- Maxicar/Babyschale für Heimfahrt

## Fehlerbehandlung

Die Seite enthält Fehlerbehandlung für folgende Szenarien:
- Fehler beim Laden der Checkliste
- Fehler beim Hinzufügen neuer Einträge
- Fehler beim Ändern des Status eines Eintrags
- Fehler beim Löschen eines Eintrags

Im Fehlerfall wird eine entsprechende Fehlermeldung angezeigt und die Möglichkeit geboten, die Aktion zu wiederholen.

## Verwendung

Die Krankenhaus-Checkliste ist über den "Explore"-Tab in der Tab-Navigation zugänglich. Sie sollte idealerweise einige Wochen vor dem errechneten Geburtstermin verwendet werden, um sicherzustellen, dass alle notwendigen Gegenstände für den Krankenhausaufenthalt vorbereitet sind.

## Zukünftige Erweiterungen

Mögliche zukünftige Erweiterungen für diese Seite könnten sein:
- Drag & Drop-Funktionalität zum Neuordnen der Einträge
- Export/Teilen der Checkliste
- Erinnerungen für noch nicht abgehakte Einträge
- Anpassbare Kategorien
- Vorschläge basierend auf der Jahreszeit oder dem Krankenhaus
