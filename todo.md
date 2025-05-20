# Plan zur Behebung des Problems mit nicht angezeigten verbundenen Benutzern

## Beobachtung und Problemanalyse
1. Die App zeigt "0 verbundene Benutzer gefunden" an, obwohl in der "Accounts verknüpfen"-Ansicht der Benutzer "Jan Test" angezeigt wird
2. Die Datenbank findet 3 geteilte Einträge, aber kann die verbundenen Benutzer nicht korrekt abrufen
3. Die Funktion `getLinkedUsersWithDetails()` scheint keine korrekten Daten zurückzugeben

## Diagnose- und Lösungsschritte

### 1. Überprüfung der `getLinkedUsersWithDetails()` Funktion in lib/sleepData.ts
```typescript
// Debugging-Ausgaben hinzufügen
export async function getLinkedUsersWithDetails(): Promise<{
  success: boolean;
  linkedUsers?: ConnectedUser[];
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      console.log('getLinkedUsersWithDetails: Kein Benutzer angemeldet');
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    console.log('getLinkedUsersWithDetails: Suche verknüpfte Benutzer für', user.user.id);

    // Verwende die neue RPC-Funktion für account_links
    const { data, error } = await supabase.rpc(
      'get_linked_users_with_details',
      { p_user_id: user.user.id }
    );

    console.log('getLinkedUsersWithDetails: Ergebnis', JSON.stringify(data), 'Fehler:', error);

    if (error) {
      console.error('Fehler beim Laden der verknüpften Benutzer:', error);
      return { success: false, error: error.message };
    }

    return { success: true, linkedUsers: data || [] };
  } catch (error) {
    console.error('Fehler beim Laden der verknüpften Benutzer:', error);
    return { success: false, error: String(error) };
  }
}
```

### 2. Überprüfung der RPC-Funktion `get_linked_users_with_details` in der Datenbank
```sql
-- Direkte SQL-Abfrage zur Überprüfung der Benutzerverknüpfung
SELECT * FROM account_links 
WHERE (creator_id = 'AKTUELLE_BENUTZER_ID' OR invited_id = 'AKTUELLE_BENUTZER_ID')
AND status = 'accepted';

-- Überprüfung der RPC-Funktion (muss in der Datenbank existieren)
SELECT pg_get_functiondef('public.get_linked_users_with_details(uuid)'::regprocedure);

-- Überprüfung der Berechtigungen (RLS)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'account_links';
SELECT * FROM pg_policies WHERE tablename = 'account_links';
```

### 3. Implementierung einer alternativen Funktion zum Abrufen verbundener Benutzer
```typescript
// Alternative direktere Implementierung
export async function getLinkedUsersAlternative(): Promise<{
  success: boolean;
  linkedUsers?: ConnectedUser[];
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    // Direkter Zugriff auf die account_links Tabelle
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select(`
        id,
        creator_id,
        invited_id,
        status,
        profiles!creator_profile(display_name),
        profiles!invited_profile(display_name)
      `)
      .or(`creator_id.eq.${user.user.id},invited_id.eq.${user.user.id}`)
      .eq('status', 'accepted');

    if (linksError) {
      console.error('Fehler beim Laden der account_links:', linksError);
      return { success: false, error: linksError.message };
    }

    // Verarbeitung der Ergebnisse
    const linkedUsers: ConnectedUser[] = (links || []).map(link => {
      const isCreator = link.creator_id === user.user.id;
      const partnerId = isCreator ? link.invited_id : link.creator_id;
      const partnerName = isCreator 
        ? link.profiles?.invited_profile?.display_name
        : link.profiles?.creator_profile?.display_name;
      
      return {
        userId: partnerId,
        displayName: partnerName || 'Unbekannter Benutzer',
        linkRole: isCreator ? 'creator' : 'invited'
      };
    });

    return { success: true, linkedUsers };
  } catch (error) {
    console.error('Fehler beim Laden der verknüpften Benutzer:', error);
    return { success: false, error: String(error) };
  }
}
```

### 4. Korrektur der Benutzerverknüpfungsdatenbank

1. Überprüfung, ob die Relation der Tabellen korrekt ist
2. Sicherstellen, dass die Row-Level-Security die passenden Berechtigungen hat
3. Aktualisierung der RPC-Funktion mit verbesserter Fehlerbehandlung

