# Schlaftracker-Synchronisierung Fix

Diese Lösung behebt das Problem der Schlafdatensynchronisierung in der Baby-Tracking-App.

## Problem

Der Schlaftracker konnte keine Daten zwischen verbundenen Benutzern synchronisieren. Es kam zu folgenden Fehlern:
- "Error finding linked user: column 'source_user_id' does not exist"
- "No active connected user found for user ID"

Obwohl die UI "Verbunden mit Lotti" anzeigte, schlug die Synchronisierung fehl.

## Ursache

Das Problem lag darin, dass der ursprüngliche Code nach Verbindungen in einer `account_links`-Tabelle suchte, aber stattdessen eine `user_connections`-Tabelle verwendet wurde. Zusätzlich wurden nur "active" Verbindungen berücksichtigt, obwohl möglicherweise "pending" Verbindungen im UI angezeigt wurden.

## Lösung

Die Lösung besteht aus einem neuen Synchronisierungsansatz, der dem der Daily Entries und des Wehentrackers folgt:

1. Eine neue SQL-Funktion `sync_sleep_entries_one_way`, die:
   - Die Rolle des Benutzers als Einlader oder Eingeladener bestimmt
   - Bei Einladern: Kopiert Daten vom Einlader zum Eingeladenen
   - Bei Eingeladenen: Kopiert Daten vom Einlader zum Eingeladenen
   - Automatisch "pending" Verbindungen aktiviert, wenn keine aktiven vorhanden sind

2. Anpassungen im Client-Code:
   - Verwendung der neuen `sync_sleep_entries_one_way`-Funktion statt der alten
   - Verbesserte Fehlerbehandlung und Diagnose
   - Anzeige der Synchronisierungsrichtung an den Benutzer

## Anwendung der Lösung

### 1. SQL-Funktion auf den Server hochladen

Du hast zwei Möglichkeiten:

#### Option A: Manuelle Installation über die Supabase SQL-Konsole

1. Logge dich in dein Supabase-Dashboard ein
2. Gehe zum SQL-Editor
3. Kopiere den Inhalt der Datei `sql/sync_sleep_entries_one_way.sql`
4. Führe die SQL-Anweisungen aus

#### Option B: Automatische Installation per Skript

1. Installiere die Abhängigkeiten:
   ```
   npm install @supabase/supabase-js
   ```

2. Setze die Umgebungsvariablen:
   ```
   SUPABASE_URL=https://dein-projekt.supabase.co
   SUPABASE_SERVICE_KEY=dein-service-key
   ```

3. Führe das Deployment-Skript aus:
   ```
   node deploy_sync_fix.js
   ```

### 2. Aktualisiere die App

Die Änderungen in `lib/syncSleepData.ts` und `app/(tabs)/sleep-tracker.tsx` müssen in deine App übernommen werden.

### 3. Teste die Lösung

1. Verbinde zwei Benutzerkonten miteinander
2. Erstelle Schlafeinträge bei beiden Benutzern
3. Führe eine manuelle Synchronisierung durch
4. Überprüfe, ob die Daten korrekt synchronisiert wurden (der Einladende hat Priorität)

## Unterschied zum alten Ansatz

Der alte Ansatz versuchte, Daten von beiden Benutzern zusammenzuführen, was zu Komplexität und Fehlern führte. Der neue Ansatz folgt dem Prinzip "Einladender hat Priorität", was einfacher und robuster ist:

- Wenn Benutzer A Benutzer B eingeladen hat:
  - Benutzer A's Daten überschreiben immer Benutzer B's Daten
  - Benutzer B kann keine eigenen Daten behalten, außer sie wurden von Benutzer A synchronisiert

Dieser Ansatz wird bereits erfolgreich in anderen Teilen der App (Daily Entries und Wehentracker) verwendet.

## Debug-Informationen

Bei Problemen kannst du die Debug-Informationen in der Supabase SQL-Konsole prüfen:

```sql
SELECT * FROM 
  (SELECT query, 
          json_build_object('timestamp', now(), 
                           'args', args, 
                           'result', result) as details
   FROM _http.request 
   WHERE path LIKE '%rpc/sync_sleep_entries%'
   ORDER BY request_id DESC 
   LIMIT 5) as recent_requests;
``` 