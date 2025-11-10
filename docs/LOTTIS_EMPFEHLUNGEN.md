# Lottis Empfehlungen - Dokumentation

## Übersicht

"Lottis Empfehlungen" ist ein Feature, das es Admin-Usern ermöglicht, Produktempfehlungen in der App zu verwalten. Normale User können diese Empfehlungen sehen und über Links direkt zu den Produkten gelangen.

## Features

### Für normale User:
- ✅ Anzeige aller Produktempfehlungen
- ✅ Produktbilder, Titel und Beschreibungen
- ✅ Rabattcodes sichtbar mit Glasoptik-Badge
- ✅ Direkter Link zu den Produkten
- ✅ Schönes Liquid Glass Design mit Animationen
- ✅ Buttons mit Glasoptik (BlurView + LinearGradient)

### Für Admin-User:
- ✅ Alle Features von normalen Usern
- ✅ Neue Empfehlungen hinzufügen
- ✅ Bestehende Empfehlungen bearbeiten
- ✅ Empfehlungen löschen
- ✅ Bilder hochladen oder URL eingeben
- ✅ Rabattcodes hinzufügen (z.B. LOTTI10)
- ✅ Reihenfolge der Empfehlungen anpassen (über order_index)
- ✅ Image Picker mit Vorschau
- ✅ Upload-Status Anzeige

## Setup

### 1. Datenbank-Migration ausführen

#### Option A: Über das Setup-Script (empfohlen)

```bash
# Mit Service Role Key
export EXPO_PUBLIC_SUPABASE_URL="deine-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="dein-service-role-key"

# Script ausführen
node scripts/setup-lotti-empfehlungen.js

# Optional: Direkt einen User als Admin setzen
node scripts/setup-lotti-empfehlungen.js "user@example.com"
```

#### Option B: Manuell über Supabase Dashboard

1. Gehe zum Supabase Dashboard
2. Öffne den **SQL Editor**
3. Kopiere den Inhalt von `supabase/migrations/20260603000000_create_lotti_recommendations.sql`
4. Füge ihn ein und führe ihn aus

### 2. Admin-User festlegen

Es gibt mehrere Wege, einen User als Admin zu setzen:

#### Option A: Über das Supabase Dashboard

1. Gehe zu **Table Editor** → `profiles`
2. Finde deinen User (nach E-Mail oder Name suchen)
3. Setze das Feld `is_admin` auf `true`

#### Option B: Über SQL

```sql
-- Ersetze 'user@example.com' mit deiner E-Mail
UPDATE profiles 
SET is_admin = true 
WHERE email = 'user@example.com';
```

#### Option C: Über die Supabase CLI

```bash
supabase db execute --sql "UPDATE profiles SET is_admin = true WHERE email = 'user@example.com';"
```

### 3. App starten und testen

1. Starte die App: `npm start`
2. Gehe zu **Mehr** → **Lottis Empfehlungen**
3. Als Admin siehst du den "Neue Empfehlung" Button

## Datenbankstruktur

### Tabelle: `lotti_recommendations`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `title` | TEXT | Titel der Empfehlung |
| `description` | TEXT | Beschreibung des Produkts |
| `image_url` | TEXT | URL zum Produktbild (optional) |
| `product_link` | TEXT | Link zum Produkt (Amazon, Shop, etc.) |
| `discount_code` | TEXT | Rabattcode für das Produkt (optional) |
| `order_index` | INTEGER | Sortierreihenfolge (niedrigere Zahlen zuerst) |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt |
| `created_by` | UUID | User-ID des Erstellers |
| `updated_at` | TIMESTAMPTZ | Letztes Update |

### Spalte in `profiles`: `is_admin`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `is_admin` | BOOLEAN | Admin-Flag (default: false) |

## Security (Row Level Security)

Die Tabelle ist durch RLS geschützt:

- **SELECT**: Jeder authentifizierte User kann Empfehlungen lesen
- **INSERT/UPDATE/DELETE**: Nur User mit `is_admin = true`

## API/Service-Funktionen

### `isUserAdmin()`
Prüft, ob der aktuelle User ein Admin ist.

```typescript
const isAdmin = await isUserAdmin();
```

### `getRecommendations()`
Holt alle Empfehlungen sortiert nach `order_index` und `created_at`.

```typescript
const recommendations = await getRecommendations();
```

### `createRecommendation(input)`
Erstellt eine neue Empfehlung (nur für Admins).

```typescript
await createRecommendation({
  title: "Beste Tragetasche",
  description: "Super bequem für Baby und Eltern...",
  image_url: "https://example.com/image.jpg",
  product_link: "https://amazon.de/...",
  order_index: 0
});
```

### `updateRecommendation(id, updates)`
Aktualisiert eine Empfehlung (nur für Admins).

```typescript
await updateRecommendation(recommendationId, {
  title: "Neuer Titel",
  description: "Neue Beschreibung"
});
```

### `deleteRecommendation(id)`
Löscht eine Empfehlung (nur für Admins).

```typescript
await deleteRecommendation(recommendationId);
```

### `updateRecommendationsOrder(items)`
Aktualisiert die Reihenfolge mehrerer Empfehlungen.