```sql
-- Überprüfung der account_links Tabelle
SELECT * FROM account_links LIMIT 10;

-- Aktualisieren der RPC-Funktion
CREATE OR REPLACE FUNCTION get_linked_users_with_details(p_user_id UUID)
RETURNS SETOF JSONB AS $$
BEGIN
  RETURN QUERY
  SELECT
    jsonb_build_object(
      'userId', CASE
                 WHEN al.creator_id = p_user_id THEN al.invited_id
                 ELSE al.creator_id
               END,
      'displayName', COALESCE(p.display_name, 'Unbekannter Benutzer'),
      'linkRole', CASE
                   WHEN al.creator_id = p_user_id THEN 'creator'
                   ELSE 'invited'
                 END
    )
  FROM account_links al
  LEFT JOIN profiles p ON (
    CASE
      WHEN al.creator_id = p_user_id THEN p.id = al.invited_id
      ELSE p.id = al.creator_id
    END
  )
  WHERE (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. Temporäre Lösung für die Benutzeroberfläche
- Implementierung eines Debug-Buttons, der direkt verbundene Benutzer anzeigt
- Ergänzung der UI mit Hartcodierten IDs für Testzwecke

## Aktuelle Probleme mit der Partner-Funktionalität

## Implementierte Verbesserungen (Stand: 15.05.2025)
1. ✅ `shareSleepEntry`-Funktion wurde aktualisiert:
   - Verhindert nun das Teilen von Einträgen mit sich selbst
   - Prüft, ob der Partner tatsächlich verbunden ist
   - Verbesserte Fehlerbehandlung
2. ✅ SQL-Funktion `share_sleep_entry` wurde aktualisiert:
   - Verhindert Selbst-Teilen durch Prüfung der Benutzer-IDs
   - Überprüft die Verbindung zwischen den Benutzern
   - Verbesserte Fehlerbehandlung
3. ✅ `handleShareSleepEntry` und `handleUnshareSleepEntry` wurden verbessert:
   - Laden nun die Daten nach dem Teilen/Freigeben neu
   - Bessere Benutzerfeedbacks
4. ✅ UI-Verbesserungen:
   - Fehlende Funktionen `toggleExpandedView` und `syncSleepEntries` implementiert
   - Debugging-Funktionen zum Überprüfen von Verbindungen hinzugefügt

## Verbleibende Probleme (Stand: 15.05.2025)
1. ❌ TypeScript-Fehler in sleep-tracker.tsx:
   - Probleme mit dem Ende-Datum (`end_time`) im SleepEntry-Interface
   - Probleme mit dem Zuweisen von `undefined` an `string | null`-Typen
2. ❌ UI/UX Probleme:
   - "0 verbundene Benutzer gefunden" trotz verknüpfter Accounts
   - Shared Entries werden manchmal nicht korrekt angezeigt
3. ❌ Logik-Probleme:
   - Einige Einträge könnten immer noch mit der eigenen Benutzer-ID geteilt werden

## Nächste Schritte

### 1. Korrekturen für TypeScript-Fehler
```typescript
// In der Funktion checkForActiveEntry und handleStartSleepTracking:
// Statt:
setCurrentEntry({
  ...result.activeEntry,
  start_time: new Date(result.activeEntry.start_time)
});
setActiveEntryId(result.activeEntry.id);

// Verwenden:
if (result.activeEntry?.id) {
  setCurrentEntry({
    ...result.activeEntry,
    start_time: new Date(result.activeEntry.start_time),
    end_time: result.activeEntry.end_time ? new Date(result.activeEntry.end_time) : null
  });
  setActiveEntryId(result.activeEntry.id);
}
```

### 2. Verbesserung der Benutzerverknüpfung
- Direkten Zugriff auf die `account_links`-Tabelle implementieren
- SQL-Abfrage überprüfen und aktualisieren
- Lese-Berechtigungen für `account_links` überprüfen

### 3. Korrektur von selbst-geteilten Einträgen
- SQL-Skript zur Identifizierung und Korrektur von selbst-geteilten Einträgen:
```sql
-- Finde selbst-geteilte Einträge
SELECT * FROM sleep_entries
WHERE user_id = shared_with_user_id
AND shared_with_user_id IS NOT NULL;

