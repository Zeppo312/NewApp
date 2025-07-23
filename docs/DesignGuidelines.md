# Design-Richtlinien für die Wehen-Tracker App

Diese Dokumentation enthält die Design-Richtlinien für die Wehen-Tracker App, um ein konsistentes Erscheinungsbild und eine einheitliche Benutzererfahrung zu gewährleisten.

## Farbschema

Die App verwendet ein warmes, weiches Beige-Farbschema, das für werdende Mütter angenehm und beruhigend wirkt.

### Hauptfarben

- **Primärfarbe**: `#E6CCB2` - Weiches Beige/Tan für primäre Akzente
- **Sekundärfarbe**: `#F2E2CE` - Sehr helles Beige für sekundäre Akzente
- **Akzentfarbe**: `#C89F81` - Weiches Terrakotta für Buttons und Hervorhebungen
- **Timer-Textfarbe**: `#5C4033` - Dunkles Braun für Timer-Text (hoher Kontrast)
- **Erfolgsfarbe**: `#9DBEBB` - Weiches Salbeigrün für Erfolgszustände
- **Warnfarbe**: `#E9C9B6` - Weiches Koralle für Warnungen

### Textfarben

#### Heller Modus
- **Primäre Textfarbe**: `#5C4033` - Dunkles Braun für Überschriften und wichtigen Text (Kontrastverhältnis > 7:1)
- **Sekundäre Textfarbe**: `#7D5A50` - Weicheres Braun für normalen Text (Kontrastverhältnis > 4.5:1)
- **Tertiäre Textfarbe**: `#9C8178` - Helleres Braun für weniger wichtigen Text (Kontrastverhältnis > 3:1)
- **Deaktivierte Textfarbe**: `#B0A59E` - Sehr helles Braun für deaktivierten Text

#### Dunkler Modus
- **Primäre Textfarbe**: `#FFFFFF` - Reines Weiß für Überschriften und wichtigen Text (Kontrastverhältnis > 10:1)
- **Sekundäre Textfarbe**: `#F8F0E5` - Sehr helles Beige für normalen Text (Kontrastverhältnis > 7:1)
- **Tertiäre Textfarbe**: `#E9D8C2` - Helleres Beige für weniger wichtigen Text (Kontrastverhältnis > 5:1)
- **Deaktivierte Textfarbe**: `#B8A99A` - Helleres gedämpftes Beige für deaktivierten Text (Kontrastverhältnis > 3:1)
- **Akzent-Textfarbe**: `#A5D6D9` - Helles Türkis für Hervorhebungen und Akzente (Kontrastverhältnis > 4.5:1)

### Funktionale Farben

- **Fehler/Löschen**: `#FF6B6B` - Weiches Rot für Fehler und Löschen-Aktionen
- **Hintergrund (Hell)**: `#FFF8F0` - Cremiges Weiß für den Hintergrund im hellen Modus
- **Hintergrund (Dunkel)**: `#2D2522` - Dunkles Braun für den Hintergrund im dunklen Modus
- **Kartenfarbe (Hell)**: `#F7EFE5` - Sehr helles Beige für Karten im hellen Modus
- **Kartenfarbe (Dunkel)**: `#3D3330` - Dunkleres Braun für Karten im dunklen Modus

## Typografie

- **Überschriften**:
  - Größe: 24px
  - Schriftart: System-Standard, fett
  - Farbe: `#7D5A50` (dunkles Braun)
  - Zeilenhöhe: 40px (um Buchstaben mit Überlängen Platz zu geben)

- **Untertitel**:
  - Größe: 18px
  - Schriftart: System-Standard, fett
  - Farbe: `#7D5A50`

- **Normaler Text**:
  - Größe: 16px
  - Schriftart: System-Standard, normal
  - Farbe: `#7D5A50`

- **Kleiner Text**:
  - Größe: 14px
  - Schriftart: System-Standard, normal
  - Farbe: `#7D5A50`

## UI-Komponenten

### Buttons

#### Standard-Button
- Hintergrundfarbe: `#C89F81` (Akzentfarbe)
- Textfarbe: Weiß
- Abrundung: 8px
- Padding: 12px vertikal, 16px horizontal
- Schattierung: Leichte Schattierung für 3D-Effekt
- Textgröße: 16px, fett

#### Zurück-Button
- Größe: 40px x 40px
- Form: Kreis (borderRadius: 20px)
- Hintergrundfarbe: `rgba(255, 255, 255, 0.9)` (leicht transparentes Weiß)
- Icon-Farbe: `#E57373` (Pastellrot)
- Icon: "chevron.left"
- Icon-Größe: 24px
- Schattierung: Leichte Schattierung für 3D-Effekt
- Position: Links oben im Header-Bereich

#### Löschen-Button
- Hintergrundfarbe: `#FF6B6B` (weiches Rot)
- Textfarbe: Weiß
- Abrundung: 8px
- Padding: 10px
- Schattierung: Keine oder sehr leicht
- Textgröße: 14px, fett

#### Floating Action Button (FAB)
- Form: Kreis
- Größe: 56px x 56px
- Hintergrundfarbe: `#C89F81` (Akzentfarbe)
- Icon-Farbe: Weiß
- Icon-Größe: 24px
- Position: Unten rechts, mit genügend Abstand zum Bildschirmrand und zur Navigation
- Schattierung: Mittlere Schattierung für 3D-Effekt

### Karten/Container

- Hintergrundfarbe: `#F7EFE5` (sehr helles Beige)
- Abrundung: 16px
- Padding: 16px
- Schattierung: Leichte Schattierung für 3D-Effekt
- Abstand zwischen Karten: 16px

