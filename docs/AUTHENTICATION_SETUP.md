# 🔐 Authentication Setup Guide

Diese Anleitung zeigt dir, wie du Apple Sign-In und E-Mail-Verifikation in Supabase konfigurierst.

## 📋 Supabase Dashboard Konfiguration

### 1. E-Mail-Verifikation aktivieren

**Schritt 1: Authentication Settings**
1. Gehe zu deinem [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt aus
3. Navigiere zu **Authentication** → **Settings**
4. Scrolle zu **Email confirmation**
5. ✅ **Enable email confirmations**
6. ✅ **Enable double confirm email changes**

**Schritt 2: Site URL konfigurieren**
1. Gehe zu **Authentication** → **URL Configuration**
2. **Site URL**: `https://deine-app-domain.com` (oder für Development: `http://localhost:8081`)

**Schritt 3: Redirect URLs hinzufügen**
```
Production:
https://deine-app-domain.com/auth/callback

Development:
http://localhost:8081/auth/callback
exp://localhost:8081/auth/callback

App Deep Link:
com.lottibaby.app://auth/callback
```

### 2. Apple Sign-In Provider aktivieren

**Voraussetzungen:**
- Apple Developer Account
- App ID in Apple Developer Console
- Services ID für Sign in with Apple

**Schritt 1: Apple Developer Setup**
1. Gehe zu [Apple Developer Console](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **App ID** erstellen:
   ```
   Bundle ID: com.LottiBaby.app
   Capabilities: Sign In with Apple ✅
   ```
4. **Services ID** erstellen:
   ```
   Description: Lotti Baby Sign In
   Identifier: com.LottiBaby.app.signin
   Sign In with Apple: ✅ Configure
   ```

**Schritt 2: Services ID konfigurieren**
1. Bei Services ID → **Sign In with Apple** → **Configure**
2. **Primary App ID**: Wähle deine App ID (`com.LottiBaby.app`)
3. **Domains and Subdomains**: 
   ```
   deine-supabase-project.supabase.co
   ```
4. **Return URLs**:
   ```
   https://deine-supabase-project.supabase.co/auth/v1/callback
   ```

**Schritt 3: Private Key erstellen**
1. **Keys** → **+** → **Sign In with Apple**
2. Key downloaden und sicher aufbewahren
3. **Key ID** notieren

**Schritt 4: Client Secret generieren**
Du musst ein JWT Token als Client Secret erstellen. Verwende dieses Python-Script:

```python
import jwt
import time
from datetime import datetime, timedelta

# Deine Apple Developer Daten
team_id = "DEIN_TEAM_ID"
client_id = "com.LottiBaby.app.signin"  # Services ID
key_id = "DEIN_KEY_ID"
private_key = """
-----BEGIN PRIVATE KEY-----
DEIN_PRIVATE_KEY_CONTENT
-----END PRIVATE KEY-----
"""

# JWT erstellen
payload = {
    'iss': team_id,
    'iat': int(time.time()),
    'exp': int(time.time()) + 86400 * 180,  # 6 Monate
    'aud': 'https://appleid.apple.com',
    'sub': client_id
}

headers = {
    'kid': key_id,
    'alg': 'ES256'
}

client_secret = jwt.encode(payload, private_key, algorithm='ES256', headers=headers)
print(client_secret)
```

**Schritt 5: Supabase Apple Provider konfigurieren**
1. **Authentication** → **Providers**
2. **Apple** → **Enable**
3. Konfiguration:
   ```
   Enable Apple provider: ✅
   Client IDs (kommagetrennt):
   - com.LottiBaby.app.signin   (Services ID für Web/OAuth)
   - com.LottiBaby.app          (iOS Bundle ID für natives signInWithIdToken)
   - host.exp.Exponent          (optional, nur wenn ihr in Expo Go testet)
   Client Secret: [JWT Token aus Schritt 4]
   Redirect URL: https://deine-supabase-project.supabase.co/auth/v1/callback
   ```
4. Wichtig: Wenn der Fehler `Unacceptable audience in id_token: [XYZ]` erscheint, muss genau `XYZ` in den Supabase **Client IDs** enthalten sein.

### 3. E-Mail Templates anpassen (Optional)

**Custom Templates:**
1. **Authentication** → **Email Templates**
2. **Confirm signup** Template anpassen:

```html
<h2>Willkommen bei Lotti Baby! 👶</h2>
<p>Hallo!</p>
<p>Vielen Dank, dass du dich bei Lotti Baby registriert hast. Bitte bestätige deine E-Mail-Adresse, um fortzufahren:</p>
<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #8E4EC6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
  E-Mail bestätigen
</a>
<p>Falls du diese Registrierung nicht vorgenommen hast, kannst du diese E-Mail ignorieren.</p>
<p>Viel Freude mit der App!<br/>
Dein Lotti Baby Team</p>
```

## 🔧 App-Konfiguration

### Deep Links aktivieren

Die `app.json` ist bereits konfiguriert:
```json
{
  "expo": {
    "scheme": "com.lottibaby.app",
    "plugins": [
      "expo-apple-authentication"
    ]
  }
}
```

### Bundle Identifier prüfen

Stelle sicher, dass der Bundle Identifier konsistent ist:
- **app.json**: `"bundleIdentifier": "com.LottiBaby.app"`
- **Apple Developer**: `com.LottiBaby.app`
- **Supabase**: `com.lottibaby.app://auth/callback`

## 🧪 Testing

### E-Mail-Verifikation testen

1. **Registrierung**:
   - Neue E-Mail-Adresse verwenden
   - Nach Registrierung → automatisch zu `verify-email` Seite
   - E-Mail im Posteingang prüfen

2. **Verifikations-Link**:
   - E-Mail öffnen und Link klicken
   - Sollte zu `auth/callback` weiterleiten
   - Dann automatisch zur App

3. **Resend-Funktion**:
   - "E-Mail erneut senden" Button testen
   - 60-Sekunden Countdown prüfen

### Apple Sign-In testen

1. **iOS Simulator/Device**:
   - Apple Sign-In Button sollte nur auf iOS erscheinen
   - Native Apple Dialog öffnen
   - Mit Test Apple ID anmelden

2. **Profile Check**:
   - Neue Apple-User → automatisch zu `getUserInfo`
   - Bestehende User → automatisch zur App

## 🚨 Troubleshooting

### Häufige Probleme

**1. Apple Sign-In funktioniert nicht:**
- Bundle Identifier prüfen
- Services ID konfiguration prüfen
- In Supabase Apple Provider müssen die richtigen **Client IDs** eingetragen sein
- Bei `Unacceptable audience in id_token: [XYZ]` → `XYZ` in **Client IDs** ergänzen
- Client Secret ist gültig (max. 6 Monate)

**2. E-Mail-Verifikation funktioniert nicht:**
- Site URL in Supabase korrekt
- Redirect URLs vollständig konfiguriert
- E-Mail-Bestätigung in Supabase aktiviert

**3. Deep Links funktionieren nicht:**
- URL Scheme in app.json korrekt
- Expo Development Build verwenden (nicht Expo Go)

### Debug-Logs aktivieren

In der App kannst du Debug-Logs in der Console prüfen:
```javascript
console.log('Auth state changed:', event, session?.user?.email_confirmed_at);
```

## ✅ Checkliste

- [ ] E-Mail-Verifikation in Supabase aktiviert
- [ ] Site URL und Redirect URLs konfiguriert
- [ ] Apple Developer Account Setup
- [ ] Apple Services ID erstellt und konfiguriert
- [ ] Private Key generiert und Client Secret erstellt
- [ ] Apple Provider in Supabase aktiviert
- [ ] Bundle Identifier konsistent
- [ ] E-Mail Templates angepasst (optional)
- [ ] Testing auf iOS-Gerät/Simulator durchgeführt

Nach Abschluss aller Schritte sollten beide Login-Methoden einwandfrei funktionieren! 🎉