-- Korrigiere selbst-geteilte Einträge
UPDATE sleep_entries
SET shared_with_user_id = NULL
WHERE user_id = shared_with_user_id
AND shared_with_user_id IS NOT NULL;
```

### 4. Manuelle Tests für Partnerfunktionen
Ausführlicher Testplan:
1. Verknüpfe zwei Test-Benutzerkonten
2. Erstelle Einträge mit Benutzer A
3. Teile Einträge mit Benutzer B
4. Prüfe, ob Benutzer B die geteilten Einträge sieht
5. Bearbeite geteilte Einträge mit beiden Benutzern
6. Teste das Aufheben der Freigabe

## Identifizierte Probleme (Stand: 15.05.2025)
1. ❌ Einige Einträge werden mit der eigenen Benutzer-ID geteilt (Selbst-Teilen):
   - Einträge cf062b8b, ee57ae64, fbc0904c haben user_id = shared_with_user_id
2. ❌ Die Anzeige zeigt "0 verbundene Benutzer gefunden", obwohl Accounts verknüpft sind
3. ❌ Geteilte Einträge werden nicht konsistent bei Partnern angezeigt
4. ❌ TypeScript-Fehler bezüglich der shared_with_user_id Eigenschaft
5. ❌ Funktionen wie syncSleepEntries und toggleExpandedView werden referenziert, existieren aber nicht

## Sofortiger Aktionsplan

1. **Benutzerverknüpfung reparieren**:
   - Die Funktion `getLinkedUsersWithDetails` überprüfen und sicherstellen, dass sie korrekte Daten zurückgibt
   - Benutzerverknüpfungs-Datenbank prüfen, um sicherzustellen, dass Beziehungen korrekt gespeichert werden
   - Füge bessere Debug-Ausgaben zur Diagnostik hinzu

2. **Teilen-Funktionalität korrigieren**:
   - Die `shareSleepEntry`-Funktion prüfen und aktualisieren, um das Selbst-Teilen zu verhindern
   - Die SQL-Funktionen überprüfen, um sicherzustellen, dass die Partner-ID korrekt validiert wird
   - Implementiere eine Prüfung, um sicherzustellen, dass shared_with_user_id ≠ user_id

3. **TypeScript-Definitionen aktualisieren**:
   - Die SleepEntry-Schnittstelle in sleep-tracker.tsx aktualisieren, um shared_with_user_id einzuschließen
   - Fehlende Funktionen wie syncSleepEntries implementieren oder entfernen
   - Implementiere toggleExpandedView oder entferne Verweise darauf

4. **UI-Verbesserungen**:
   - Verbessere die Benutzeroberfläche zur Auswahl von Partnern beim Teilen
   - Füge klare visuelle Indikatoren für geteilte Einträge hinzu
   - Implementiere bessere Fehlerbehandlung und Benutzerrückmeldung

## Schrittweise Implementierung

### Schritt 1: TypeScript-Definitionen korrigieren
```typescript
// In sleep-tracker.tsx SleepEntry-Interface aktualisieren
interface SleepEntry {
  // Vorhandene Eigenschaften...
  shared_with_user_id?: string | null; // ID des Benutzers, mit dem der Eintrag geteilt wird
}

