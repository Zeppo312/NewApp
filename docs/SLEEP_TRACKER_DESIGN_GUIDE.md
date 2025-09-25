# 🌙 Sleep-Tracker Design Guide

## 📋 Übersicht
Vollständiger Design Guide für den Sleep-Tracker Screen (`sleep-tracker.tsx`) mit allen visuellen Spezifikationen, Abständen, Farben und Layout-Strukturen.

---

## 🎨 **Farbpalette**

### **Primäre Farben**
```typescript
// Hauptfarben
backgroundColor: '#f5eee0'           // Warmer Cream-Hintergrund
primaryText: '#7D5A50'              // Warmes Braun für Titel
secondaryText: '#A8978E'            // Helleres Braun für Subtexte
accentColor: '#5e3db3'              // Lila für Werte/Highlights
```

### **Status-Leiste Farben**
```typescript
// Heute (Lila)
todayColor: '#8E4EC6'
todayOverlay: 'rgba(142, 78, 198, 0.1)'
todayBorder: 'rgba(142, 78, 198, 0.25)'

// Naps (Orange)
napsColor: '#FF8C42'
napsOverlay: 'rgba(255, 140, 66, 0.1)'
napsBorder: 'rgba(255, 140, 66, 0.25)'

// Längster (Grün)
longestColor: '#A8C4A2'
longestOverlay: 'rgba(168, 196, 162, 0.1)'
longestBorder: 'rgba(168, 196, 162, 0.25)'

// Score (Rot)
scoreColor: '#FF9B9B'
scoreOverlay: 'rgba(255, 155, 155, 0.1)'
scoreBorder: 'rgba(255, 155, 155, 0.25)'
```

### **Timer Farben**
```typescript
// Central Timer
babyBlue: '#87CEEB'                 // Baby Blue für Timer
babyBlueOverlay: 'rgba(135, 206, 235, 0.1)'
babyBlueProgress: 'rgba(135, 206, 235, 0.4)'
timerText: '#6B4C3B'                // Dunkelbraun für Zeit
```

### **Action Button Farben**
```typescript
// Schlaf starten (Lila)
startSleep: 'rgba(220, 200, 255, 0.6)'
startSleepIcon: 'rgba(142, 78, 198, 0.9)'

// Schlaf beenden (Rosa)
stopSleep: 'rgba(255, 190, 190, 0.6)'
stopSleepIcon: 'rgba(255, 140, 160, 0.9)'

// Manuell (Türkis)
manualEntry: 'rgba(168, 196, 193, 0.6)'
manualIcon: 'rgba(168, 196, 193, 0.9)'
```

---

## 📐 **Layout-Struktur**

### **Container Hierarchie**
```
ThemedBackground
├── SafeAreaView (container)
│   ├── Header
│   ├── TopTabs
│   ├── StatusMetricsBar (2x2 Grid)
│   └── ScrollView
│       ├── CentralTimer
│       ├── Schlaferfassung Section
│       ├── ActionButtons
│       ├── Timeline Section
│       └── Sleep Entries
└── Splash Overlay (conditional)
```

### **Hauptcontainer Abstände**
```typescript
container: {
  flex: 1
}

scrollContainer: {
  flex: 1
}

scrollContent: {
  paddingBottom: 140,        // Platz für Navigation
  paddingHorizontal: 20      // Seitliche Abstände
}
```

---

## 🏷️ **Top Tabs**

### **Layout & Abstände**
```typescript
topTabsContainer: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 10,                   // Abstand zwischen Tabs
  marginTop: 6
}

topTab: {
  borderRadius: 20,
  overflow: 'hidden',
  borderWidth: 1
}

topTabInner: {
  paddingHorizontal: 18,     // Innenabstand horizontal
  paddingVertical: 6         // Innenabstand vertikal
}
```

### **Typografie**
```typescript
topTabText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#7D5A50'
}

activeTopTabText: {
  color: '#5e3db3'           // Aktiver Tab in Lila
}
```

---

## 📊 **Status-Leiste (KPI Cards)**

### **Layout (2x2 Grid)**
```typescript
kpiRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 6,
  paddingHorizontal: 16,
  marginBottom: 4
}

kpiCard: {
  width: '48%',              // 48% Breite für 2 Cards pro Zeile
  borderRadius: 12,          // Abgerundete Ecken
  paddingVertical: 10,       // Kompakter vertikaler Abstand
  paddingHorizontal: 8,      // Kompakter horizontaler Abstand
  borderWidth: 1,
  overflow: 'hidden',
  minHeight: 60              // Feste Mindesthöhe
}
```

