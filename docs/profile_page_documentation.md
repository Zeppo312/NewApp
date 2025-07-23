# Profil-Seite Dokumentation

## Übersicht

Die Profil-Seite (`app/profil.tsx`) ermöglicht es Benutzern, ihre persönlichen Daten und Informationen über ihr Baby zu verwalten. Die Seite ist in zwei Hauptabschnitte unterteilt: Persönliche Daten und Baby-Informationen. Die Seite ist zugänglich über den "Mehr"-Tab in der Hauptnavigation.

## Datenbankstruktur

Die Profil-Seite interagiert mit mehreren Tabellen in der Supabase-Datenbank:

### `profiles` Tabelle
- Speichert grundlegende Benutzerinformationen
- Relevante Felder:
  - `id`: UUID (Primärschlüssel)
  - `first_name`: TEXT
  - `last_name`: TEXT

### `user_settings` Tabelle
- Speichert benutzerspezifische Einstellungen
- Relevante Felder:
  - `id`: UUID (Primärschlüssel)
  - `user_id`: UUID (Fremdschlüssel zu auth.users)
  - `due_date`: TIMESTAMP WITH TIME ZONE (Errechneter Geburtstermin)
  - `is_baby_born`: BOOLEAN (Gibt an, ob das Baby bereits geboren ist)

### `baby_info` Tabelle
- Speichert Informationen über das Baby
- Relevante Felder:
  - `id`: UUID (Primärschlüssel)
  - `user_id`: UUID (Fremdschlüssel zu auth.users)
  - `name`: TEXT (Name des Babys)
  - `baby_gender`: TEXT (Geschlecht des Babys)
  - `birth_date`: TIMESTAMP WITH TIME ZONE (Geburtsdatum)
  - `weight`: TEXT (Geburtsgewicht)
  - `height`: TEXT (Größe bei der Geburt)
  - `photo_url`: TEXT (URL zum Babyfoto)

## Funktionalität

### Daten laden

Die Profil-Seite lädt Daten aus drei verschiedenen Tabellen:

1. **Auth-Daten**: E-Mail-Adresse des Benutzers aus dem Auth-Objekt
2. **Profildaten**: Vorname und Nachname aus der `profiles`-Tabelle
3. **Benutzereinstellungen**: Geburtstermin und Baby-Status aus der `user_settings`-Tabelle
4. **Baby-Informationen**: Name, Geschlecht, Geburtsdatum, Gewicht und Größe aus der `baby_info`-Tabelle

Der Ladevorgang wird in der `loadUserData`-Funktion implementiert, die beim Laden der Komponente aufgerufen wird.

### Daten speichern

Die Profil-Seite ermöglicht das Speichern von Daten in drei verschiedenen Tabellen:

1. **Profildaten**: Aktualisierung oder Erstellung von Vorname und Nachname in der `profiles`-Tabelle
2. **Benutzereinstellungen**: Aktualisierung oder Erstellung von Geburtstermin und Baby-Status in der `user_settings`-Tabelle
3. **Baby-Informationen**: Aktualisierung oder Erstellung von Name, Geschlecht, Geburtsdatum, Gewicht und Größe in der `baby_info`-Tabelle

Der Speichervorgang wird in der `saveUserData`-Funktion implementiert, die beim Klicken auf den "Änderungen speichern"-Button aufgerufen wird. Die Funktion prüft für jede Tabelle, ob bereits ein Eintrag existiert, und führt dann entweder eine Aktualisierung oder eine Erstellung durch.

### Bedingte Anzeige

Die Profil-Seite zeigt bestimmte Felder nur unter bestimmten Bedingungen an:

- **Geburtsdatum, Gewicht und Größe**: Diese Felder werden nur angezeigt, wenn `isBabyBorn` auf `true` gesetzt ist.
- **Name und Geschlecht des Babys**: Diese Felder werden immer angezeigt, unabhängig vom Baby-Status.

### Automatische Aktualisierungen

Die Profil-Seite enthält einige automatische Aktualisierungen:

- Wenn ein Geburtsdatum gesetzt wird, wird `isBabyBorn` automatisch auf `true` gesetzt.
- Wenn `isBabyBorn` auf `false` gesetzt wird, wird das Geburtsdatum zurückgesetzt.

## UI-Komponenten

### Persönliche Daten
- **E-Mail**: Nicht editierbares Textfeld, das die E-Mail-Adresse des Benutzers anzeigt
- **Vorname**: Editierbares Textfeld für den Vornamen des Benutzers
- **Nachname**: Editierbares Textfeld für den Nachnamen des Benutzers

