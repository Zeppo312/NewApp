# Supabase-Einrichtung für Wehen-Tracker App

Diese Anleitung führt Sie durch die Einrichtung von Supabase für die Wehen-Tracker App.

## 1. Supabase-Projekt erstellen

1. Besuchen Sie [Supabase](https://supabase.com/) und melden Sie sich an oder erstellen Sie ein Konto.
2. Klicken Sie auf "New Project" und wählen Sie eine Organisation aus oder erstellen Sie eine neue.
3. Geben Sie einen Projektnamen ein (z.B. "wehen-tracker").
4. Wählen Sie ein sicheres Datenbankpasswort.
5. Wählen Sie eine Region in Ihrer Nähe.
6. Klicken Sie auf "Create new project".

## 2. Datenbank-Schema einrichten

1. Warten Sie, bis Ihr Projekt erstellt wurde.
2. Gehen Sie zum "SQL Editor" in der Seitenleiste.
3. Klicken Sie auf "New Query".
4. Kopieren Sie den Inhalt der Datei `supabase/schema.sql` in den Editor.
5. Klicken Sie auf "Run" oder drücken Sie Strg+Enter, um das SQL-Skript auszuführen.

## 3. Authentifizierung konfigurieren

### E-Mail-Authentifizierung

1. Gehen Sie zu "Authentication" > "Providers" in der Seitenleiste.
2. Stellen Sie sicher, dass "Email" aktiviert ist.
3. Unter "Authentication" > "Email Templates":
   - Passen Sie die E-Mail-Vorlagen nach Bedarf an.

#### E-Mail-Bestätigung konfigurieren

1. Gehen Sie zu "Authentication" > "Settings" in der Seitenleiste.
2. Unter "Email Auth" können Sie die E-Mail-Bestätigung konfigurieren:
   - **Enable email confirmations**: Aktivieren Sie diese Option, wenn Benutzer ihre E-Mail-Adresse bestätigen müssen.
   - **Confirmation URL**: Setzen Sie diese auf die URL Ihrer App, z.B. `https://ihre-app.com/auth/callback`.
   - Für die Entwicklung können Sie die E-Mail-Bestätigung deaktivieren, um den Anmeldeprozess zu vereinfachen.

3. Wenn Sie die E-Mail-Bestätigung aktiviert haben, müssen Sie eine Callback-Route in Ihrer App einrichten:
   - Erstellen Sie eine Datei `app/auth/callback.tsx` mit dem folgenden Inhalt:

```tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Callback() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Verarbeiten des Auth-Callbacks
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Zur Hauptapp navigieren
        router.replace('/(tabs)');
      }
    });
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Bestätigung wird verarbeitet...</Text>
    </View>
  );
}
```

### Telefon-Authentifizierung

1. Gehen Sie zu "Authentication" > "Providers" in der Seitenleiste.
2. Aktivieren Sie "Phone".
3. Für die Produktion müssen Sie einen SMS-Provider wie Twilio einrichten.
   - Klicken Sie auf "Phone" und folgen Sie den Anweisungen zur Einrichtung von Twilio.

### Social Logins

1. Gehen Sie zu "Authentication" > "Providers" in der Seitenleiste.
2. Aktivieren Sie die gewünschten Social-Login-Provider (Google, Apple, Facebook, etc.).
3. Für jeden Provider müssen Sie:
   - Eine App in der jeweiligen Entwicklerkonsole erstellen (Google Developer Console, Apple Developer Portal, etc.).
   - Die Client-ID und das Client-Secret in Supabase eintragen.
   - Die Redirect-URL aus Supabase in der Entwicklerkonsole eintragen.

### Allgemeine Einstellungen

1. Unter "Authentication" > "Settings":
   - Setzen Sie "Site URL" auf die URL Ihrer App (für die Entwicklung: `http://localhost:8081`).
   - Aktivieren Sie "Enable email confirmations" nach Bedarf.
   - Passen Sie die Sicherheitseinstellungen nach Bedarf an.

## 4. API-Schlüssel abrufen

1. Gehen Sie zu "Settings" > "API" in der Seitenleiste.
2. Kopieren Sie die "URL" und den "anon" (public) Schlüssel.
3. Öffnen Sie die Datei `lib/supabase.ts` in Ihrem Projekt.
4. Ersetzen Sie `IHRE_SUPABASE_URL` durch die kopierte URL.
5. Ersetzen Sie `IHRE_SUPABASE_ANON_KEY` durch den kopierten "anon" Schlüssel.

```typescript
// lib/supabase.ts
const supabaseUrl = 'https://ihre-projekt-id.supabase.co';
const supabaseAnonKey = 'ihr-anon-key';
```

## 5. Testen der Verbindung

1. Starten Sie Ihre App mit `npx expo start`.
2. Versuchen Sie, sich zu registrieren und anzumelden.
3. Testen Sie das Aufzeichnen von Wehen und überprüfen Sie, ob sie in der Supabase-Datenbank gespeichert werden.

## 6. Datenbank-Inhalte überprüfen

1. Gehen Sie zu "Table Editor" in der Seitenleiste.
2. Wählen Sie die Tabelle "contractions".
3. Hier sollten Sie die aufgezeichneten Wehen sehen.

## 7. Benutzer verwalten

1. Gehen Sie zu "Authentication" > "Users" in der Seitenleiste.
2. Hier können Sie alle registrierten Benutzer sehen und verwalten.

## Fehlerbehebung

- **Authentifizierungsprobleme**: Überprüfen Sie die Authentifizierungseinstellungen und stellen Sie sicher, dass die Site URL korrekt ist.
- **Datenbankfehler**: Überprüfen Sie die SQL-Logs unter "Database" > "Logs".
- **API-Fehler**: Überprüfen Sie die API-Logs unter "Logs" in der Seitenleiste.

## Nächste Schritte

- Implementieren Sie zusätzliche Funktionen wie Benutzerprofile oder Statistiken.
- Fügen Sie Echtzeit-Updates mit Supabase Realtime hinzu.
- Implementieren Sie Datensynchronisierung für Offline-Nutzung.