### **Header-Layout**
```typescript
kpiHeaderRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 3            // Kleiner Abstand zum Wert
}

kpiTitle: {
  fontSize: 11,              // Kleine, kompakte Schrift
  fontWeight: '600',
  color: '#7D5A50',
  marginLeft: 4              // Abstand zum Icon
}
```

### **Werte-Typografie**
```typescript
kpiValue: {
  fontSize: 18,              // 35% kleiner als Standard (28px)
  fontWeight: '800',         // Sehr fett für Prominenz
  color: '#5e3db3',          // Lila Akzentfarbe
  marginTop: 1,              // Minimaler Abstand
  letterSpacing: -0.5        // Engere Buchstaben
}

kpiValueCentered: {
  textAlign: 'center',
  width: '100%'
}
```

### **Icons**
```typescript
// Icon-Größe: 12px (kleiner als Standard 14px)
IconSymbol size={12}
```

---

## ⏱️ **Central Timer**

### **Container & Layout**
```typescript
centralTimerContainer: {
  alignItems: 'center',
  paddingVertical: 8,        // Kompakter Abstand
  marginBottom: 8
}

centralContainer: {
  alignItems: 'center',
  paddingVertical: 8,
  position: 'relative'
}

// Kreis-Dimensionen
ringSize: screenWidth * 0.75    // 75% der Bildschirmbreite
circleSize: ringSize * 0.8      // 80% der Ring-Größe
```

### **Glas-Effekt**
```typescript
glassCircleOverlay: {
  backgroundColor: 'rgba(135, 206, 235, 0.1)',  // Baby Blue
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.6)'
}

// BlurView intensity: 18
```

### **Content-Positionierung**
```typescript
// Icon (oben)
upperContent: {
  position: 'absolute',
  top: 0,
  bottom: '60%',             // Oberes Drittel
  alignItems: 'center',
  justifyContent: 'center'
}

// Zeit (zentriert)
centerOverlay: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  alignItems: 'center',
  justifyContent: 'center'
}

// Status & Hinweis (unten)
lowerContent: {
  position: 'absolute',
  top: '60%',                // Unter der Zeit
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: 8
}
```

### **Typografie**
```typescript
centralTime: {
  fontSize: 32,              // Große, prominente Zeit
  fontWeight: '900',
  letterSpacing: 0,
  color: '#6B4C3B',
  lineHeight: 32,            // Perfekte Zentrierung
  fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
  fontVariant: ['tabular-nums']  // Monospace-Ziffern
}

centralStatus: {
  fontSize: 16,
  fontWeight: '800',
  color: '#6B4C3B',
  marginBottom: 2,
  lineHeight: 16
}

centralHint: {
  fontSize: 11,
  fontWeight: '500',
  color: '#7D5A50',
  maxWidth: 180,
  textAlign: 'center',
  lineHeight: 11
}
```

### **Icon-Container**
```typescript
centralIcon: {
  width: 54,
  height: 54,
  borderRadius: 27,
  justifyContent: 'center',
  alignItems: 'center',
  // Dynamische Farben:
  // Aktiv: rgba(135, 206, 235, 0.9) - Baby Blue
  // Inaktiv: rgba(255, 140, 66, 0.9) - Orange
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  shadowColor: 'rgba(255, 255, 255, 0.3)',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.8,
  shadowRadius: 2,
  elevation: 4
}

// Icon-Größe: 28px
```

---

## 📝 **Section Titles**

```typescript
sectionTitle: {
  marginTop: 18,
  marginBottom: 8,
  paddingHorizontal: 20,
  fontSize: 14,
  fontWeight: '700',
  color: '#7D5A50',          // Warmes Braun
  textAlign: 'center',       // Zentriert
  width: '100%'
}
```

---

## 🎯 **Action Buttons**

### **Grid-Layout**
```typescript
cardsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  marginBottom: 16,
  paddingHorizontal: 4
}
```

### **Button-Container**
```typescript
// Standard Button (48% Breite)
liquidGlassCardWrapper: {
  width: '48%',
  marginBottom: 14,
  borderRadius: 22,
  overflow: 'hidden'
}

// Stop Button (100% Breite)
fullWidthStopButton: {
  width: '100%',
  marginBottom: 14,
  borderRadius: 22,
  overflow: 'hidden'
}
```

### **Card-Design**
```typescript
card: {
  borderRadius: 22,
  padding: 16,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 128,
  height: 140,               // Feste Höhe
  borderWidth: 1.5,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  shadowColor: 'rgba(255, 255, 255, 0.3)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.8,
  shadowRadius: 6,
  elevation: 5
}

// BlurView intensity: 24
```

