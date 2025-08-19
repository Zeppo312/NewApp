# 📱 OTP E-Mail-Verifikation Setup

Diese Anleitung zeigt dir, wie du die OTP (One-Time-Password) E-Mail-Verifikation in Supabase konfigurierst.

## 🎯 Was wurde implementiert

**Neuer User Flow:**
```
Registrierung → OTP per E-Mail → 6-stelligen Code eingeben → Verifiziert → App
```

**Features:**
- ✅ 6-stelliger Code per E-Mail
- ✅ Automatisches Springen zwischen Input-Feldern
- ✅ Auto-Verifikation bei vollständiger Eingabe
- ✅ Resend-Funktion mit 60s Countdown
- ✅ Benutzerfreundliche Fehlerbehandlung

## 🔧 Supabase Dashboard Konfiguration

### 1. OTP E-Mail-Verifikation aktivieren

**Schritt 1: Authentication Settings**
1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt aus
3. Navigiere zu **Authentication** → **Settings**
4. **Email confirmation**: ✅ **Enable email confirmations**
5. **Confirm email template**: Wähle **OTP (6 digit)**

### 2. E-Mail Template für OTP anpassen

**Authentication** → **Email Templates** → **Confirm signup**

**Template Type:** `OTP (6 digit)`

**HTML Template:**
```html
<h2>Willkommen bei Lotti Baby! 👶</h2>
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #8E4EC6; margin-bottom: 10px;">Bestätige deine E-Mail</h1>
    <p style="color: #666; font-size: 16px;">
      Gib diesen 6-stelligen Code in der App ein:
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <div style="display: inline-block; background-color: #f8f9fa; border: 2px dashed #8E4EC6; border-radius: 12px; padding: 20px 30px;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8E4EC6; font-family: 'Courier New', monospace;">
        {{ .Token }}
      </span>
    </div>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
      ⏰ Dieser Code ist 10 Minuten gültig
    </p>
    <p style="color: #666; font-size: 14px;">
      Falls du diese Registrierung nicht vorgenommen hast, kannst du diese E-Mail ignorieren.
    </p>
  </div>

  <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
    <p style="color: #8E4EC6; font-weight: bold;">
      Viel Freude mit der App! 🍼
    </p>
    <p style="color: #999; font-size: 12px;">
      Dein Lotti Baby Team
    </p>
  </div>

</div>
```

**Subject Template:**
```
Dein Lotti Baby Bestätigungscode: {{ .Token }}
```

### 3. OTP-Konfiguration anpassen (Optional)

**Authentication** → **Settings** → **Security and sessions**

```
Token expiry: 600 (10 Minuten)
Maximum OTP attempts: 5
OTP cooldown period: 60 (Sekunden zwischen Resends)
```

## 📧 E-Mail Provider Setup

### Option 1: Supabase SMTP (Standard)
- Funktioniert out-of-the-box
- Begrenzte Anzahl E-Mails pro Tag
- Für Development ausreichend

### Option 2: Custom SMTP Provider (Production)

**Empfohlene Provider:**
- **SendGrid** (kostenlos bis 100 E-Mails/Tag)
- **Mailgun** (kostenlos bis 5.000 E-Mails/Monat)
- **Postmark** (kostenlos bis 100 E-Mails/Monat)

**Konfiguration (z.B. SendGrid):**
1. **Authentication** → **Settings** → **SMTP Settings**
2. **Enable custom SMTP**: ✅
3. Konfiguration:
   ```
   Sender name: Lotti Baby
   Sender email: noreply@deine-domain.com
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [SendGrid API Key]
   ```

## 🧪 Testing

### E-Mail-Verifikation testen

1. **Registrierung**:
   ```
   1. Neue E-Mail eingeben
   2. Registrieren klicken
   3. → Automatisch zur OTP-Eingabe
   ```

2. **OTP-Eingabe**:
   ```
   1. E-Mail öffnen und 6-stelligen Code kopieren
   2. Code in App eingeben (auto-jump zwischen Feldern)
   3. → Automatische Verifikation bei vollständiger Eingabe
   ```

3. **Resend-Funktion**:
   ```
   1. "Code erneut senden" klicken
   2. 60-Sekunden Countdown prüfen
   3. Neue E-Mail mit neuem Code erhalten
   ```

### Debug-Modus

In der Entwicklung kannst du OTP-Codes in der Supabase-Console einsehen:
1. **Authentication** → **Users**
2. User auswählen → **Raw user meta data**
3. Suche nach `email_otp` oder ähnlichem

## 🚨 Troubleshooting

### Häufige Probleme

**1. Keine OTP-E-Mail erhalten:**
- Spam-Ordner prüfen
- SMTP-Konfiguration in Supabase prüfen
- E-Mail-Provider Limits prüfen

**2. "Invalid OTP" Fehler:**
- Code ist abgelaufen (10 Min Standard)
- Code bereits verwendet
- Falsche Eingabe

**3. Resend funktioniert nicht:**
- Cooldown-Period (60s) abwarten
- E-Mail-Limits erreicht
- SMTP-Fehler in Logs prüfen

### Debug-Logs

```javascript
// In der App-Console prüfen:
console.log('OTP verification result:', data, error);
```

### Supabase Logs prüfen

1. **Supabase Dashboard** → **Logs**
2. Filter: `auth` oder `email`
3. Nach OTP-bezogenen Einträgen suchen

## ✅ Checkliste

- [ ] E-Mail-Bestätigung in Supabase aktiviert
- [ ] OTP Template konfiguriert (6-stellig)
- [ ] E-Mail Template angepasst
- [ ] SMTP Provider konfiguriert (für Production)
- [ ] OTP-Zeitlimits angepasst
- [ ] Testing auf echtem Gerät durchgeführt
- [ ] Spam-Filter getestet
- [ ] Resend-Funktion getestet

## 🎉 Fertig!

Nach dieser Konfiguration funktioniert der OTP-Flow:

1. **User registriert sich** → bekommt sofort 6-stelligen Code per E-Mail
2. **Code eingeben** → automatische Verifikation in der App  
3. **Verifiziert** → zur Profil-Vervollständigung oder App

Das ist viel benutzerfreundlicher als Link-basierte Verifikation! 🚀
