# Implementierung der Schlaftracking-Synchronisierung

Diese Dokumentation beschreibt die Implementierung der bidirektionalen Synchronisierung von Schlaftracking-Daten zwischen verbundenen Benutzern.

## Überblick

Sobald zwei Nutzer über `account_links` miteinander verknüpft sind, werden ihre Einträge in `baby_sleep_tracking` automatisch synchronisiert. Jede Änderung (Hinzufügen, Aktualisieren, Löschen) wird zwischen den verbundenen Benutzern geteilt, so dass beide immer die gleichen Daten sehen.

Die Synchronisierung erfolgt transaktional und atomar durch eine PostgreSQL Stored Procedure.

## Datenbankschema-Erweiterung

Die Tabelle `baby_sleep_tracking` wurde um folgende Spalten erweitert:

- `external_id UUID`: Speichert die Original-ID des Eintrags für die Synchronisierung
- `synced_from UUID`: Referenziert den Benutzer, von dem der Eintrag ursprünglich stammt
- `synced_at TIMESTAMPTZ`: Zeitstempel der letzten Synchronisierung

Zusätzlich wurden folgende Indizes erstellt:

- `idx_baby_sleep_tracking_external_id` auf `external_id`
- `idx_baby_sleep_tracking_synced_from` auf `synced_from`
- `idx_baby_sleep_tracking_user_id_external_id` auf `(user_id, external_id)`

Um Datenkonsistenz zu gewährleisten, wurde ein Constraint hinzugefügt:

- `unique_external_id_user_id`: Stellt sicher, dass die Kombination aus `external_id` und `user_id` eindeutig ist

## Anwendung der Schemaänderungen

Die SQL-Skripte für die Schemaänderungen befinden sich im `sql/`-Verzeichnis:

1. `baby_sleep_tracking_schema_update.sql`: Fügt die neuen Spalten und Indizes hinzu
2. `sync_sleep_entries.sql`: Implementiert die RPC-Funktion zur Synchronisierung

Diese können wie folgt angewendet werden:

```bash
psql -h <host> -U <user> -d <database> -f sql/baby_sleep_tracking_schema_update.sql
psql -h <host> -U <user> -d <database> -f sql/sync_sleep_entries.sql
```

Alternativ können die Skripte über die Supabase SQL-Editorfunktion ausgeführt werden.

## RPC-Funktion zur Synchronisierung

Die `sync_sleep_entries(user_uuid UUID)` Funktion:

1. Findet den verbundenen Benutzer in der `account_links`-Tabelle
2. Lädt alle Einträge von beiden Benutzern
3. Vereint sie zu einer Menge eindeutiger Datensätze (basierend auf `external_id`)
4. Löscht alle bestehenden Einträge beider Benutzer
5. Fügt die vereinigten Einträge für beide Benutzer wieder ein
6. Aktualisiert `account_links.last_synced_at`
7. Gibt `{ success: true, synced_count: N }` zurück

Die Funktion arbeitet in einer Transaktion, die nur im Erfolgsfall commitet wird.

## Client-Integration

Die TypeScript-Funktion `syncSleepData` wurde aktualisiert, um die neue RPC-Funktion zu verwenden:

```typescript
const { data, error } = await supabase.rpc('sync_sleep_entries', { 
  user_uuid: userId 
});
```

Die UI-Komponente wurde ebenfalls angepasst, um Daten nur für den aktuellen Benutzer zu laden:

```typescript
const { data, error } = await supabase
  .from('baby_sleep_tracking')
  .select('*')
  .eq('user_id', user.id)
  .order('start_time', { ascending: false });
```

Bei Operationen wie dem Hinzufügen, Aktualisieren oder Löschen eines Schlafeintrags wird die Synchronisierung automatisch ausgelöst.

## Sicherheit und Zugriffsrechte

Die RPC-Funktion verwendet `SECURITY DEFINER`, was bedeutet, dass sie mit den Rechten des Erstellers und nicht des Aufrufers läuft. Dies ermöglicht die Synchronisierung der Daten, auch wenn der Benutzer normalerweise nur Zugriff auf seine eigenen Daten hat.

## Automatische Synchronisierung

Die Synchronisierung wird in folgenden Situationen ausgelöst:

1. Beim Laden der App
2. Nach dem Hinzufügen eines neuen Eintrags
3. Nach dem Aktualisieren eines bestehenden Eintrags
4. Nach dem Löschen eines Eintrags
5. Manuell durch den Benutzer über die UI

## Fehlerbehandlung

Bei Fehlern während der Synchronisierung werden diese im Client protokolliert und dem Benutzer angezeigt. Die Funktion speichert auch den Synchronisierungsstatus lokal, damit die UI entsprechend aktualisiert werden kann.

## Migration bestehender Daten

Beim ersten Ausführen der Synchronisierung werden bestehende Einträge automatisch mit der UUID des ursprünglichen Eintrags als `external_id` markiert. Dies gewährleistet, dass keine Duplikate entstehen.

## Nächste Schritte

1. Monitoring der Synchronisierungsleistung und -zuverlässigkeit
2. Implementierung eines Konfliktlösungsmechanismus für den unwahrscheinlichen Fall von Konflikten
3. Erweiterung des Ansatzes auf weitere Datentypen (z.B. Windelwechsel, Mahlzeiten) 