```typescript
await updateRecommendationsOrder([
  { id: "uuid-1", order_index: 0 },
  { id: "uuid-2", order_index: 1 }
]);
```

## UI-Komponenten

### Seite: `app/lottis-empfehlungen.tsx`

**Features:**
- Liquid Glass Design mit BlurView und LinearGradient
- SlideInView Animationen mit gestaffelten Delays
- Responsive Produktkarten mit Bildern
- Modal für Add/Edit Formulare
- Admin-Buttons (Edit, Delete) nur für Admins sichtbar

**Design-Specs:**
- BlurView intensity: 25
- Border radius: 22px
- Shadow opacity: 0.15
- Text shadows für bessere Lesbarkeit

## Verwendung

### Als Admin:

1. **Neue Empfehlung hinzufügen:**
   - Tippe auf "Neue Empfehlung"
   - Fülle Titel und Beschreibung aus (Pflichtfelder)
   - **Bild hinzufügen:**
     - Option 1: Tippe auf "Bild auswählen" und wähle ein Foto aus deiner Galerie
     - Option 2: Gib eine Bild-URL ein
   - Gib den Produkt-Link ein (Pflichtfeld)
   - Optional: Füge einen Rabattcode hinzu (z.B. LOTTI10)
   - Tippe auf "Speichern"

2. **Empfehlung bearbeiten:**
   - Tippe auf den Bleistift-Button (mit Glasoptik) bei einer Empfehlung
   - Ändere die Felder
   - Bild kann geändert werden (neues Bild auswählen oder URL ändern)
   - Tippe auf "Speichern"

3. **Empfehlung löschen:**
   - Tippe auf den Mülleimer-Button (mit Glasoptik)
   - Bestätige das Löschen

### Als normaler User:

1. Gehe zu **Mehr** → **Lottis Empfehlungen**
2. Browse durch die Empfehlungen
3. Tippe auf "Zum Produkt" um den Link zu öffnen

## Tipps

### Gute Produktbilder

**Hochladen von der Galerie (empfohlen):**
- Bilder werden automatisch zu Supabase Storage hochgeladen
- Quadratische Bilder (1:1) werden beim Auswählen zugeschnitten
- Optimale Qualität: 0.8 (automatisch)
- Unterstützte Formate: JPEG, PNG

**URL-Methode:**
- **Format**: JPEG oder PNG
- **Größe**: 800x800px empfohlen
- **Seitenverhältnis**: 1:1 (quadratisch)
- **Hosting**: Imgur, oder direkter Amazon Product Image Link
- **Wichtig**: URL muss öffentlich zugänglich sein (kein Login erforderlich)

### Produktlinks

- Amazon Affiliate Links funktionieren
- Direkte Shop-Links
- Stelle sicher, dass Links mit `https://` beginnen

### Sortierung

- Niedrigere `order_index` Werte erscheinen zuerst
- Bei gleichen `order_index` Werten wird nach `created_at` sortiert
- Empfohlen: 0, 10, 20, 30... (lässt Platz für spätere Umordnung)

## Troubleshooting

### "Empfehlung konnte nicht erstellt werden"

**Problem**: User hat keine Admin-Rechte
**Lösung**: Prüfe, ob `is_admin = true` in der `profiles` Tabelle gesetzt ist

### "Tabelle lotti_recommendations existiert nicht"

**Problem**: Migration wurde nicht ausgeführt
**Lösung**: Führe die Migration manuell über das Supabase Dashboard aus

### Bilder werden nicht angezeigt

**Problem**: Bild-URL ist ungültig oder erfordert Authentifizierung
**Lösung**: 
- Verwende die Bild-Upload Funktion (empfohlen)
- Oder verwende öffentlich zugängliche Bild-URLs

### Bild hochladen funktioniert nicht

**Problem**: Keine Berechtigung für Foto-Zugriff
**Lösung**: Erlaube der App den Zugriff auf deine Fotos in den Einstellungen

**Problem**: Supabase Storage Bucket existiert nicht
**Lösung**: Erstelle einen `public-images` Bucket in Supabase Storage:
1. Gehe zum Supabase Dashboard → Storage
2. Erstelle einen neuen Bucket namens `public-images`
3. Setze die Berechtigung auf "public"

### Links öffnen nicht

**Problem**: URL-Format ist ungültig
**Lösung**: Stelle sicher, dass der Link mit `https://` oder `http://` beginnt

## Zukünftige Erweiterungen

Mögliche Features für später:

- [ ] Drag & Drop zum Umordnen der Empfehlungen
- [ ] Kategorien für Empfehlungen (z.B. "Baby-Kleidung", "Spielzeug", etc.)
- [ ] Like/Favoriten-Funktion für User
- [ ] Kommentare oder Bewertungen zu Empfehlungen
- [ ] Affiliate-Tracking für Links
- [ ] Push-Benachrichtigungen bei neuen Empfehlungen
- [ ] Supabase Storage Integration für Bilder hochladen

## Support

Bei Fragen oder Problemen:
1. Prüfe diese Dokumentation
2. Schau in die Console Logs für Error Messages
3. Prüfe die Supabase Logs im Dashboard

