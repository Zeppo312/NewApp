# Convex Deployment - Schritt-für-Schritt Anleitung

## ✅ Vorbereitung (Bereits erledigt)

- [x] Node.js 20+ installiert (v20.20.0 aktiv)
- [x] Convex package installiert
- [x] Schema und Functions erstellt
- [x] Service Layer implementiert

## 📝 Deployment Schritte

### 1. Terminal öffnen

Öffne ein neues Terminal im Projekt-Verzeichnis:
```bash
cd /Users/janzeppenfeld/Documents/LottiBaby
```

### 2. Node 20 aktivieren

Stelle sicher, dass Node 20 aktiv ist:
```bash
source ~/.nvm/nvm.sh
nvm use 20
node --version  # Sollte v20.20.0 anzeigen
```

### 3. Convex Dev Server starten

```bash
npx convex dev
```

Dies wird:
1. **Login-Prompt anzeigen**: Folgst du den Anweisungen zum Login/Account erstellen
2. **Projekt erstellen**: Erstellt ein neues Convex Projekt
3. **Deployment URL geben**: Z.B. `https://capable-mammal-123.convex.cloud`
4. **Types generieren**: Auto-generiert Type-Definitionen in `convex/_generated/`
5. **Watch-Mode starten**: Überwacht Änderungen und synchronisiert automatisch

### 4. Deployment URL kopieren

Nach erfolgreichem Setup siehst du eine URL wie:
```
Deployment URL: https://capable-mammal-123.convex.cloud
```

Kopiere diese URL.

### 5. Environment Variable setzen

Öffne `.env.local` und füge die URL hinzu:
```bash
EXPO_PUBLIC_CONVEX_URL=https://capable-mammal-123.convex.cloud
```

**Wichtig**: Ersetze `capable-mammal-123` mit deiner tatsächlichen Deployment-URL!

### 6. Admin User ID eintragen

1. Finde deine Supabase User ID:
   - Gehe zu Supabase Dashboard
   - Authentication → Users
   - Kopiere deine User ID

2. Öffne `contexts/BackendContext.tsx`

3. Füge deine ID zum Array hinzu:
```typescript
const ADMIN_USER_IDS = [
  'DEINE-USER-ID-HIER',  // <-- Hier einfügen
];
```

### 7. Supabase Migration ausführen

Öffne Supabase SQL Editor und führe aus:
```sql
ALTER TABLE user_settings
ADD COLUMN preferred_backend TEXT DEFAULT 'supabase'
CHECK (preferred_backend IN ('supabase', 'convex'));
```

### 8. App neu starten

```bash
# Expo Server neu starten
npx expo start -c
```

## ✅ Verifikation

Nach erfolgreichem Deployment:

### Convex Dashboard checken
1. Gehe zu https://dashboard.convex.dev
2. Wähle dein Projekt
3. Du solltest die Tables sehen:
   - `users`
   - `doctor_questions`

### App testen
1. Starte die App
2. Als Admin-User einloggen
3. Im Header solltest du den Backend-Toggle sehen (SB/CX)
4. Gehe zu "Fragen für den Frauenarzt"
5. Erstelle eine neue Frage
6. Toggle zu Convex (CX)
7. Die Frage sollte auch dort sichtbar sein

### Console Logs checken
Bei erfolgreicher Dual-Write siehst du Logs wie:
```
Convex write succeeded
Primary backend (supabase) write succeeded
Secondary backend (convex) write succeeded
```

Bei Fehlern:
```
[DualWrite] Secondary backend (convex) write failed: <error>
```

## 🐛 Troubleshooting

### "Convex client not available"
- Checke, dass `EXPO_PUBLIC_CONVEX_URL` in `.env.local` gesetzt ist
- Expo Server neu starten (`npx expo start -c`)

### "Cannot find module convex/_generated/api"
- `npx convex dev` läuft nicht oder wurde nicht initialisiert
- Prüfe, ob `convex/_generated/` Ordner existiert und Type-Dateien enthält

### Backend Toggle nicht sichtbar
- Du bist nicht als Admin eingeloggt
- Checke deine User ID in `BackendContext.tsx`

### Dual-Write funktioniert nur einseitig
- Checke Console Logs für Fehler
- Prüfe Convex Dashboard, ob Daten ankommen
- Verifiziere Schema-Match zwischen Supabase und Convex

## 📊 Monitoring

### Convex Dashboard
- Logs: Sieh Funktion-Calls in Echtzeit
- Tables: Prüfe Daten-Konsistenz
- Functions: Monitore Performance

### App Console
- Dual-Write Success/Failures
- Backend Switch Events
- Service Errors

## 🔄 Workflow nach Setup

### Development
1. `npx convex dev` läuft im Hintergrund
2. Änderungen an Schema/Functions werden automatisch deployed
3. Types werden automatisch regeneriert

### Deployment
```bash
# Production Deployment
npx convex deploy --prod

# Dies erstellt eine Production-Deployment-URL
# Update dann EXPO_PUBLIC_CONVEX_URL mit der Prod-URL
```

## 📝 Nächste Schritte nach erfolgreichem Setup

1. **Daten-Migration**: Bestehende Supabase-Daten zu Convex migrieren
2. **Weitere Features**: Sleep tracking, Milestones, etc. migrieren
3. **Real-time Sync**: Convex Subscriptions für Live-Updates implementieren
4. **Monitoring**: Dashboard für Backend-Health aufsetzen

## 🎯 Quick Reference

```bash
# Convex Dev starten
npx convex dev

# Convex Production deployen
npx convex deploy --prod

# Convex Dashboard öffnen
npx convex dashboard

# Types neu generieren (falls nötig)
npx convex dev --once

# Node Version checken
node --version

# Node Version wechseln
nvm use 20
```

## ❓ Fragen?

Wenn Probleme auftreten:
1. Checke Console Logs in App und Terminal
2. Prüfe Convex Dashboard für Errors
3. Verifiziere Environment Variables
4. Stelle sicher, dass beide Services laufen (Supabase + Convex)
