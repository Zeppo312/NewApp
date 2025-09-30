# 🎨 Design Guide – Sleeptracker (React Native / Expo)

## 1. Layout & Spacing
- **Grid-Basis:** 8-pt Grid (alle Abstände sind Vielfache von 8 → 8, 16, 24)
- **Seitenränder:** 16 px links/rechts
- **Vertikale Abstände:**
  - Section-Titel zu Content: 8 px
  - Content-Block zu Block: 16 px
  - Section zu Section: 24 px
- **Card-Innenabstände:** 20–24 px
- **Kartenhöhe:** dynamisch, aber min. 120 px

---

## 2. Farben
### Primärfarben
- **Primär (Blau):** `#4E9EFF`
  - Dunkel-Variante: `#2A6FBF`
  - Hell-Variante: `#B3D4FF`
- **Sekundär (Status):**
  - Sehr gut: `#4CAF50` → Hintergrund: `rgba(76,175,80,0.2)`
  - Gut: `#8BC34A` → Hintergrund: `rgba(139,195,74,0.2)`
  - Mittel: `#FFC107` → Hintergrund: `rgba(255,193,7,0.25)`
  - Schlecht: `#F44336` → Hintergrund: `rgba(244,67,54,0.25)`
  - Keine Daten: `#BDBDBD` → Hintergrund: `rgba(189,189,189,0.25)`
- **App-Hintergrund:**
  - Light: `#F8F9FB`
  - Dark: `#111111`
- **Karten (Blur-Hintergrund):**
  - Light: `rgba(255,255,255,0.7)`
  - Dark: `rgba(24,24,24,0.6)`

---

## 3. Typografie
- **Heading L (z. B. Monatsübersicht):**
  - `fontSize: 22`, `fontWeight: 700`, `letterSpacing: -0.3`
- **Heading M (Sektionstitel):**
  - `fontSize: 18`, `fontWeight: 600`, `letterSpacing: -0.2`
- **Body (Standardtext):**
  - `fontSize: 14–16`, `fontWeight: 400`, `lineHeight: 20–22`
- **Labels/Indikatoren:**  
  - `fontSize: 10–12`, `fontWeight: 500`, `lineHeight: 14`
- **Zahlen (Dauer/Std):**
  - `fontSize: 14–16`, `fontWeight: 700`, `fontVariant: ['tabular-nums']`

---

## 4. Karten & Container
- **BorderRadius:**
  - Cards: 20 px
  - Kleine Buttons: 12 px
  - Kalenderzellen: 10 px
- **Blur:** Intensität 40–60
- **Opazität:** 
  - Light Mode: 0.7  
  - Dark Mode: 0.6
- **Shadows (nur Light Mode):**
  - `shadowColor: '#000'`
  - `shadowOpacity: 0.05`
  - `shadowRadius: 8`
  - `shadowOffset: { height: 2 }`
  - Android: `elevation: 4`

---

## 5. Buttons
- **Navigation (‹ ›):**
  - Größe: 32×32 px
  - Radius: 16 px
  - Textgröße: 20 px
  - Abstand zu Titel: 12 px
- **Heute-Button (optional):**
  - Textfarbe: `#4E9EFF`, Bold
  - Padding: 8–12 px horizontal
  - Radius: 12 px
  - Hintergrund: `rgba(78,158,255,0.1)`

---

## 6. Kalender (MonthView)
- **Grid:** 7 Spalten × 5–6 Zeilen
- **Zellen:**
  - Quadratisch (`aspectRatio: 1`)
  - Radius: 10 px
- **DayNumber:** oben zentriert, Bold, 12–14 px
- **DayHours:** unten zentriert, 10 px, `opacity: 0.8`
- **Farbcodierung:** Hintergrund in Statusfarbe (20–30 % Opazität)

---

## 7. Diagramme
- **Linien:** `strokeWidth: 2`, Primärfarbe
- **Datenpunkte:** Kreis, 4–6 px Radius
- **Innenpadding:** 16 px
- **Labels:** `fontSize: 12`, `color: rgba(0,0,0,0.6)`

---

## 8. Ikonen & Emojis
- Emojis (🌙 ☀️) statt Icons
- Größe: 20–24 px
- Abstand zum Text: 8 px

---

## 9. Interaktionen
- **Aktiv:** volle Farbe
- **Hover (Web/Tablet):** `rgba(0,0,0,0.05)`
- **Disabled:** `opacity: 0.4`
- **Animationen:**
  - Dauer: 200–250 ms
  - Kurve: Ease-out
  - Typ: Scale/Fade

---

## 10. Responsive Verhalten
- **Breiten:** `window.width - 2*16`
- **Spalten:** gleichmäßig, Gutter 8 px
- **Tap-Fläche:** min. 44×44 px
