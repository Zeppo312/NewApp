import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Dimensions, Animated, Easing, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DailyEntry } from '@/lib/baby';
import { LinearGradient } from 'expo-linear-gradient';

interface CircularDayViewProps {
  entries: DailyEntry[];
  onDeleteEntry?: (id: string) => void;
}

const CircularDayView: React.FC<CircularDayViewProps> = ({ entries, onDeleteEntry }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : '#3B3B3B';
  const labelColor = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const modalValueColor = isDark ? Colors.dark.text : '#333333';
  const [selectedEntry, setSelectedEntry] = useState<DailyEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const size = screenWidth - 60; // Größe des Kreises
  const center = size / 2; // Zentrum des Kreises
  const radius = size / 2 - 20; // Radius des Kreises

  // Formatiere Zeit (HH:MM)
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Berechne die Position eines Aktivitätsblocks im Halbkreis
  const calculateActivityPosition = (startTime?: string) => {
    if (!startTime) return { angle: 0 };

    try {
      const start = new Date(startTime);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const totalMinutesInDay = 24 * 60;

      // Für einen Halbkreis verwenden wir nur 0-180 Grad
      // 0 Uhr = 0 Grad (links), 12 Uhr = 180 Grad (rechts), 24 Uhr = 0 Grad (links)
      let rawAngle = (startMinutes / totalMinutesInDay) * 360;

      // Wenn die Zeit in der zweiten Tageshälfte liegt, spiegeln wir den Winkel
      // damit alle Punkte im oberen Halbkreis erscheinen
      if (rawAngle > 180) {
        rawAngle = 360 - rawAngle;
      }

      // Beschränke den Winkel auf 15-165 Grad, um Überlappungen mit Sonne und Mond zu vermeiden
      const minAngle = 15;
      const maxAngle = 165;
      const angle = Math.max(minAngle, Math.min(maxAngle, rawAngle));

      return { angle };
    } catch (error) {
      console.log('Fehler bei der Berechnung der Aktivitätsposition:', error);
      return { angle: 90 }; // Fallback auf die Mitte des Halbkreises
    }
  };

  // Berechne die Dauer in Minuten
  const calculateDuration = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  };

  // Bestimme die Farbe basierend auf dem Aktivitätstyp
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'feeding':
        return '#FF9800'; // Orange
      case 'sleep':
        return '#5C6BC0'; // Blau
      case 'diaper':
        return '#4CAF50'; // Grün
      default:
        return '#9C27B0'; // Lila
    }
  };

  // Bestimme das Icon basierend auf dem Aktivitätstyp
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'feeding':
        return 'drop.fill'; // Flasche-Icon
      case 'sleep':
        return 'moon.fill'; // Mond-Icon
      case 'diaper':
        return 'heart.fill'; // Windel-Icon
      default:
        return 'star.fill'; // Stern-Icon für Sonstiges
    }
  };

  // Bestimme den Text basierend auf dem Aktivitätstyp
  const getActivityText = (type: string) => {
    switch (type) {
      case 'feeding':
        return 'Füttern';
      case 'sleep':
        return 'Schlafen';
      case 'diaper':
        return 'Wickeln';
      default:
        return 'Sonstiges';
    }
  };

  // Rendere die Aktivitätsblöcke im Kreis
  const renderActivityDots = () => {
    try {
      // Sortiere die Einträge nach Zeitpunkt, um eine bessere Verteilung zu ermöglichen
      const sortedEntries = [...entries].filter(entry => entry && entry.id && entry.start_time).sort((a, b) => {
        try {
          if (!a.start_time || !b.start_time) return 0;
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        } catch (error) {
          console.log('Fehler beim Sortieren der Einträge:', error);
          return 0;
        }
      });

      // Berechne die Positionen aller Aktivitätspunkte
      const positions = sortedEntries.map(entry => {
        try {
          if (!entry.id || !entry.start_time) return null;
          const { angle } = calculateActivityPosition(entry.start_time);
          // Berechne die Position auf dem Halbkreis
          // Wir verwenden den exakten Radius des Tracks (size/2 - 12.5), um die Punkte genau auf dem Ring zu platzieren
          const trackRadius = (size / 2) - 12.5; // Hälfte der Breite des Tracks (25px)
          // Für einen Halbkreis: 0 Grad = links, 90 Grad = oben, 180 Grad = rechts
          const x = center + trackRadius * Math.cos(angle * Math.PI / 180);
          const y = center - trackRadius * Math.sin(angle * Math.PI / 180); // Minus für den oberen Halbkreis
          return { id: entry.id, x, y, angle };
        } catch (error) {
          console.log('Fehler bei der Berechnung der Position für Eintrag:', entry.id, error);
          return null;
        }
      }).filter(Boolean);

      // Minimaler Abstand zwischen Punkten
      const minDistance = 55; // Erhöhter Mindestabstand zwischen den Punkten

      // Vereinfachte Anpassung der Positionen, um Überlappungen zu vermeiden
      const adjustedPositions = [];

      // Einfachere Positionsanpassung ohne komplexe Berechnungen
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        if (!pos) {
          adjustedPositions.push(null);
          continue;
        }

        // Standardposition verwenden
        let adjustedPos = { ...pos };

        // Prüfe auf Überlappungen mit vorherigen Punkten
        let hasOverlap = false;
        for (let j = 0; j < i; j++) {
          const prevPos = adjustedPositions[j];
          if (!prevPos) continue;

          try {
            const distance = Math.sqrt(
              Math.pow(pos.x - prevPos.x, 2) +
              Math.pow(pos.y - prevPos.y, 2)
            );

            if (distance < minDistance) {
              hasOverlap = true;
              break;
            }
          } catch (error) {
            console.log('Fehler bei der Distanzberechnung:', error);
          }
        }

        // Wenn Überlappung, verwende einen alternativen Radius
        if (hasOverlap) {
          try {
            // Verwende einen festen Faktor für die Anpassung
            // Wir verwenden einen größeren Faktor (0.9), um die Punkte näher am Ring zu halten
            const adjustmentFactor = 0.9;
            // Berechne den Radius basierend auf der Trackbreite
            const trackRadius = (size / 2) - 12.5; // Hälfte der Breite des Tracks (25px)
            const newRadius = trackRadius * adjustmentFactor;
            // Für einen Halbkreis: 0 Grad = links, 90 Grad = oben, 180 Grad = rechts
            const newX = center + newRadius * Math.cos(pos.angle * Math.PI / 180);
            const newY = center - newRadius * Math.sin(pos.angle * Math.PI / 180); // Minus für den oberen Halbkreis

            adjustedPos = {
              ...pos,
              x: newX,
              y: newY,
              adjusted: true
            };
          } catch (error) {
            console.log('Fehler bei der Positionsanpassung:', error);
          }
        }

        adjustedPositions.push(adjustedPos);
      }

      // Rendere die Aktivitätspunkte
      return sortedEntries.map((entry, index) => {
        try {
          if (!entry.id) return null;

          const position = adjustedPositions[index];
          if (!position) return null;

          const color = getActivityColor(entry.entry_type);
          const { x, y } = position;

          // Bestimme, ob es sich um die letzte Aktivität handelt
          const isLastActivity = lastActivity && lastActivity.id === entry.id;

          // Füge eine Zeitanzeige für die Aktivität hinzu
          let timeLabel = '';
          try {
            if (entry.start_time) {
              timeLabel = new Date(entry.start_time).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch (error) {
            console.log('Fehler bei der Zeitformatierung:', error);
            timeLabel = 'Fehler';
          }

          // Berechne die Position für das Zeitlabel, damit es nicht verdeckt wird
          // Wir positionieren das Label außerhalb des Rings
          const timeLabelPosition = {
            left: x - 35, // Breiter für bessere Lesbarkeit
            top: y + 25, // Mehr Abstand zum Punkt
          };

          // Berechne den Winkel des Punktes relativ zum Zentrum (in Grad)
          const pointAngle = Math.atan2(y - center, x - center) * 180 / Math.PI;

          // Positioniere das Label basierend auf dem Winkel
          if (pointAngle > -45 && pointAngle < 45) {
            // Rechte Seite
            timeLabelPosition.left = x + 25;
            timeLabelPosition.top = y - 10;
          } else if (pointAngle >= 45 && pointAngle < 135) {
            // Untere Seite
            timeLabelPosition.left = x - 35;
            timeLabelPosition.top = y + 25;
          } else if ((pointAngle >= 135 && pointAngle <= 180) || (pointAngle >= -180 && pointAngle <= -135)) {
            // Linke Seite
            timeLabelPosition.left = x - 95;
            timeLabelPosition.top = y - 10;
          } else {
            // Obere Seite
            timeLabelPosition.left = x - 35;
            timeLabelPosition.top = y - 45;
          }

          return (
            <View key={entry.id}>
              <TouchableOpacity
                style={[
                  styles.activityDot,
                  {
                    left: x - 20, // Zentriere den Punkt (40px)
                    top: y - 20, // Zentriere den Punkt (40px)
                    backgroundColor: color,
                    borderWidth: isLastActivity ? 3 : 2, // Dickerer Rahmen für bessere Sichtbarkeit
                    borderColor: '#FFFFFF',
                    zIndex: isLastActivity ? 25 : 20, // Höherer z-Index für bessere Sichtbarkeit
                    // Füge einen Schatten hinzu, der mit der Aktivitätsfarbe übereinstimmt
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isLastActivity ? 0.5 : 0.3,
                    shadowRadius: isLastActivity ? 5 : 3,
                    elevation: isLastActivity ? 8 : 5,
                  }
                ]}
                onPress={() => {
                  setSelectedEntry(entry);
                  setModalVisible(true);
                }}
              >
                <IconSymbol
                  name={getActivityIcon(entry.entry_type)}
                  size={isLastActivity ? 28 : 24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {/* Zeitanzeige für ausgewählte Aktivitäten */}
              {isLastActivity && (
                <View
                  style={[
                    styles.timeLabelContainer,
                    timeLabelPosition,
                    {
                      zIndex: 40, // Höchster z-Index für die Zeitanzeige
                      backgroundColor: 'rgba(255, 255, 255, 0.98)', // Noch undurchsichtiger für bessere Lesbarkeit
                      borderWidth: 1.5, // Dickerer Rand für bessere Sichtbarkeit
                      borderColor: color, // Farbiger Rand passend zur Aktivität
                    }
                  ]}
                >
                  <ThemedText style={[
                    styles.timeLabel,
                    { fontWeight: '700', color: textColor } // Fetter für bessere Lesbarkeit
                  ]}>
                    {timeLabel}
                  </ThemedText>
                </View>
              )}
            </View>
          );
        } catch (error) {
          console.log('Fehler beim Rendern eines Aktivitätspunkts:', error);
          return null;
        }
      }).filter(Boolean); // Filtere null-Werte heraus
    } catch (error) {
      console.log('Fehler beim Rendern der Aktivitätspunkte:', error);
      return null;
    }
  };

  // Wir entfernen die Stundenmarkierungen und die aktuelle Zeit-Anzeige,
  // da sie im neuen Design nicht mehr benötigt werden

  // Rendere das Detail-Modal
  const renderDetailModal = () => {
    if (!selectedEntry) return null;

    const color = getActivityColor(selectedEntry.entry_type);
    const icon = getActivityIcon(selectedEntry.entry_type);
    const activityText = getActivityText(selectedEntry.entry_type);
    const duration = calculateDuration(selectedEntry.start_time, selectedEntry.end_time);

    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { backgroundColor: color }]}>
              <IconSymbol name={icon} size={24} color="#FFFFFF" />
              <ThemedText style={styles.modalTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">
                {activityText}
              </ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.modalRow}>
                <ThemedText style={[styles.modalLabel, { color: labelColor }]}>Zeit:</ThemedText>
                <ThemedText style={[styles.modalValue, { color: modalValueColor }]}>
                  {selectedEntry.start_time && formatTime(selectedEntry.start_time)}
                  {selectedEntry.end_time && ` - ${formatTime(selectedEntry.end_time)}`}
                </ThemedText>
              </View>

              {duration > 0 && (
                <View style={styles.modalRow}>
                  <ThemedText style={[styles.modalLabel, { color: labelColor }]}>Dauer:</ThemedText>
                  <ThemedText style={[styles.modalValue, { color: modalValueColor }]}>{duration} Minuten</ThemedText>
                </View>
              )}

              {selectedEntry.notes && (
                <View style={styles.modalRow}>
                  <ThemedText style={[styles.modalLabel, { color: labelColor }]}>Notizen:</ThemedText>
                  <ThemedText style={[styles.modalValue, { color: modalValueColor }]}>{selectedEntry.notes}</ThemedText>
                </View>
              )}

              {onDeleteEntry && selectedEntry.id && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setModalVisible(false);
                    // Verzögerung, um sicherzustellen, dass das Modal geschlossen ist, bevor wir löschen
                    setTimeout(() => {
                      if (selectedEntry && selectedEntry.id) {
                        onDeleteEntry(selectedEntry.id);
                      }
                    }, 300);
                  }}
                >
                  <IconSymbol name="trash" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.deleteButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                    Löschen
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Finde die letzte Aktivität mit Fehlerbehandlung
  let lastActivity = null;
  try {
    if (entries.length > 0) {
      // Filtere ungültige Einträge heraus
      const validEntries = entries.filter(entry => entry && entry.id && entry.start_time);

      if (validEntries.length > 0) {
        lastActivity = validEntries.reduce((latest, current) => {
          try {
            if (!latest.start_time || !current.start_time) return latest;
            return new Date(current.start_time) > new Date(latest.start_time) ? current : latest;
          } catch (error) {
            console.log('Fehler beim Vergleich der Aktivitätszeiten:', error);
            return latest;
          }
        }, validEntries[0]);
      }
    }
  } catch (error) {
    console.log('Fehler beim Finden der letzten Aktivität:', error);
    lastActivity = null;
  }

  // Berechne die Zeit seit der letzten Aktivität und bestimme die Farbe basierend auf der verstrichenen Zeit
  const getTimeSinceLastActivity = (entry = lastActivity) => {
    try {
      if (!entry || !entry.start_time) return { text: "Keine Aktivität", color: "#3B3B3B" };

      const now = new Date();
      const lastTime = new Date(entry.start_time);

      // Prüfe, ob das Datum gültig ist
      if (isNaN(lastTime.getTime())) {
        console.log('Ungültiges Datum für Aktivität:', entry.id);
        return { text: "Ungültiges Datum", color: "#3B3B3B" };
      }

      const diffMinutes = Math.floor((now.getTime() - lastTime.getTime()) / (1000 * 60));

      // Bestimme die Farbe basierend auf der verstrichenen Zeit
      let color = "#4CAF50"; // Grün für kürzlich (< 1 Stunde)

      if (diffMinutes >= 180) { // > 3 Stunden
        color = "#F44336"; // Rot
      } else if (diffMinutes >= 120) { // > 2 Stunden
        color = "#FF9800"; // Orange
      } else if (diffMinutes >= 60) { // > 1 Stunde
        color = "#FFC107"; // Gelb
      }

      // Formatiere die Zeit als "Vor X Minuten" oder "Letzte Aktivität: HH:MM Uhr"
      let text;
      try {
        if (diffMinutes < 60) {
          text = `Vor ${diffMinutes} Minuten`;
        } else {
          // Formatiere die Uhrzeit
          const timeStr = lastTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          text = `${timeStr} Uhr`;
        }
      } catch (error) {
        console.log('Fehler bei der Zeitformatierung:', error);
        text = "Fehler bei Zeitberechnung";
      }

      return { text, color };
    } catch (error) {
      console.log('Fehler bei der Berechnung der Zeit seit der letzten Aktivität:', error);
      return { text: "Fehler", color: "#3B3B3B" };
    }
  };

  // Bestimme den Text und die Farbe für die zentrale Anzeige
  const getCenterText = () => {
    try {
      if (!lastActivity) return { label: "Keine Aktivität", value: "", color: "#3B3B3B" };

      const timeInfo = getTimeSinceLastActivity(lastActivity);

      // Fallback-Werte für den Fall, dass timeInfo ungültig ist
      if (!timeInfo || typeof timeInfo !== 'object') {
        return { label: "Fehler", value: "", color: "#3B3B3B" };
      }

      try {
        switch (lastActivity.entry_type) {
          case 'sleep':
            return {
              label: "Schläft seit",
              value: timeInfo.text,
              color: timeInfo.color
            };
          case 'feeding':
            return {
              label: "Letzte Fütterung:",
              value: timeInfo.text,
              color: timeInfo.color
            };
          case 'diaper':
            return {
              label: "Zuletzt gewickelt:",
              value: timeInfo.text,
              color: timeInfo.color
            };
          default:
            return {
              label: "Letzte Aktivität:",
              value: timeInfo.text,
              color: timeInfo.color
            };
        }
      } catch (error) {
        console.log('Fehler bei der Bestimmung des Aktivitätstyps:', error);
        return {
          label: "Letzte Aktivität:",
          value: timeInfo.text || "",
          color: timeInfo.color || "#3B3B3B"
        };
      }
    } catch (error) {
      console.log('Fehler bei der Bestimmung des zentralen Texts:', error);
      return { label: "Fehler", value: "", color: "#3B3B3B" };
    }
  };

  try {
    // Hole den zentralen Text einmal, um ihn nicht mehrfach zu berechnen
    const centerTextInfo = getCenterText();

    return (
      <View style={[styles.container, isDark && { backgroundColor: Colors.dark.cardLight, borderColor: Colors.dark.border }]}>
        <View style={styles.circleContainer}>
          {/* Halbkreis-Hintergrund */}
          <View style={styles.circleTrack}>
            {/* Sonne-Icon links */}
            <View style={styles.sunIconContainer}>
              <View style={styles.iconBackground}>
                <IconSymbol name="sun.max.fill" size={28} color="#FFA726" />
              </View>
            </View>

            {/* Mond-Icon rechts */}
            <View style={styles.moonIconContainer}>
              <View style={styles.iconBackground}>
                <IconSymbol name="moon.fill" size={28} color="#5C6BC0" />
              </View>
            </View>
          </View>

          {/* Aktivitätspunkte */}
          {renderActivityDots()}

          {/* Zentrum und Beschriftung */}
          <View style={[styles.centerContent, isDark && { backgroundColor: Colors.dark.cardLight }]}>
            <ThemedText style={[styles.centerLabel, { color: textColor }]}>
              {centerTextInfo.label}
            </ThemedText>
            <ThemedText
              style={[
                styles.centerValue,
                { color: centerTextInfo.color } // Dynamische Farbe basierend auf der verstrichenen Zeit
              ]}
            >
              {centerTextInfo.value}
            </ThemedText>
          </View>
        </View>

        {/* Detail-Modal */}
        {renderDetailModal()}
      </View>
    );
  } catch (error) {
    console.log('Fehler beim Rendern der CircularDayView:', error);
    // Fallback-Rendering im Fehlerfall
    return (
      <View style={[styles.container, isDark && { backgroundColor: Colors.dark.cardLight, borderColor: Colors.dark.border }]}>
        <View style={styles.circleContainer}>
          <View style={[styles.centerContent, isDark && { backgroundColor: Colors.dark.cardLight }]}>
            <ThemedText style={[styles.centerLabel, { color: textColor }]}>
              Fehler beim Laden
            </ThemedText>
            <ThemedText style={[styles.centerValue, { color: textColor }]}>
              Bitte App neu starten
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Weißer Hintergrund für Card-Stil
    padding: 10,
    borderRadius: 16, // Abgerundete Ecken
    margin: 10, // Etwas Abstand zum Rand
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.1)',
  },
  // TopBar-Styles wurden entfernt, da die TopBar nicht mehr benötigt wird
  circleContainer: {
    position: 'relative',
    width: Dimensions.get('window').width - 30, // Noch etwas größer
    height: (Dimensions.get('window').width - 30) / 2, // Halbkreis-Höhe
    alignSelf: 'center',
    marginVertical: 10, // Weniger vertikaler Abstand
  },
  circleTrack: {
    position: 'absolute',
    width: '100%',
    height: '100%', // Volle Höhe des Containers (der bereits ein Halbkreis ist)
    borderTopLeftRadius: 1000, // Sehr großer Wert für perfekten Kreis
    borderTopRightRadius: 1000,
    borderBottomLeftRadius: 0, // Keine Rundung unten
    borderBottomRightRadius: 0,
    borderWidth: 25,
    borderBottomWidth: 0, // Kein Rand unten
    borderColor: 'rgba(125, 90, 80, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 5, // Niedriger z-Index, damit Aktivitätspunkte darüber liegen
  },
  sunIconContainer: {
    position: 'absolute',
    left: 5,
    top: '50%',
    transform: [{ translateY: -15 }], // Angepasst für Position am Rand des Halbkreises
    zIndex: 30, // Noch höherer z-Index für bessere Sichtbarkeit
  },
  moonIconContainer: {
    position: 'absolute',
    right: 5,
    top: '50%',
    transform: [{ translateY: -15 }], // Angepasst für Position am Rand des Halbkreises
    zIndex: 30, // Noch höherer z-Index für bessere Sichtbarkeit
  },
  iconBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Weißer Hintergrund für bessere Sichtbarkeit
    borderRadius: 15,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  centerContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 0, // Kein zusätzlicher Platz nach unten
    backgroundColor: '#FFFFFF', // Weißer Hintergrund für bessere Lesbarkeit
    borderRadius: 1000,
    margin: 25, // Passend zur Breite des Tracks
    // Nur die obere Hälfte des Kreises anzeigen
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    height: '100%', // Volle Höhe des Containers (der bereits ein Halbkreis ist)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.1)',
  },
  centerLabel: {
    fontSize: 18,
    // color wird dynamisch gesetzt
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500', // Regular
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  centerValue: {
    fontSize: 36,
    fontWeight: '600', // Semibold
    // color wird dynamisch gesetzt
    textAlign: 'center',
    marginTop: 5,
    letterSpacing: 1, // Mehr Abstand zwischen den Zeichen für bessere Lesbarkeit
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  activityDot: {
    position: 'absolute',
    width: 40, // Etwas kleiner für bessere Platzierung auf dem Ring
    height: 40, // Etwas kleiner für bessere Platzierung auf dem Ring
    borderRadius: 20, // Angepasst an die Größe
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2, // Dünnerer Rand für bessere Platzierung
    borderColor: 'rgba(255, 255, 255, 0.9)', // Weißer Rand für besseren Kontrast
  },
  timeLabelContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Fast undurchsichtiger Hintergrund
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 60, // Breiter für bessere Lesbarkeit
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 40, // Höchster z-Index für die Zeitanzeige
  },
  timeLabel: {
    fontSize: 14, // Etwas kleinere Schrift für bessere Platzierung
    fontWeight: '600',
    // color wird dynamisch gesetzt
    textAlign: 'center',
  },
  // BottomBar-Styles wurden entfernt, da die BottomBar nicht mehr benötigt wird
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF', // Heller Hintergrund passend zum App-Design
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 15,
  },
  modalRow: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    // color wird dynamisch gesetzt
    opacity: 0.8,
  },
  modalValue: {
    fontSize: 16,
    // color wird dynamisch gesetzt
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  deleteButtonText: {
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#FFFFFF',
  },
});

export default CircularDayView;