### **Icon-Container**
```typescript
iconContainer: {
  width: 54,
  height: 54,
  borderRadius: 27,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 10,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  shadowColor: 'rgba(255, 255, 255, 0.3)',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.8,
  shadowRadius: 2,
  elevation: 4
}

// Icon-Größe: 28px
```

### **Button-Typografie**
```typescript
cardTitle: {
  fontSize: 16,
  fontWeight: '800',
  marginBottom: 4,
  textAlign: 'center',
  color: '#7D5A50',
  letterSpacing: -0.2
}

cardDescription: {
  fontSize: 11,
  textAlign: 'center',
  lineHeight: 14,
  color: 'rgba(85, 60, 55, 0.7)',
  fontWeight: '500'
}
```

---

## 📱 **Sleep Input Modal**

### **Modal-Layout**
```typescript
modalOverlay: {
  flex: 1,
  justifyContent: 'flex-end',
  backgroundColor: 'rgba(0, 0, 0, 0.4)'  // Dimming
}

modalContent: {
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  width: '100%',
  height: '85%',             // 85% der Bildschirmhöhe
  maxHeight: 700,
  minHeight: 650,
  overflow: 'hidden',
  padding: 20,
  paddingBottom: 40
}

// BlurView: tint="extraLight", intensity={80}
```

### **Header**
```typescript
header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 25
}

headerButton: {
  width: 44,
  height: 44,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 22
}

modalTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#7D5A50'
}

modalSubtitle: {
  fontSize: 14,
  marginTop: 2,
  color: '#A8978E'
}
```

### **Sektionen**
```typescript
section: {
  marginBottom: 30,          // Großer Abstand zwischen Sektionen
  width: '100%',
  alignItems: 'center'
}
```

### **Zeit-Buttons**
```typescript
timeRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '90%',
  gap: 15
}

timeButton: {
  flex: 1,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  borderRadius: 15,
  padding: 15,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3
}

timeLabel: {
  fontSize: 12,
  color: '#888888',
  fontWeight: '600',
  marginBottom: 5
}

timeValue: {
  fontSize: 16,
  color: '#333333',
  fontWeight: 'bold'
}
```

### **Qualitäts-Buttons**
```typescript
optionsGrid: {
  flexDirection: 'row',
  justifyContent: 'center',
  width: '100%',
  paddingHorizontal: 10
}

optionButton: {
  flexDirection: 'column',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 18,
  borderRadius: 20,
  justifyContent: 'center',
  marginHorizontal: 5,
  minHeight: 80,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3
}

optionIcon: {
  fontSize: 30,              // Große Emojis
  marginBottom: 8
}

optionLabel: {
  fontSize: 14,
  fontWeight: '500',
  textAlign: 'center'
}
```

### **Notizen-Input**
```typescript
notesInput: {
  width: '90%',
  minHeight: 80,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  borderRadius: 15,
  padding: 15,
  fontSize: 16,
  color: '#333333',
  textAlignVertical: 'top',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3
}
```

---

## 🌟 **Splash Screen**

### **Overlay**
```typescript
splashOverlay: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
}

// LinearGradient mit dynamischen Farben
```

### **Content-Card**
```typescript
splashCenterCard: {
  width: '100%',
  paddingHorizontal: 28,
  alignItems: 'center',
  justifyContent: 'center'
}

splashEmojiRing: {
  width: 140,
  height: 140,
  borderRadius: 70,
  borderWidth: 2,
  borderColor: 'rgba(255,255,255,0.7)',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.08)'
}
```

### **Typografie**
```typescript
splashEmoji: {
  fontSize: 72,              // Sehr großes Emoji
  textAlign: 'center',
  marginBottom: 10,
  color: '#fff'
}

splashTitle: {
  fontSize: 34,              // Großer Titel
  fontWeight: '800',
  color: '#fff',
  textAlign: 'center',
  marginTop: 8,
  textShadowColor: 'rgba(0,0,0,0.18)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6
}

splashSubtitle: {
  marginTop: 16,
  fontSize: 18,
  lineHeight: 26,
  color: 'rgba(255,255,255,0.95)',
  textAlign: 'center'
}

splashStatus: {
  marginTop: 30,
  fontSize: 16,
  color: 'rgba(255,255,255,0.9)',
  textAlign: 'center'
}
```

