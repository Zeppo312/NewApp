# Anleitung zur Integration des neuen Sharing-Systems

## Überblick
Diese Anleitung beschreibt, wie du das neue System zum Teilen von Schlafeinträgen in die App integrierst. 
Das neue System verwendet eine dedizierte Tabelle (`sleep_entry_shares`) statt der vorhandenen `shared_with_user_id`-Spalte.

## 1. Datenbank-Setup

Führe den SQL-Code in `create_sleep_entry_shares_table.sql` in deiner Supabase-Datenbank aus.
Dies erstellt:
- Die neue Tabelle `sleep_entry_shares`
- Die notwendigen Berechtigungen
- Funktionen zum Teilen und Aufheben der Freigabe
- Eine Funktion zum Laden aller sichtbaren Einträge

```
# Im Supabase SQL Editor
# Kopiere den gesamten Inhalt von create_sleep_entry_shares_table.sql und führe ihn aus
```

**Hinweis:** Das SQL-Skript ist so gestaltet, dass du es mehrfach ausführen kannst. Es prüft, ob Objekte bereits existieren, und löscht sie bei Bedarf, bevor es sie neu erstellt. Dies ist nützlich für Updates oder wenn die erste Ausführung Fehler hatte.

## 2. TypeScript-Integration

1. Verwende die neuen Funktionen aus `lib/sleepSharing.ts`:

```typescript
// Importiere die neuen Funktionen
import { 
  loadAllVisibleSleepEntries, 
  shareEntryWithPartner, 
  unshareEntry 
} from 'lib/sleepSharing';

// In deiner Komponente:

// Alle sichtbaren Einträge laden (eigene + geteilte)
async function loadEntries() {
  const { success, entries, error } = await loadAllVisibleSleepEntries();
  if (success) {
    setSleepEntries(entries);
  } else {
    console.error('Fehler beim Laden der Einträge:', error);
  }
}

// Eintrag mit einem Partner teilen
async function handleShareEntry(entryId, partnerId) {
  const { success, message, error } = await shareEntryWithPartner(entryId, partnerId);
  if (success) {
    // Erfolg anzeigen, Daten neu laden
    alert(message);
    loadEntries();
  } else {
    alert('Fehler: ' + error);
  }
}

// Freigabe eines Eintrags aufheben
async function handleUnshareEntry(entryId, partnerId = null) {
  const { success, message, error } = await unshareEntry(entryId, partnerId);
  if (success) {
    // Erfolg anzeigen, Daten neu laden
    alert(message);
    loadEntries();
  } else {
    alert('Fehler: ' + error);
  }
}
```

## 3. Migration vorhandener Daten

Um vorhandene geteilte Einträge zu migrieren:

```typescript
import { migrateSharedEntries } from 'lib/sleepSharing';

async function migrateExistingSharedEntries() {
  const { success, result, error } = await migrateSharedEntries();
  if (success) {
    console.log('Migration abgeschlossen:', result);
    alert(`${result.migrated} Einträge wurden migriert!`);
  } else {
    console.error('Fehler bei der Migration:', error);
  }
}

// Im Admin-Bereich oder bei der App-Initialisierung aufrufen
migrateExistingSharedEntries();
```

## 4. UI-Anpassungen

1. Erstelle eine Dropdown-Komponente für die Partnerauswahl:

```jsx
function PartnerSelector({ onSelect }) {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    async function loadPartners() {
      const { success, linkedUsers } = await loadConnectedUsers(true); // Alternative Methode verwenden
      if (success && linkedUsers) {
        setPartners(linkedUsers);
      }
    }
    loadPartners();
  }, []);

  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      <option value="">Partner auswählen...</option>
      {partners.map(partner => (
        <option key={partner.userId} value={partner.userId}>{partner.displayName}</option>
      ))}
    </select>
  );
}
```

2. Füge Schaltflächen zum Teilen/Freigeben hinzu:

```jsx
function ShareButton({ entry }) {
  const [showSelector, setShowSelector] = useState(false);
  
  const handleShare = async (partnerId) => {
    await shareEntryWithPartner(entry.id, partnerId);
    setShowSelector(false);
    // Daten neu laden
  };
  
  return (
    <div>
      <button onClick={() => setShowSelector(!showSelector)}>
        {entry.shared_with_user_id ? 'Freigabe ändern' : 'Teilen'}
      </button>
      
      {showSelector && (
        <div className="partner-selector">
          <PartnerSelector onSelect={handleShare} />
          {entry.shared_with_user_id && (
            <button onClick={() => unshareEntry(entry.id)}>
              Freigabe aufheben
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

## 5. Fehlerbehandlung

Die neuen Funktionen haben eingebaute Fallbacks, wenn die neue Tabelle noch nicht existiert:

1. `loadAllVisibleSleepEntries()` fällt auf direkte Abfragen zurück
2. `shareEntryWithPartner()` und `unshareEntry()` fallen auf die alte `shared_with_user_id`-Methode zurück

## Vorteile des neuen Systems

1. **Sicherheit**: Strikte Berechtigungsprüfungen verhindern unbefugten Zugriff
2. **Skalierbarkeit**: Ein Eintrag kann mit mehreren Personen geteilt werden 
3. **Robustheit**: Selbst-Teilen wird automatisch verhindert
4. **Fallback**: Funktioniert auch mit der alten Methode für Abwärtskompatibilität 