// Fehlende Funktion implementieren oder entfernen
const toggleExpandedView = (entryId: string) => {
  setSleepEntries(prevEntries => prevEntries.map(entry => ({
    ...entry,
    isExpanded: entry.id === entryId ? !entry.isExpanded : entry.isExpanded
  })));
};
```

### Schritt 2: Teilen-Funktionalität verbessern
```typescript
// Verbesserte shareSleepEntry-Funktion
export async function shareSleepEntry(entryId: string, partnerId: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }
    
    // Prüfen, ob Benutzer versucht, mit sich selbst zu teilen
    if (partnerId === userData.user.id) {
      return { success: false, error: 'Du kannst Einträge nicht mit dir selbst teilen' };
    }

    console.log(`shareSleepEntry: Teile Eintrag ${entryId} mit Benutzer ${partnerId}`);
    
    // Rest der Funktion...
  } catch (error) {
    // ...
  }
}
```

### Schritt 3: Debug-Funktionalität erweitern
```typescript
const debugCheckConnections = async () => {
  try {
    // Verbundene Benutzer abrufen und im Detail ausgeben
    const { linkedUsers } = await getLinkedUsersWithDetails();
    console.log('Verbundene Benutzer:', JSON.stringify(linkedUsers, null, 2));
    
    // Anzeige der IDs zum einfachen Vergleich
    if (linkedUsers && linkedUsers.length > 0) {
      alert(`${linkedUsers.length} verbundene Benutzer gefunden:\n${
        linkedUsers.map(u => `${u.displayName}: ${u.userId}`).join('\n')
      }`);
    } else {
      alert('Keine verbundenen Benutzer gefunden');
    }
  } catch (error) {
    console.error('Fehler beim Prüfen der Verbindungen:', error);
    alert(`Fehler: ${error}`);
  }
};
```

# Aktueller Plan zur Behebung der Probleme mit Partner-Einträgen

## Probleme identifiziert
1. Die Spalte `shared_with_user_id` existiert jetzt in der Datenbank ✅
2. Es gibt bereits einen geteilten Eintrag in der Datenbank (id `cf062b8b-f979-427d-b961-9d775b6be1fc`) ✅
3. Die geteilten Einträge werden jedoch nicht bei den verbundenen Partnern angezeigt ❌
4. Einige Einträge werden momentan mit der gleichen Benutzer-ID geteilt, was nicht korrekt ist

## Lösungsplan

### 1. Korrektur von `loadSleepEntries` Funktion
- Die aktuelle Implementierung hat Probleme bei der Abfrage geteilter Einträge
- Die Abfrage für geteilte Einträge wird in einem separaten Try-Block ausgeführt, was Fehler maskieren kann
- Bei der Abfrage nach `shared_with_user_id` werden möglicherweise nicht alle relevanten Einträge erfasst

### 2. Verbesserte UI-Anzeige für geteilte Einträge
- Sicherstellen, dass geteilte Einträge klar als solche erkennbar sind
- Die `isShared` und `creatorName` Eigenschaften werden nicht immer korrekt gesetzt
- Visuelle Unterscheidung verbessern, um zu zeigen, welcher Partner einen Eintrag geteilt hat

### 3. Funktion zum Teilen von Einträgen korrigieren
- Die RPC-Funktion `share_sleep_entry` wird aufgerufen, aber es scheint Probleme zu geben
- Sicherstellen, dass die IDs der Partner korrekt übergeben werden
- Einträge werden momentan teilweise mit der eigenen ID geteilt, was nutzlos ist

### 4. Unterstützung für Partner-Aktionen hinzufügen
- Klare UI-Elemente zum Teilen/Freigeben von Einträgen bereitstellen
- Berechtigungsprüfungen bei allen Aktionen (Ändern, Löschen usw.) implementieren

### 5. Debug-Funktionen verbessern
- Ergänzung der Debug-Funktion, um direkt Einträge mit einem ausgewählten Partner zu teilen
- Bessere Fehlerbehandlung und Protokollierung beim Teilen/Anzeigen geteilter Einträge

## Sofortige Maßnahmen
1. Korrektur von `loadSleepEntries` zur korrekten Abfrage geteilter Einträge
2. Hinzufügen einer einfachen UI zum expliziten Teilen von Einträgen
3. Überprüfen und Korrigieren der Freigabelogik in `shareSleepEntry`

# Todo-Liste für Schlafeinträge-Problem

## Aktuelle Fortschritte
- ✅ Der Fehler mit der nicht existierenden Spalte `shared_with_user_id` wurde behoben
- ✅ Eigene Schlafeinträge werden jetzt angezeigt 

## Neue Anforderungen

1. Partner-Einträge anzeigen
   - Datenmodell erweitern, um Einträge zwischen Partnern zu teilen
   - Zwei Optionen:
     a) Neue Spalte `shared_with_user_id` zur Tabelle `sleep_entries` hinzufügen
     b) Neue Verknüpfungstabelle `sleep_entry_shares` erstellen (user_id, entry_id)
   - Abfragen anpassen, um auch Partner-Einträge zu laden
   - UI-Darstellung für Partner-Einträge verbessern

2. Gemeinsame Schlaf-Tracking-Funktionalität
   - Einträge sollen von beiden Partnern steuerbar sein
   - Start/Stopp-Funktionen erweitern, um mit fremden Einträgen zu arbeiten
   - Berechtigungssystem implementieren
   - Echtzeit-Updates für gemeinsame Aktionen

3. Robustere Implementierung
   - Weitere Fehlerbehandlung bei allen API-Aufrufen
   - Fallback-Mechanismen für Offline-Betrieb
   - Status-Indikator für Synchronisierung

## Problemdiagnose

1. Datenbanktabelle und Struktur überprüfen
   - Überprüfe ob die `sleep_entries` Tabelle korrekte Einträge enthält
   - Stelle sicher, dass das Schema mit der Interface-Definition übereinstimmt

2. Datenladelogik korrigieren
   - Die RPC-Funktion umgehen und direkte Datenbankabfrage verwenden
   - SQL-Query optimieren mit korrektem Filter
   - Fehlerbehandlung verbessern
   - Debugging-Ausgaben für die Datenladeresultate

3. Datentransformation und Gruppierung verbessern
   - Überarbeite die `groupEntriesByDate`-Funktion für bessere Fehlerbehandlung
   - Stelle sicher, dass das Datum korrekt geparst wird
   - Debugging-Ausgaben für die gruppierten Daten

4. Rendering-Logik korrigieren
   - Überprüfe den `renderDateGroup`-Aufruf und die Parameter
   - Füge Fallbacks für leere Daten hinzu
   - Füge deutlichere Debugging-Ausgaben hinzu

5. UI-State-Management
   - Stelle sicher, dass der State nach dem Laden korrekt aktualisiert wird
   - Füge einen Lade-Indikator hinzu

## Implementierungsdetails

1. Datenbank-Schema erweitern:
   ```sql
   -- Option A: Spalte hinzufügen
   ALTER TABLE sleep_entries ADD COLUMN shared_with_user_id UUID REFERENCES auth.users(id);
   
   -- ODER Option B: Verknüpfungstabelle
   CREATE TABLE sleep_entry_shares (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     entry_id UUID REFERENCES sleep_entries(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     can_edit BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. Erweiterte Abfrage für alle sichtbaren Einträge:
   ```typescript
   // Mit Option A (neue Spalte)
   const { data, error } = await supabase
     .from('sleep_entries')
     .select('*')
     .or(`user_id.eq.${user.id},shared_with_user_id.eq.${user.id}`)
     .order('start_time', { ascending: false });
   
   // Mit Option B (Verknüpfungstabelle)
   const { data, error } = await supabase
     .from('sleep_entries')
     .select(`
       *,
       sleep_entry_shares!inner (
         user_id
       )
     `)
     .or(`user_id.eq.${user.id},sleep_entry_shares.user_id.eq.${user.id}`)
     .order('start_time', { ascending: false });
   ```

3. Start/Stopp-Funktionen erweitern:
   ```typescript
   // Erweiterte Funktionssignatur mit optionalem Eintrag
   export async function startSleepTracking(
     userId?: string, // Optional: ID des Benutzers, für den der Eintrag gestartet wird
     options?: { sharedWith?: string[] } // Optionen für Freigabe
   ): Promise<{...}>;
   
   export async function stopSleepTracking(
     entryId: string,
     quality: SleepQuality = null,
     notes?: string,
     userId?: string // Optional: ID des Benutzers, der den Eintrag erstellt hat
   ): Promise<{...}>;
   ```

4. Verbesserte Gruppierungsfunktion:
   ```typescript
   const groupEntriesByDate = (entries: SleepSession[]): Record<string, SleepSession[]> => {
     console.log(`Gruppiere ${entries.length} Einträge`);
     // Implementierung...
   }
   ```

5. Verbesserte Rendering-Logik:
   ```typescript
   {Object.keys(groupedEntries).length > 0 ? (
     Object.keys(groupedEntries)
       .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
       .map(date => {
         console.log(`Rendere Datum: ${date}`);
         return renderDateGroup(date, groupedEntries[date]);
       })
   ) : (
     <LoadingIndicator />
   )}
   ```

6. Fallback für fehlende Daten:
   ```typescript
   renderDateGroup = (date: string, entries: SleepSession[] = []) => {
     // Implementierung mit Nullchecks
   }
   ``` 