### **Hint-Card**
```typescript
splashHintCard: {
  marginTop: 24,
  backgroundColor: 'rgba(255,255,255,0.16)',
  borderColor: 'rgba(255,255,255,0.35)',
  borderWidth: 1,
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderRadius: 18
}

splashHintText: {
  color: '#fff',
  fontSize: 16,
  textAlign: 'center',
  fontWeight: '700'
}
```

---

## 🎨 **Glass-Effekte**

### **Standard GlassCard**
```typescript
glassContainer: {
  borderRadius: 18,
  overflow: 'hidden',
  borderWidth: 1,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 8
}

glassOverlay: {
  backgroundColor: 'rgba(255,255,255,0.30)'
}

// BlurView intensity: 26 (Standard)
```

### **Liquid Glass Cards**
```typescript
liquidGlassWrapper: {
  borderRadius: 22,
  overflow: 'hidden',
  marginBottom: 16
}

liquidGlassContainer: {
  borderRadius: 22,
  borderWidth: 1.5,
  shadowColor: 'rgba(255, 255, 255, 0.3)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.8,
  shadowRadius: 8,
  elevation: 8
}

// BlurView intensity: 24 (Liquid Glass)
```

---

## 📊 **Animationen**

### **Timing & Easing**
```typescript
// Erscheinen der Seite
appearAnim: {
  toValue: 1,
  duration: 500,
  useNativeDriver: true
}

// Timer Pulsing (aktiver Schlaf)
pulseAnimation: {
  toValue: 1.02,
  duration: 1500,
  useNativeDriver: true
}

// Splash Animationen
splashAnim: {
  toValue: 1,
  duration: 250,
  useNativeDriver: true
}

splashEmojiAnim: {
  sequence: [
    { toValue: 1.1, duration: 220 },
    { spring: toValue: 1 }
  ]
}
```

### **Button Interactions**
```typescript
// TouchableOpacity activeOpacity
standard: 0.9
cards: 0.85
```

---

## 📱 **Responsive Design**

### **Bildschirm-Dimensionen**
```typescript
const { width: screenWidth } = Dimensions.get('window');

// Timer-Größe
ringSize = screenWidth * 0.75     // 75% der Breite
circleSize = ringSize * 0.8       // 80% der Ring-Größe
```

### **Platform-Spezifisch**
```typescript
// iOS vs Android
fontFamily: Platform.OS === 'ios' 
  ? 'SF Pro Display' 
  : 'Roboto'

// DateTimePicker
display: Platform.OS === 'ios' 
  ? 'compact' 
  : 'default'
```

---

## 🔧 **Performance-Optimierungen**

### **BlurView Intensitäten**
```typescript
// Optimierte Blur-Werte für Performance
statusCards: 20        // Kompakt, weniger Blur
actionButtons: 24      // Standard Liquid Glass
centralTimer: 18       // Timer-Kreis
modal: 80             // Starker Blur für Modal
```

### **Shadow & Elevation**
```typescript
// iOS Shadows
shadowColor: '#000' | 'rgba(255, 255, 255, 0.3)'
shadowOffset: { width: 0, height: 1-8 }
shadowOpacity: 0.1-0.8
shadowRadius: 2-20

// Android Elevation
elevation: 3-8
```

---

## ✨ **Zusammenfassung**

### **Design-Prinzipien**
1. **Kompaktheit**: Reduzierte Abstände und Schriftgrößen für platzsparende Darstellung
2. **Glasmorphismus**: Durchgängige Verwendung von BlurView und transluzenten Overlays
3. **Warme Farbpalette**: Braun-Töne (#7D5A50) mit Akzent-Farben für verschiedene Kategorien
4. **Zentrierte Ausrichtung**: Alle Titel und wichtigen Elemente zentriert
5. **Konsistente Abstände**: Einheitliche Margin/Padding-Werte im gesamten Design
6. **Responsive Layout**: Anpassung an verschiedene Bildschirmgrößen
7. **Subtile Animationen**: Sanfte Übergänge und Feedback-Animationen

### **Einzigartige Features**
- **2x2 KPI Grid**: Kompakte Status-Karten in zwei Zeilen
- **Zentrierter Timer**: Perfekt zentrierte Zeit mit absoluter Positionierung
- **Dynamische Farben**: Kontextabhängige Farben je nach Schlafstatus
- **Modal Integration**: Nahtlose DateTimePicker-Integration im Modal
- **Splash System**: Kontextuelle Erfolgs-Popups mit Sleep-spezifischen Nachrichten

Dieser Design Guide dokumentiert alle visuellen und technischen Aspekte des Sleep-Tracker Screens für konsistente Wartung und Weiterentwicklung.