### Eingabefelder

- Hintergrundfarbe: `#F5F5F5` (sehr helles Grau)
- Textfarbe: `#7D5A50` (dunkles Braun)
- Abrundung: 8px
- Padding: 12px
- Rahmen: Keiner oder sehr leicht
- Placeholder-Textfarbe: `#A68A7B` (helleres Braun)

### Checkboxen

- Größe: 24px x 24px
- Unmarkiert: Kreis-Icon
- Markiert: Ausgefülltes Kreis-Icon mit Häkchen
- Farbe unmarkiert: `#A68A7B` (helleres Braun)
- Farbe markiert: `#9DBEBB` (Erfolgsfarbe)
- Klickbereich: Vergrößert (mindestens 44x44px) für bessere Bedienbarkeit

## Layout

### Allgemein

- Hintergrundbild: `Background_Hell.png` als sich wiederholendes Muster
- SafeAreaView: Immer verwenden, um sicherzustellen, dass Inhalte nicht von Systemkomponenten überdeckt werden
- StatusBar: Versteckt (`hidden: true`)
- Padding: 16px für Container

### Header

- Zentrierter Titel
- Zurück-Button links positioniert
- Abstand unter dem Header: 20px

### Listen

- Abstand zwischen Listenelementen: 12px
- Listenelemente als Karten mit Schatten
- Klickbare Bereiche deutlich erkennbar

## Navigation

- Tab-Navigation: Unten positioniert
- Swipe-Gesten: Unterstützt für Navigation zwischen verwandten Seiten
- Zurück-Navigation: Immer über den Zurück-Button oder Swipe-Geste

## Responsive Design

- Flexible Layouts, die sich an verschiedene Bildschirmgrößen anpassen
- Verwendung von prozentualen Werten und flexiblen Einheiten
- Mindestgröße für interaktive Elemente: 44x44px (für Touchscreens)

## Dunkelmodus-Spezifikationen

### Hintergründe

- **Haupt-Hintergrundbild**: `Background_Dunkel.png` für den gesamten App-Hintergrund
- **Container-Hintergründe**: `#2A2321` (sehr dunkles Braun) für Karten und Container
- **Container-Hintergründe (heller)**: `#3D3330` (dunkles Braun) für Karten, die hervorgehoben werden sollen
- **Eingabefelder**: `#211C1A` (fast schwarzes Braun) mit 90% Deckkraft

### UI-Elemente

- **Buttons**: Gleiche Farben wie im hellen Modus, aber mit leicht erhöhter Sättigung für bessere Sichtbarkeit
- **Icons**: Hellere Farben (`#F2E2CE`) für bessere Sichtbarkeit auf dunklem Hintergrund
- **Trennlinien**: `#5C4033` (mittleres Braun) mit 30% Deckkraft für subtile Trennung

### Schatten und Tiefe

- **Schatten**: Subtilere Schatten mit geringerer Deckkraft (15-20%)
- **Hervorhebungen**: Leichtes Glühen (0.5px) in `#E6CCB2` für hervorgehobene Elemente

### Übergänge

- **Farbwechsel**: Flüssige Übergänge zwischen Hell- und Dunkelmodus mit einer Dauer von 300ms
- **Animation**: Subtile Fade-Effekte beim Wechsel zwischen den Modi

## Barrierefreiheit und Lesbarkeit

### Kontrast und Lesbarkeit

- **Minimales Kontrastverhältnis**: Alle Texte müssen ein Kontrastverhältnis von mindestens 4.5:1 zum Hintergrund haben
- **Wichtige Texte**: Überschriften und wichtige Informationen sollten ein Kontrastverhältnis von mindestens 7:1 haben
- **Hintergrund-Transparenz**: Bei Texten auf transparenten Hintergründen muss die Transparenz so eingestellt sein, dass der Mindestkontrast erhalten bleibt
- **Schattierungen**: Bei Bedarf Text mit Schattierungen (text-shadow) versehen, um die Lesbarkeit auf komplexen Hintergründen zu verbessern

### Textlesbarkeit im Dunkelmodus

- **Helle Textfarben**: Im Dunkelmodus cremige oder warme helle Farben statt reinem Weiß verwenden, um Blendeffekte zu reduzieren
- **Reduzierte Transparenz**: Im Dunkelmodus weniger Transparenz bei UI-Elementen verwenden, um besseren Kontrast zu gewährleisten
- **Hervorhebungen**: Wichtige Elemente mit leichtem Glühen oder Umrandungen hervorheben

### Allgemeine Barrierefreiheit

- **Große, gut lesbare Schrift**: Mindestgröße 14px für normalen Text, 16px für wichtige Informationen
- **Ausreichend große Klickbereiche**: Mindestgröße 44x44px für alle interaktiven Elemente
- **Beschreibende Labels**: Alle interaktiven Elemente mit aussagekräftigen Labels für Screenreader versehen
- **Farbunabhängige Unterscheidung**: Wichtige Informationen nicht nur durch Farbe, sondern auch durch Form, Text oder Icons kennzeichnen

## Animationen

- Subtile Animationen für Übergänge
- Feedback-Animationen für Benutzerinteraktionen
- Keine übermäßigen oder ablenkenden Animationen

---

Diese Richtlinien sollten bei der Entwicklung und Gestaltung aller Komponenten und Seiten der App befolgt werden, um ein konsistentes und benutzerfreundliches Erlebnis zu gewährleisten.
