# Partner Notification Push - Edge Function

Diese Edge Function sendet echte Push Notifications an Partner, wenn neue Aktivitäten (Sleep, Feeding, Diaper) erstellt werden.

## Setup

### 1. Edge Function deployen

```bash
# Login in Supabase (falls noch nicht geschehen)
npx supabase login

# Link dein Projekt
npx supabase link --project-ref <your-project-ref>

# Deploy die Function
npx supabase functions deploy send-partner-notification
```

### 2. Database Webhook einrichten (via Dashboard)

**Wichtig**: Statt die Migration `20260110000002_create_notification_webhook.sql` zu verwenden, ist es einfacher, den Webhook über das Supabase Dashboard einzurichten:

1. Gehe zu **Supabase Dashboard** → **Database** → **Webhooks**
2. Klicke auf **Create a new hook**
3. Konfiguriere:
   - **Name**: `partner-notification-push`
   - **Table**: `partner_activity_notifications`
   - **Events**: nur `INSERT` auswählen
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/send-partner-notification`
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer <your-service-role-key>
     ```
   - **HTTP Params**: Leer lassen

4. Klicke **Confirm**

### 3. Service Role Key konfigurieren

Die Edge Function braucht Zugriff auf die Datenbank. Das ist automatisch über `SUPABASE_SERVICE_ROLE_KEY` verfügbar (wird von Supabase gesetzt).

### 4. Testen

Nach dem Setup:

1. Erstelle einen Test-Entry in der App (z.B. Sleep Entry)
2. Der Database Trigger erstellt eine Notification in `partner_activity_notifications`
3. Der Webhook ruft automatisch die Edge Function auf
4. Die Edge Function sendet eine Push Notification
5. Der Partner sollte die Notification erhalten (auch wenn App geschlossen!)

**Debug-Logs ansehen**:
```bash
# Logs der Edge Function anschauen
npx supabase functions logs send-partner-notification
```

Oder im Dashboard: **Edge Functions** → **send-partner-notification** → **Logs**

## Alternative: Webhook via Migration

Falls du den Webhook lieber via SQL erstellen möchtest (statt Dashboard), musst du die Migration anpassen:

1. Öffne `supabase/migrations/20260110000002_create_notification_webhook.sql`
2. Ersetze die `webhook_url` Zeile 18:
   ```sql
   webhook_url := 'https://<your-project-ref>.supabase.co/functions/v1/send-partner-notification';
   ```
3. Führe die Migration aus

**Hinweis**: Die Dashboard-Methode ist empfohlen, da sie einfacher zu konfigurieren ist.

## Funktionsweise

```
User erstellt Entry (z.B. Sleep)
    ↓
Database Trigger: create_partner_sleep_notification()
    ↓
INSERT in partner_activity_notifications
    ↓
Database Webhook triggert
    ↓
Edge Function: send-partner-notification
    ↓
- Holt Partner Name aus profiles
- Holt Push Tokens aus user_push_tokens
- Formatiert Notification Content
- Sendet Push via Expo Push API
    ↓
Partner erhält Notification (auch wenn App geschlossen!)
```

## Notification Templates

- **Sleep**: "💤 {Partner} hat das Baby schlafen gelegt um {Zeit}"
- **Feeding (Breast)**: "🤱 {Partner} hat gestillt um {Zeit}"
- **Feeding (Bottle)**: "🍼 {Partner} hat gefüttert um {Zeit}"
- **Feeding (Solids)**: "🥄 {Partner} hat Beikost gegeben um {Zeit}"
- **Diaper (Wet)**: "💧 {Partner} hat eine nasse Windel gewechselt um {Zeit}"
- **Diaper (Dirty)**: "💩 {Partner} hat eine schmutzige Windel gewechselt um {Zeit}"
- **Diaper (Both)**: "💧💩 {Partner} hat eine volle Windel gewechselt um {Zeit}"

## Troubleshooting

### Notifications kommen nicht an

1. **Prüfe Edge Function Logs**:
   ```bash
   npx supabase functions logs send-partner-notification --tail
   ```

2. **Prüfe ob Webhook triggert**:
   - Dashboard → Database → Webhooks → partner-notification-push
   - Schaue unter "Recent deliveries"

3. **Prüfe Push Tokens**:
   ```sql
   SELECT * FROM user_push_tokens WHERE user_id = '<user-id>';
   ```

4. **Teste Edge Function direkt**:
   ```bash
   curl -X POST \
     'https://<your-project-ref>.supabase.co/functions/v1/send-partner-notification' \
     -H 'Authorization: Bearer <service-role-key>' \
     -H 'Content-Type: application/json' \
     -d '{
       "type": "INSERT",
       "table": "partner_activity_notifications",
       "record": {
         "id": "test-id",
         "user_id": "<user-id>",
         "partner_id": "<partner-id>",
         "activity_type": "sleep",
         "activity_subtype": null,
         "entry_id": "test-entry-id",
         "created_at": "2024-01-10T12:00:00Z"
       }
     }'
   ```

### Push Token fehlt

Stelle sicher, dass die App die Push Permission angefordert hat und den Token gespeichert hat:
```typescript
// In der App beim Start
const { requestPermissions } = useNotifications();
await requestPermissions();
```

## Kosten

- Edge Function: Im Free Tier **500K Invocations/Monat kostenlos**
- Expo Push: **Komplett kostenlos**

Für eine normale Baby-Tracking App ist das komplett im Free Tier.
