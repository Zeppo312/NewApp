# EAS Update für die Synchronisierungsfunktionalität

Nach den Änderungen an der Synchronisierungsfunktionalität für die Alltag-Einträge sollte ein EAS Update erstellt werden, um die Änderungen an die Benutzer zu verteilen, ohne einen vollständigen App Store-Release durchführen zu müssen.

## Voraussetzungen

1. Stellen Sie sicher, dass die EAS CLI installiert ist:
   ```bash
   npm install -g eas-cli
   ```

2. Stellen Sie sicher, dass Sie bei EAS angemeldet sind:
   ```bash
   eas login
   ```

3. Stellen Sie sicher, dass Ihre `eas.json` korrekt konfiguriert ist.

## Schritte zum Erstellen eines EAS Updates

1. **Führen Sie die SQL-Migration in Supabase aus**

   Führen Sie die SQL-Migration `20250521000000_fix_daily_entries_sync_and_rls.sql` in der Supabase SQL-Konsole aus, um die Änderungen an den RLS-Policies und Synchronisierungsfunktionen zu übernehmen.

2. **Aktualisieren Sie die App-Version (optional)**

   Wenn Sie die App-Version in `app.json` oder `app.config.js` verfolgen, können Sie die Patch-Version erhöhen:

   ```json
   {
     "expo": {
       "version": "1.2.3", // Ändern Sie zu "1.2.4" oder entsprechend
       ...
     }
   }
   ```

3. **Erstellen Sie ein EAS Update**

   Führen Sie den folgenden Befehl aus, um ein EAS Update für alle Plattformen zu erstellen:

   ```bash
   eas update --auto
   ```

   Oder für spezifische Plattformen:

   ```bash
   # Nur für iOS
   eas update --platform ios --auto

   # Nur für Android
   eas update --platform android --auto
   ```

4. **Fügen Sie eine Beschreibung hinzu (empfohlen)**

   Es ist hilfreich, eine Beschreibung der Änderungen hinzuzufügen:

   ```bash
   eas update --auto --message "Fix: Synchronisierung von Alltag-Einträgen zwischen verbundenen Benutzern"
   ```

5. **Überprüfen Sie den Update-Status**

   Nach dem Erstellen des Updates können Sie den Status in der Expo-Webkonsole überprüfen oder mit dem folgenden Befehl:

   ```bash
   eas update:list
   ```

## Testen des Updates

1. Stellen Sie sicher, dass Ihre App so konfiguriert ist, dass sie automatisch nach Updates sucht (dies sollte standardmäßig der Fall sein, wenn Sie EAS Update verwenden).

2. Öffnen Sie die App auf einem Testgerät und überprüfen Sie, ob das Update angewendet wurde.

3. Testen Sie die Synchronisierungsfunktionalität:
   - Erstellen Sie einen neuen Eintrag als eingeladener Benutzer
   - Überprüfen Sie, ob der Eintrag beim einladenden Benutzer erscheint
   - Erstellen Sie einen neuen Eintrag als einladender Benutzer
   - Überprüfen Sie, ob der Eintrag beim eingeladenen Benutzer erscheint

## Rollback (falls erforderlich)

Falls Probleme auftreten, können Sie zu einer früheren Version zurückkehren:

```bash
eas update:rollback
```

Oder eine spezifische Version auswählen:

```bash
eas update:list
eas update:rollback --id UPDATE_ID
```

## Hinweise

- EAS Updates können nur JavaScript/TypeScript-Code und Assets aktualisieren, keine nativen Änderungen.
- Die SQL-Migration muss separat auf der Supabase-Datenbank ausgeführt werden.
- Stellen Sie sicher, dass Ihre App die neueste Version der Supabase-Bibliothek verwendet, um von den neuen Funktionen zu profitieren.