### Baby-Informationen
- **Errechneter Geburtstermin**: Datumsauswahl für den errechneten Geburtstermin
- **Baby bereits geboren?**: Schalter zum Umschalten des Baby-Status
- **Name des Babys**: Editierbares Textfeld für den Namen des Babys
- **Geschlecht**: Auswahl zwischen "Junge" und "Mädchen" mit visueller Hervorhebung der Auswahl
- **Geburtsdatum**: Datumsauswahl für das Geburtsdatum (nur sichtbar, wenn das Baby geboren ist)
- **Geburtsgewicht**: Editierbares Textfeld für das Geburtsgewicht (nur sichtbar, wenn das Baby geboren ist)
- **Größe bei Geburt**: Editierbares Textfeld für die Größe bei der Geburt (nur sichtbar, wenn das Baby geboren ist)

### Aktionen
- **Zurück-Button**: Navigiert zurück zur "Mehr"-Seite
- **Änderungen speichern**: Speichert alle Änderungen in der Datenbank

## Datenfluss

1. **Laden der Daten**:
   - Die Komponente wird geladen und ruft `loadUserData` auf
   - `loadUserData` ruft Daten aus verschiedenen Tabellen ab und setzt den lokalen Zustand

2. **Bearbeiten der Daten**:
   - Der Benutzer bearbeitet die Daten über die UI-Komponenten
   - Die Änderungen werden im lokalen Zustand gespeichert

3. **Speichern der Daten**:
   - Der Benutzer klickt auf "Änderungen speichern"
   - `saveUserData` wird aufgerufen und speichert die Daten in den entsprechenden Tabellen

## Abhängigkeiten

### Komponenten
- `ThemedText` und `ThemedView`: Für themenfähige Text- und View-Komponenten
- `IconSymbol`: Für Icons
- `DateTimePicker`: Für die Datumsauswahl

### Hooks
- `useAuth`: Für den Zugriff auf den Authentifizierungsstatus
- `useBabyStatus`: Für den Zugriff auf den Baby-Status

### API-Funktionen
- `getBabyInfo` und `saveBabyInfo`: Für den Zugriff auf Baby-Informationen
- `supabase`: Für direkten Zugriff auf die Supabase-Datenbank

## Besonderheiten und Einschränkungen

- Die E-Mail-Adresse kann nicht bearbeitet werden, da sie Teil der Authentifizierungsdaten ist.
- Das Geschlecht des Babys kann nur "männlich" oder "weiblich" sein, es gibt keine Option für "unbekannt" oder "andere".
- Gewicht und Größe werden als Text gespeichert, nicht als Zahlen, was die Validierung erschwert.
- Es gibt keine Validierung für die eingegebenen Daten, z.B. für das Format des Gewichts oder der Größe.
- Die Profil-Seite ist nicht mit der Onboarding-Funktion verknüpft, die nach der Registrierung aufgerufen werden sollte.
- Die Profil-Seite prüft, ob ein Eintrag in der `profiles`-Tabelle existiert, und erstellt einen neuen Eintrag, wenn keiner vorhanden ist. Dies verhindert Probleme beim Speichern von Vorname und Nachname.

## Verbesserungsmöglichkeiten

1. **Datenvalidierung**: Hinzufügen von Validierung für Gewicht und Größe, um sicherzustellen, dass sie im richtigen Format eingegeben werden.
2. **Erweiterte Geschlechtsoptionen**: Hinzufügen einer Option für "Weiß noch nicht" oder "Andere" für das Geschlecht des Babys.
3. **Profilbild**: Hinzufügen einer Möglichkeit, ein Profilbild für den Benutzer oder das Baby hochzuladen.
4. **Onboarding-Integration**: Verknüpfung der Profil-Seite mit dem Onboarding-Prozess nach der Registrierung.
5. **Fortschrittsanzeige**: Hinzufügen einer Fortschrittsanzeige, die anzeigt, wie vollständig das Profil ist.
6. **Automatische Speicherung**: Implementierung einer automatischen Speicherung, wenn der Benutzer die Seite verlässt.
7. **Bestätigung vor dem Verlassen**: Hinzufügen einer Bestätigung, wenn der Benutzer die Seite mit ungespeicherten Änderungen verlassen möchte.

## Aktualisierungen

### 2025-04-14: Verbesserung der Profildaten-Speicherung
- Die `saveUserData`-Funktion wurde verbessert, um zu prüfen, ob ein Eintrag in der `profiles`-Tabelle existiert, bevor versucht wird, ihn zu aktualisieren.
- Wenn kein Eintrag existiert, wird automatisch ein neuer erstellt, anstatt zu versuchen, einen nicht existierenden Eintrag zu aktualisieren.
- Diese Änderung behebt ein Problem, bei dem Vorname und Nachname nicht gespeichert wurden, wenn kein Eintrag in der `profiles`-Tabelle existierte.
- Ein EAS Update wurde erstellt, um diese Änderung an bestehende Installationen der App zu verteilen.
