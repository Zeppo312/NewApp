import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, Text, ScrollView, Platform, Alert, TextInput, Dimensions, PanResponder, Animated, RefreshControl, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { Colors, CardBg, CardBorder, Shadow, QualityColors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import EntryCard from '@/components/ui/EntryCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { startSleepTracking as startSleepNotification, stopSleepTracking as stopSleepNotification, updateSleepTracking, isTrackingActive, initNotifications } from '@/lib/sleepNotificationUtils';

// Originale sleep-functions als Fallback importieren
import {
  startSleepTracking,
  stopSleepTracking,
  updateSleepEntry,
  deleteSleepEntry,
  checkForActiveSleepEntry,
  getLinkedUsersWithDetails
} from '@/lib/sleepData';

// Verbesserte Versionen der Funktionen importieren
import {
  loadAllSleepEntries,
  syncAllSleepEntries,
  loadConnectedUsers,
  shareSleepEntryImproved,
  unshareSleepEntryImproved,
  activateRealtimeSync,
  deactivateRealtimeSync
} from '@/lib/improvedSleepSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, formatDistance, startOfDay, endOfDay, isToday, parseISO, isWithinInterval, getHours, addDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G, Text as SvgText, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import Header from '@/components/Header';
import CalendarHeatmap from '../../components/CalendarHeatmap';


// Konfigurationskonstanten für die Timeline
const HOURS_IN_DAY = 24;
const TIMELINE_HEIGHT = 120;
const HOUR_WIDTH = 60; // Breite einer Stunde in der Zeitachse
const TOTAL_WIDTH = HOURS_IN_DAY * HOUR_WIDTH;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Konstanten für die kreisförmige Darstellung
const CIRCLE_RADIUS = (SCREEN_WIDTH - 80) / 2; // Kleiner machen (was (SCREEN_WIDTH - 60) / 2)
const CIRCLE_CENTER = CIRCLE_RADIUS + 40; // Anpassen (war CIRCLE_RADIUS + 30)
const STROKE_WIDTH = 30;
const INNER_RADIUS = CIRCLE_RADIUS - STROKE_WIDTH / 2;
const OUTER_RADIUS = CIRCLE_RADIUS + STROKE_WIDTH / 2;

// Exportiere den Qualitätstyp, damit er in der ganzen Datei konsistent verwendet werden kann
type SleepQuality = 'good' | 'medium' | 'bad' | null;

// Definiere Interface für einen Schlafeintrag mit verbesserten Datums-Typen
interface SleepEntry {
  id?: string;
  user_id?: string;
  start_time: Date;  // Immer als Date-Objekt verwenden
  end_time: Date | null;
  duration_minutes?: number;
  notes?: string;
  quality?: SleepQuality;
  created_at?: Date | string; // Erlaubt sowohl Date-Objekte als auch Strings
  external_id?: string; // ID des ursprünglichen Eintrags für synchronisierte Einträge
  synced_at?: Date | string | null; // Zeitpunkt der letzten Synchronisierung
  shared_with_user_id?: string | null; // ID des Benutzers, mit dem der Eintrag geteilt wird
  updated_at?: Date | string; // Hinzugefügt für Kompatibilität
  updated_by?: string | null; // Benutzer, der zuletzt aktualisiert hat
  owner_name?: string; // Hinzugefügt für Kompatibilität
  partner_id?: string | null; // Partner-ID für die Synchronisierung
}

// Definiere Interface für geplotteten Schlafeintrag
interface SleepSession {
  id: string;
  startTime: string;
  endTime: string;
  duration: string;
  durationMinutes: number;
  quality: SleepQuality;
  notes: string;
  rawStartTime: Date;
  rawEndTime: Date;
  importedFromUserId?: string | null;
  userId?: string;
  externalId?: string | null;
  syncedAt?: Date | null;
  isExpanded?: boolean;
  creatorName?: string; // Name des Erstellers
  isShared?: boolean;   // Flag, ob der Eintrag geteilt ist
  sharedWithUserId?: string | null; // ID des geteilten Benutzers
}

// Definiere das Interface für die Synchronisierungsrückgabe
interface SyncResult {
  success: boolean;
  error?: string;
  message?: string;
  details?: unknown;
  syncedItems?: number; // Anzahl der synchronisierten Einträge
  role?: string; // Optionaler Rollenname
}

// Helfer-Funktion, um die Farbe für eine Qualität zu bekommen - vereinfachte Version
const getQualityColor = (q: SleepQuality) => {
  // Mit Nullprüfung, um TypeScript-Fehler zu vermeiden
  const quality = q === null ? 'unknown' : q;
  return QualityColors[quality];
};

// Funktion zum Rendern der Qualitätsanzeige
const renderQualityBadge = (quality: SleepQuality) => {
  // Wenn quality null ist, zeigen wir keine Badge an
  if (quality === null) return null;
  
  const getText = () => {
    const qualityTexts = {
      'good': 'Gut',
      'medium': 'Mittel',
      'bad': 'Schlecht'
    };
    return qualityTexts[quality] || 'Gut';
  };
  
  return (
    <View style={[styles.qualityBadge, { backgroundColor: getQualityColor(quality) }]}>
      <Text style={styles.qualityBadgeText}>{getText()}</Text>
    </View>
  );
};

export default function SleepTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  // State for Tracking
  const [isTracking, setIsTracking] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<SleepEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // In Sekunden
  const [sleepEntries, setSleepEntries] = useState<SleepSession[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<'good' | 'medium' | 'bad'>('good');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [totalSleepToday, setTotalSleepToday] = useState(0); // In Minuten
  const [averageSleepDuration, setAverageSleepDuration] = useState(0); // In Minuten
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayViewSessions, setDayViewSessions] = useState<SleepSession[]>([]);
  const [selectedSleepEntry, setSelectedSleepEntry] = useState<SleepSession | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [timelineDate, setTimelineDate] = useState(new Date());
  const [timelineZoom, setTimelineZoom] = useState(1); // Zoomfaktor: 1 = normale Ansicht, >1 = gezoomt
  const [panEnabled, setPanEnabled] = useState(true);
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'connected' | 'not_connected'>('loading');
  const [debugMode, setDebugMode] = useState(false); // Für Entwicklungszwecke
  const [refreshing, setRefreshing] = useState(false);
  const [groupedEntries, setGroupedEntries] = useState<Record<string, SleepSession[]>>({}); // Setze leeres Objekt als Initialwert
  const [showInfoPopup, setShowInfoPopup] = useState(false); // Neuer State für das Info-PopUp
  
  // New state for sync functionality
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ 
    lastSync?: Date,
    syncedCount?: number,
    message?: string,
    error?: string 
  } | null>(null);
  
  const timerRef = useRef<number | null>(null);
  
  // Animierter Wert für horizontales Scrollen der Timeline
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Tag und Nacht Zeiten (vereinfacht)
  const dayStartHour = 6; // 6 Uhr morgens
  const dayEndHour = 20; // 8 Uhr abends
  
  // PanResponder für die interaktive Timeline
  const timelinePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Verwende extractOffset statt setOffset
        scrollX.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        if (panEnabled) {
          // Verschiebe basierend auf dx direkt
          scrollX.setValue(-gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        scrollX.flattenOffset();
      }
    })
  ).current;

  // Funktion zum Zoomen der Timeline
  const handleZoom = (factor: number) => {
    let newZoom = timelineZoom * factor;
    // Begrenze den Zoom auf sinnvolle Werte
    newZoom = Math.max(0.5, Math.min(newZoom, 3));
    setTimelineZoom(newZoom);
  };

  // Funktion zum Ändern des angezeigten Tages
  const changeTimelineDate = (days: number) => {
    const newDate = days > 0 ? addDays(timelineDate, days) : subDays(timelineDate, Math.abs(days));
    setTimelineDate(newDate);
    // Aktualisiere die Ansicht mit neuem Datum
    const filteredSessions = sleepEntries.filter(session => {
      return isWithinInterval(session.rawStartTime, {
        start: startOfDay(newDate),
        end: endOfDay(newDate)
      });
    });
    setDayViewSessions(filteredSessions);
  };

  // Funktion zum Berechnen der Koordinaten auf dem Kreis
  const calculatePointOnCircle = (angle: number, radius: number) => {
    // Konvertiere von Stunden (0-24) zu Winkeln (0-360)
    // Beachte: Bei einer Uhr startet 0 Uhr oben (bei -90° bzw. 270°)
    const adjustedAngle = (angle * 15) - 90;
    const angleInRadians = (adjustedAngle * Math.PI) / 180;
    const x = CIRCLE_CENTER + radius * Math.cos(angleInRadians);
    const y = CIRCLE_CENTER + radius * Math.sin(angleInRadians);
    return { x, y };
  };
  
  // Funktion zum Berechnen eines Punktes vom Zentrum aus in Richtung eines Winkels mit bestimmtem Radius
  const calculatePointFromCenter = (hourAngle: number, radius: number) => {
    return calculatePointOnCircle(hourAngle, radius);
  };
  
  // Funktion zum Erstellen eines Kreisbogens
  const createArc = (startHour: number, endHour: number, color: string) => {
    // Übernacht-Schlafphasen berücksichtigen
    if (endHour < startHour) {
      endHour += 24;
    }
    
    // Konvertiere von Stunden zu Winkeln (0-360)
    const startAngle = (startHour * 15) - 90;
    const endAngle = (endHour * 15) - 90;
    
    // Berechne Punkte für SVG-Pfad
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const startX = CIRCLE_CENTER + OUTER_RADIUS * Math.cos(startRad);
    const startY = CIRCLE_CENTER + OUTER_RADIUS * Math.sin(startRad);
    const endX = CIRCLE_CENTER + OUTER_RADIUS * Math.cos(endRad);
    const endY = CIRCLE_CENTER + OUTER_RADIUS * Math.sin(endRad);
    
    const startXInner = CIRCLE_CENTER + INNER_RADIUS * Math.cos(startRad);
    const startYInner = CIRCLE_CENTER + INNER_RADIUS * Math.sin(startRad);
    const endXInner = CIRCLE_CENTER + INNER_RADIUS * Math.cos(endRad);
    const endYInner = CIRCLE_CENTER + INNER_RADIUS * Math.sin(endRad);
    
    // Berechne ob der Bogen größer als 180 Grad ist (large-arc-flag)
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    // Erstelle SVG-Pfad
    const path = `
      M ${startX} ${startY}
      A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArcFlag} 1 ${endX} ${endY}
      L ${endXInner} ${endYInner}
      A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArcFlag} 0 ${startXInner} ${startYInner}
      Z
    `;
    
    return { path, color };
  };
  
  // Rendere die kreisförmige Tagesansicht
  const renderCircularDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const sleepArcs = dayViewSessions.map((session, index) => {
      const startHour = session.rawStartTime.getHours() + session.rawStartTime.getMinutes() / 60;
      const endHour = session.rawEndTime.getHours() + session.rawEndTime.getMinutes() / 60;
      const barColor = getQualityColor(session.quality);
      
      // Erstelle basic arc
      const arc = createArc(startHour, endHour, barColor);
      
      // Füge Informationen über den Ersteller hinzu
      return {
        ...arc,
        id: session.id || index.toString(),
        session,
        isPartnerEntry: session.creatorName !== "Du",
      };
    });
    
    // Aktuelle Zeit
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const currentPoint = calculatePointOnCircle(currentHour, CIRCLE_RADIUS);
    const clockCenterPoint = { x: CIRCLE_CENTER, y: CIRCLE_CENTER };
    
    return (
      <View style={styles.circleContainer}>
        <Svg width={CIRCLE_CENTER * 2} height={CIRCLE_CENTER * 2 + 40}>
          {/* Hintergrund mit Sternen */}
          <Defs>
            <RadialGradient id="nightSkyGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor="#1A1351" />
              <Stop offset="100%" stopColor="#0E0B28" />
            </RadialGradient>
          </Defs>
          <Circle 
            cx={CIRCLE_CENTER} 
            cy={CIRCLE_CENTER} 
            r={OUTER_RADIUS + 40}
            fill="url(#nightSkyGradient)"
          />
          
          {/* Kleine Sterne im Hintergrund als einfache Kreise */}
          {Array.from({ length: 30 }).map((_, i) => {
            // Zufällige Position für Sterne
            const x = 20 + Math.random() * (CIRCLE_CENTER * 2 - 40);
            const y = 20 + Math.random() * (CIRCLE_CENTER * 2 - 40);
            // Zufällige Größe und Transparenz
            const size = 1 + Math.random() * 2;
            const opacity = 0.3 + Math.random() * 0.7;
            
            return (
              <Circle 
                key={`star-${i}`}
                cx={x}
                cy={y}
                r={size}
                fill="#FFFFFF"
                opacity={opacity}
              />
            );
          })}
          
          {/* Größere funkelnde Sterne als Kreuz-Linien */}
          {Array.from({ length: 10 }).map((_, i) => {
            const x = 30 + Math.random() * (CIRCLE_CENTER * 2 - 60);
            const y = 30 + Math.random() * (CIRCLE_CENTER * 2 - 60);
            const rotation = Math.random() * 45;
            
            return (
              <G 
                key={`big-star-${i}`}
                rotation={rotation}
                origin={`${x}, ${y}`}
                opacity={0.5 + Math.random() * 0.5}
              >
                <Line
                  x1={x - 4}
                  y1={y}
                  x2={x + 4}
                  y2={y}
                  stroke="#A9BDFC"
                  strokeWidth={1}
                />
                <Line
                  x1={x}
                  y1={y - 4}
                  x2={x}
                  y2={y + 4}
                  stroke="#A9BDFC"
                  strokeWidth={1}
                />
              </G>
            );
          })}
          
          {/* Grundlegender 24-Stunden-Kreis */}
          <Circle 
            cx={CIRCLE_CENTER} 
            cy={CIRCLE_CENTER} 
            r={CIRCLE_RADIUS}
            fill="transparent"
            stroke={colorScheme === 'dark' ? "#303751" : "#E9E5FF"}
            strokeWidth={STROKE_WIDTH}
          />
          
          {/* Tag/Nacht-Indikatoren - deutlichere Darstellung */}
          {/* Nachtphase 1 (0-6 Uhr) */}
          {createArc(0, 6, "rgba(25, 25, 112, 0.3)").path && (
            <Path 
              d={createArc(0, 6, "rgba(25, 25, 112, 0.3)").path} 
              fill="rgba(25, 25, 112, 0.3)"
            />
          )}
          
          {/* Tagphase (6-18 Uhr) */}
          {createArc(6, 18, "rgba(255, 220, 155, 0.4)").path && (
            <Path 
              d={createArc(6, 18, "rgba(255, 220, 155, 0.4)").path} 
              fill="rgba(255, 220, 155, 0.4)"
            />
          )}
          
          {/* Nachtphase 2 (18-24 Uhr) */}
          {createArc(18, 24, "rgba(25, 25, 112, 0.3)").path && (
            <Path 
              d={createArc(18, 24, "rgba(25, 25, 112, 0.3)").path} 
              fill="rgba(25, 25, 112, 0.3)"
            />
          )}
          
          {/* Schlafphasen als Bögen */}
          {sleepArcs.map((arc, index) => (
            <G key={`sleep-arc-${arc.id}`}>
              <Path 
                d={arc.path} 
                fill={arc.color}
                onPress={() => showSleepEntryDetails(arc.session)}
              />
              {/* Zeige einen Indikator für Partnereinträge */}
              {arc.isPartnerEntry && (
                <Path 
                  d={arc.path} 
                  fill="none"
                  stroke="rgba(63, 81, 181, 0.9)"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  onPress={() => showSleepEntryDetails(arc.session)}
                />
              )}
            </G>
          ))}
          
          {/* Mond und Sonne als Emojis in der Mitte des Rings platzieren */}
          <SvgText 
            x={calculatePointOnCircle(0, (INNER_RADIUS + OUTER_RADIUS) / 2).x}
            y={calculatePointOnCircle(0, (INNER_RADIUS + OUTER_RADIUS) / 2).y + 5}
            fontSize={20}
            textAnchor="middle"
            fontFamily="System"
          >
            🌙
          </SvgText>
          
          <SvgText 
            x={calculatePointOnCircle(12, (INNER_RADIUS + OUTER_RADIUS) / 2).x}
            y={calculatePointOnCircle(12, (INNER_RADIUS + OUTER_RADIUS) / 2).y + 5}
            fontSize={20}
            textAnchor="middle"
            fontFamily="System"
          >
            ☀️
          </SvgText>
          
          {/* Aktueller Zeitzeiger (wenn heute angezeigt wird) - VOR Button platzieren, damit er dahinter liegt */}
          {isToday(timelineDate) && (
            <G>
              {/* Linie vom Rand des Buttons zum Rand des Kreises ziehen */}
              <Line
                x1={calculatePointFromCenter(currentHour, CIRCLE_RADIUS - STROKE_WIDTH - 45).x}
                y1={calculatePointFromCenter(currentHour, CIRCLE_RADIUS - STROKE_WIDTH - 45).y}
                x2={currentPoint.x}
                y2={currentPoint.y}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <Circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={5}
                fill="#FFFFFF"
                stroke="#0E0B28"
                strokeWidth={1}
              />
            </G>
          )}
          
          {/* Stunden-Markierungen durch vier Uhrzeiten ersetzen */}
          {[0, 6, 12, 18].map(hour => {
            const textPoint = calculatePointOnCircle(hour, CIRCLE_RADIUS - STROKE_WIDTH / 2 - 20);
            
            return (
              <G key={`hour-${hour}`}>
                <SvgText
                  x={textPoint.x}
                  y={textPoint.y}
                  fill="#FFFFFF"
                  opacity={0.9}
                  fontSize={14}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {`${hour}:00`}
                </SvgText>
              </G>
            );
          })}
          
          {/* Mittiger Button - kleiner */}
          <Circle
            cx={CIRCLE_CENTER}
            cy={CIRCLE_CENTER}
            r={CIRCLE_RADIUS - STROKE_WIDTH - 45}
            fill={isTracking ? "rgba(255, 107, 107, 0.2)" : "rgba(58, 158, 140, 0.2)"}
            onPress={isTracking ? handleStopSleepTracking : handleStartSleepTracking}
          />
          <SvgText
            x={CIRCLE_CENTER}
            y={CIRCLE_CENTER - 10}
            fill="#F4F0E5"
            fontSize={16}
            fontWeight="bold"
            textAnchor="middle"
            onPress={isTracking ? handleStopSleepTracking : handleStartSleepTracking}
          >
            {isTracking ? "Aufzeichnung" : "Schlafaufzeichnung"}
          </SvgText>
          <SvgText
            x={CIRCLE_CENTER}
            y={CIRCLE_CENTER + 15}
            fill="#F4F0E5"
            fontSize={16}
            fontWeight="bold"
            textAnchor="middle"
            onPress={isTracking ? handleStopSleepTracking : handleStartSleepTracking}
          >
            {isTracking ? "beenden" : "starten"}
          </SvgText>
          
          {/* Timer bei aktiver Aufzeichnung */}
          {isTracking && currentEntry && (
            <SvgText
              x={CIRCLE_CENTER}
              y={CIRCLE_CENTER + 45}
              fill="#FFFFFF"
              fontSize={14}
              opacity={0.7}
              textAnchor="middle"
            >
              {formatTime(elapsedTime)}
            </SvgText>
          )}
        </Svg>
        
        {/* Legende für Schlafqualität */}
        <View style={styles.circularLegend}>
          <View style={styles.legendItems}>
            {(['good', 'medium', 'bad'] as const).map(q => (
              <View key={q} style={styles.legendCircleItem}>
                <View 
                  style={[
                    styles.legendCircleColor, 
                    { backgroundColor: getQualityColor(q) }
                  ]} 
                />
                <Text style={styles.legendTextCircle}>
                  {q === 'good' ? 'Gut' : q === 'medium' ? 'Mittel' : 'Schlecht'}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Neue Legende für Partnereinträge */}
          <View style={styles.partnerLegendItem}>
            <View style={styles.partnerLegendLine} />
            <Text style={styles.legendTextCircle}>Partnereintrag</Text>
          </View>
        </View>
      </View>
    );
  };

  // Effekt für den Timer
  useEffect(() => {
    if (isTracking && currentEntry) {
      timerRef.current = setInterval(() => {
        const startTime = currentEntry.start_time.getTime();
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000) as unknown as number;
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTracking, currentEntry]);

  // Automatisiere alles beim App-Start mit verbesserter Synchronisierung
  useEffect(() => {
    if (user) {
      console.log('SleepTracker: App startet, user ist angemeldet');
      
      // Automatische Synchronisierung beim Start ausführen und dann Daten laden
      const initializeApp = async () => {
        try {
          setIsSyncing(true);
          
          // Zuerst Daten synchronisieren
          const syncResult = await syncAllSleepEntries();
          
          if (syncResult.success) {
            console.log(`Synchronisierung erfolgreich: ${syncResult.syncedCount || 0} Einträge synchronisiert`);
            setSyncInfo({
              lastSync: new Date(),
              syncedCount: syncResult.syncedCount || 0,
              message: syncResult.message
            });
          } else {
            console.error('Fehler bei der initialen Synchronisierung:', syncResult.error);
            setSyncInfo({
              lastSync: new Date(),
              error: syncResult.error
            });
          }
          
          // Nach der Synchronisierung Daten laden
          await loadSleepData();
          
          // Verknüpfte Benutzer laden
          await loadConnectedUsersData();
          
          // Prüfe auf aktiven Eintrag
          await checkForActiveEntry();
          
        } catch (error) {
          console.error('Fehler beim Initialisieren der App:', error);
        } finally {
          setIsSyncing(false);
        }
      };
      
      // Aktiviere die Echtzeit-Synchronisierung beim App-Start
      activateRealtimeSync((payload) => {
        console.log('Echtzeit-Update empfangen:', payload);
        // Aktualisiere die Daten, wenn Änderungen auftreten
        loadSleepData();
      });
      
      // Starte den Initialisierungsprozess
      initializeApp();
    } else {
      console.log('SleepTracker: App startet, kein User angemeldet');
    }
    
    // Bereinige die Realtime-Subscriptions beim Beenden
    return () => {
      deactivateRealtimeSync();
    };
  }, [user]);
  

  
  // Funktion zum Laden der verbundenen Benutzer mit der verbesserten Implementierung
  const loadConnectedUsersData = async () => {
    setConnectionStatus('loading');
    try {
      // Verwende die verbesserte Funktion zum Laden der verbundenen Benutzer
      const result = await loadConnectedUsers();
      
      if (result.success && result.linkedUsers) {
        setConnectedUsers(result.linkedUsers);
        setConnectionStatus(result.linkedUsers.length > 0 ? 'connected' : 'not_connected');
        console.log(`Loaded ${result.linkedUsers.length} connected users using method: ${result.methodUsed}`);
      } else {
        setConnectionStatus('not_connected');
        console.error('Fehler beim Laden der verbundenen Benutzer:', result.error);
      }
    } catch (error) {
      setConnectionStatus('not_connected');
      console.error('Unbehandelte Ausnahme beim Laden der verbundenen Benutzer:', error);
    }
  };

  // Verbesserte Funktion zum Laden verbundener Benutzer
  const loadConnectedUsers = async () => {
    if (!user) return;
    
    setConnectionStatus('loading');
    
    try {
      const { success, linkedUsers, error } = await getLinkedUsersWithDetails();
      
      if (!success) {
        console.error('Fehler beim Laden der verknüpften Benutzer:', error);
        setConnectedUsers([]);
        setConnectionStatus('not_connected');
        return;
      }
      
      setConnectedUsers(linkedUsers || []);
      setConnectionStatus(linkedUsers && linkedUsers.length > 0 ? 'connected' : 'not_connected');
      
      // Wenn verbundene Benutzer vorhanden sind und nicht bereits synchronisiert wird,
      // starten wir die Synchronisierung
      if (linkedUsers && linkedUsers.length > 0 && !isSyncing) {
        await syncSleepEntries();
      }
    } catch (error) {
      console.error('Fehler beim Laden der verknüpften Benutzer:', error);
      setConnectedUsers([]);
      setConnectionStatus('not_connected');
    }
  };

  // Add subscription to real-time updates for sleep entries
  useEffect(() => {
    if (!user) return;

    // Subscribe to changes in sleep_entries that involve this user
    const subscription = supabase
      .channel('sleep_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sleep_entries',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Schlafeintrag geändert:', payload);
          loadSleepData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sleep_entries',
          filter: `shared_with_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Geteilter Schlafeintrag geändert:', payload);
          loadSleepData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  // Initialisiere Benachrichtigungen, wenn die App startet
  useEffect(() => {
    initNotifications();
  }, []);

  // AppState-Listener für Hintergrund-/Vordergrund-Wechsel
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isTracking && currentEntry) {
        // App wurde wieder in den Vordergrund gebracht während Tracking läuft
        // Aktualisiere den UI-Timer
        const startTime = new Date(currentEntry.start_time).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsedSeconds);
        
        // Aktualisiere auch die Benachrichtigung
        updateSleepTracking();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isTracking, currentEntry]);

  // Überprüfen, ob ein aktiver Schlafeintrag vorhanden ist
  const checkForActiveEntry = async () => {
    try {
      if (!user) return;

      // Prüfe erst lokalen Speicher
      const localData = await AsyncStorage.getItem('activeSleepEntry');
      if (localData) {
        const parsedData = JSON.parse(localData);
        // Konvertiere das Objekt in den richtigen Typ mit expliziter Typisierung
        const typedEntry: SleepEntry = {
          ...parsedData,
          start_time: new Date(parsedData.start_time),
          end_time: parsedData.end_time ? new Date(parsedData.end_time) : null
        };
        setCurrentEntry(typedEntry);
        setIsTracking(true);
        setActiveEntryId(parsedData.id);
        
        // Stelle auch sicher, dass die Benachrichtigung aktiv ist
        if (await isTrackingActive() === false) {
          // Starte die Benachrichtigung
          await startSleepNotification(new Date(parsedData.start_time));
        }
      }

      // Dann prüfe in der Datenbank - ohne userId Parameter
      const result = await checkForActiveSleepEntry();
      
      if (!result.success) {
        console.error('Fehler beim Laden des aktiven Schlafeintrags:', result.error);
        return;
      }

      if (result.activeEntry) {
        // Konvertiere das Objekt in den richtigen Typ mit expliziter Typisierung
        const typedEntry: SleepEntry = {
          ...result.activeEntry,
          start_time: new Date(result.activeEntry.start_time),
          end_time: result.activeEntry.end_time ? new Date(result.activeEntry.end_time) : null
        };
        setCurrentEntry(typedEntry);
        setIsTracking(true);
        setActiveEntryId(result.activeEntry.id);

        // Lokalen Speicher aktualisieren
        await AsyncStorage.setItem('activeSleepEntry', JSON.stringify(result.activeEntry));
      }
    } catch (error) {
      console.error('Fehler beim Überprüfen aktiver Schlafeinträge:', error);
    }
  };

  // Formatieren der Zeitanzeige
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    // Format mit engeren Doppelpunkten für bessere Platzierung
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Ändere den Funktionsnamen, um Konflikte zu vermeiden
  const handleStartSleepTracking = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um den Schlaftracker zu nutzen.');
        return;
      }

      // Lade-Indikator anzeigen
      setIsSyncing(true);
      
      // Speichere den Eintrag in der Datenbank
      const result = await startSleepTracking(user.id);
      
      if (!result.success) {
        console.error('Fehler beim Speichern des Schlafeintrags:', result.error);
        Alert.alert('Fehler', 'Der Schlafeintrag konnte nicht gestartet werden.');
        setIsSyncing(false);
        return;
      }

      // Setze aktiven Eintrag
      if (result.entry) {
        setCurrentEntry({
          ...result.entry,
          start_time: new Date(result.entry.start_time)
        });
        setActiveEntryId(result.entry.id);
        setIsTracking(true);
        setElapsedTime(0);

        // Speichere lokal für den Fall eines App-Neustarts
        await AsyncStorage.setItem('activeSleepEntry', JSON.stringify(result.entry));
        
        // Starte die Dynamic Island / Benachrichtigung für den Schlaftracker
        await startSleepNotification(new Date(result.entry.start_time));
        
        // Synchronisiere sofort mit verbundenen Accounts, damit beide den Eintrag sehen können
        console.log('Starte automatische Partner-Synchronisierung nach dem Start des Schlafeintrags...');
        setTimeout(async () => {
          try {
            // Daten synchronisieren
            const syncResult = await syncAllSleepEntries();
            
            if (syncResult.success) {
              console.log(`Automatische Synchronisierung nach Start erfolgreich: ${syncResult.syncedCount || 0} Einträge synchronisiert`);
              setSyncInfo({
                lastSync: new Date(),
                syncedCount: syncResult.syncedCount || 0,
                message: syncResult.message
              });
              
              // Daten nach der Synchronisierung neu laden
              await loadSleepData();
            } else {
              console.error('Fehler bei der automatischen Synchronisierung nach Start:', syncResult.error);
            }
          } catch (error) {
            console.error('Unerwarteter Fehler bei der automatischen Synchronisierung nach Start:', error);
          } finally {
            setIsSyncing(false);
          }
        }, 1000); // 1 Sekunde Verzögerung reicht hier aus
      }
    } catch (error) {
      console.error('Fehler beim Starten des Schlaftrackings:', error);
      Alert.alert('Fehler', 'Das Schlaftracking konnte nicht gestartet werden.');
      setIsSyncing(false);
    }
  };

  // Ändere auch den stopSleepTracking-Aufruf
  const handleStopSleepTracking = async () => {
    try {
      if (!currentEntry || !activeEntryId) return;

      // Öffne das Notiz-Eingabefeld
      setShowNoteInput(true);

      // Update wird erst ausgeführt, wenn die Notiz gespeichert wird
    } catch (error) {
      console.error('Fehler beim Stoppen des Schlaftrackings:', error);
      Alert.alert('Fehler', 'Das Schlaftracking konnte nicht gestoppt werden.');
    }
  };

  // Speichern der Notiz und Abschließen des Schlafeintrags mit automatischer Synchronisierung
  const saveNoteAndFinishEntry = async () => {
    try {
      if (!currentEntry || !activeEntryId) return;

      console.log("Versuche Schlafeintrag zu speichern:", {
        entryId: activeEntryId,
        quality: selectedQuality,
        notes: notes
      });

      // Aktualisiere den Eintrag mit Ende und Notizen
      const result = await stopSleepTracking(activeEntryId, selectedQuality, notes);

      console.log("Ergebnis des stopSleepTracking-Aufrufs:", result);

      if (!result.success) {
        console.error('Fehler beim Aktualisieren des Schlafeintrags:', result.error);
        Alert.alert('Fehler', 'Der Schlafeintrag konnte nicht abgeschlossen werden.');
        return;
      }

      // Tracking-Status zurücksetzen
      setIsTracking(false);
      setCurrentEntry(null);
      setActiveEntryId(null);
      setElapsedTime(0);
      setNotes('');
      setSelectedQuality('good');
      setShowNoteInput(false);

      // Lokalen Speicher löschen
      await AsyncStorage.removeItem('activeSleepEntry');
      
      // Beende die Dynamic Island / Benachrichtigung
      await stopSleepNotification();

      // Daten neu laden
      loadSleepData();

      // Erfolgsmeldung
      Alert.alert('Erfolg', 'Der Schlafeintrag wurde erfolgreich gespeichert.');
      
      // Automatische Synchronisierung nach 2 Sekunden
      console.log('Starte automatische Partner-Synchronisierung in 2 Sekunden...');
      setTimeout(async () => {
        try {
          setIsSyncing(true);
          
          // Daten synchronisieren
          const syncResult = await syncAllSleepEntries();
          
          if (syncResult.success) {
            console.log(`Automatische Synchronisierung erfolgreich: ${syncResult.syncedCount || 0} Einträge synchronisiert`);
            setSyncInfo({
              lastSync: new Date(),
              syncedCount: syncResult.syncedCount || 0,
              message: syncResult.message
            });
            
            // Daten nach der Synchronisierung neu laden
            await loadSleepData();
          } else {
            console.error('Fehler bei der automatischen Synchronisierung:', syncResult.error);
          }
        } catch (error) {
          console.error('Unerwarteter Fehler bei der automatischen Synchronisierung:', error);
        } finally {
          setIsSyncing(false);
        }
      }, 2000); // 2 Sekunden Verzögerung
    } catch (error) {
      console.error('Fehler beim Speichern der Notiz:', error);
      Alert.alert('Fehler', 'Die Notiz konnte nicht gespeichert werden.');
    }
  };

  // Abbrechen der Notizeingabe
  const cancelNoteInput = () => {
    setNotes('');
    setShowNoteInput(false);
  };

  // Schlafaufzeichnung verwerfen (ohne zu speichern)
  const discardSleepEntry = async () => {
    try {
      if (!currentEntry || !activeEntryId) return;

      // Bestätigungsdialog anzeigen
      Alert.alert(
        'Aufzeichnung verwerfen',
        'Möchtest du die aktuelle Schlafaufzeichnung wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.',
        [
          {
            text: 'Abbrechen',
            style: 'cancel'
          },
          {
            text: 'Verwerfen',
            style: 'destructive',
            onPress: async () => {
              // Eintrag direkt aus der Datenbank löschen
              const { error } = await supabase
                .from('sleep_entries')
                .delete()
                .eq('id', activeEntryId);

              if (error) {
                console.error('Fehler beim Verwerfen des Schlafeintrags:', error);
                Alert.alert('Fehler', 'Die Schlafaufzeichnung konnte nicht verworfen werden.');
                return;
              }

              // Tracking-Status zurücksetzen
              setIsTracking(false);
              setCurrentEntry(null);
              setActiveEntryId(null);
              setElapsedTime(0);
              setNotes('');
              setSelectedQuality('good');
              setShowNoteInput(false);

              // Lokalen Speicher löschen
              await AsyncStorage.removeItem('activeSleepEntry');

              // Erfolgsmeldung
              Alert.alert('Erfolg', 'Die Schlafaufzeichnung wurde verworfen.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Verwerfen des Schlafeintrags:', error);
      Alert.alert('Fehler', 'Die Schlafaufzeichnung konnte nicht verworfen werden.');
    }
  };

  // Toggle für das Info-Popup
  const toggleInfoPopup = () => {
    // Wenn das Popup geöffnet wird, stellen wir sicher, dass die Daten geladen sind
    if (!showInfoPopup) {
      console.log('Opening info popup, loading data for calendar...');
      // Stelle sicher, dass wir aktuelle Daten für den Kalender haben
      loadSleepData().then(() => {
        // Zeige ein paar Demo-Einträge für den Kalender, falls keine vorhanden sind
        if (Object.keys(groupedEntries).length === 0) {
          const demoEntries: Record<string, SleepSession[]> = {};
          
          // Erstelle ein paar Demo-Einträge für den laufenden Monat
          const today = new Date();
          const month = today.getMonth();
          const year = today.getFullYear();
          
          // Füge einige Tage mit verschiedenen Qualitäten hinzu
          for (let day = 1; day <= 28; day += 3) {
            const date = new Date(year, month, day);
            const dateString = format(date, 'yyyy-MM-dd');
            
            // Wechsle die Qualität ab
            const quality: SleepQuality = day % 9 === 0 ? 'bad' : (day % 6 === 0 ? 'medium' : 'good');
            
            const demoSession: SleepSession = {
              id: `demo-${dateString}`,
              startTime: format(date, 'dd.MM.yyyy 20:00', { locale: de }),
              endTime: format(new Date(date.getTime() + 8 * 60 * 60 * 1000), 'dd.MM.yyyy 06:00', { locale: de }),
              duration: '10h 0m',
              durationMinutes: 600,
              quality: quality,
              notes: 'Demo-Eintrag',
              rawStartTime: date,
              rawEndTime: new Date(date.getTime() + 8 * 60 * 60 * 1000),
              creatorName: "Du",
              isShared: false
            };
            
            demoEntries[dateString] = [demoSession];
          }
          
          // Setze die Demo-Einträge nur, wenn wir keine echten Einträge haben
          setGroupedEntries(demoEntries);
          console.log('Added demo entries for calendar visualization');
        }
      });
    }
    
    // Umschalte den Anzeigezustand des Popups
    setShowInfoPopup(!showInfoPopup);
  };

  // Schließen des Info-Popups
  const closeInfoPopup = () => {
    setShowInfoPopup(false);
  };

  // Laden aller Schlafeinträge
  const loadSleepData = async () => {
    try {
      if (!user) return;

      console.log('Lade Schlafdaten für Benutzer:', user.id);

      // Verwende die verbesserte loadAllSleepEntries-Funktion statt direkter Datenbankabfrage
      const result = await loadAllSleepEntries();
      const { success, entries: entriesData, error: entriesError } = result;

      if (!success || entriesError) {
        console.error('Fehler beim Laden der Schlafeinträge:', entriesError);
        setSleepEntries([]);
        setGroupedEntries({});
        return;
      }

      console.log(`Geladene Schlafeinträge: ${entriesData?.length || 0}`);
      // Zeige die ersten paar Einträge als Beispiel
      if (entriesData && entriesData.length > 0) {
        console.log('Beispieleintrag:', JSON.stringify(entriesData[0], null, 2));
      }

      if (entriesData && entriesData.length > 0) {
        // Erstelle eine Map für verbundene Benutzer
        const linkedUserMap = new Map<string, string>();
        
        // Lade verbundene Benutzer separat mit der verbesserten Funktion
        try {
          const connectedUsersResult = await loadConnectedUsers();
          if (connectedUsersResult.success && connectedUsersResult.linkedUsers) {
            connectedUsersResult.linkedUsers.forEach((lu: { userId: string, displayName: string }) => {
              linkedUserMap.set(lu.userId, lu.displayName);
            });
          }
        } catch (error) {
          console.error('Fehler beim Laden verbundener Benutzer:', error);
        }

        // Konvertiere die Daten in das Format für die Anzeige
        const sessions: SleepSession[] = entriesData.map(entry => {
          const startTime = entry.start_time instanceof Date 
            ? entry.start_time 
            : new Date(entry.start_time);
            
          const endTime = entry.end_time 
            ? (entry.end_time instanceof Date ? entry.end_time : new Date(entry.end_time)) 
            : new Date();
            
          const durationMinutes = entry.duration_minutes || 
            Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

          // Bestimme den Namen des Erstellers
          let creatorName = "Du";
          let isShared = false;
          
          // Wenn der Eintrag von einem anderen Benutzer erstellt wurde
          if (entry.user_id && entry.user_id !== user.id) {
            creatorName = linkedUserMap.get(entry.user_id) || "Partner";
            isShared = true;
          } else if (entry.shared_with_user_id) {
            // Wenn der Eintrag von dir erstellt und geteilt wurde
            isShared = true;
            creatorName = "Du (Geteilt)";
          }

          try {
            return {
              id: entry.id || "",
              startTime: format(startTime, 'dd.MM.yyyy HH:mm', { locale: de }),
              endTime: format(endTime, 'dd.MM.yyyy HH:mm', { locale: de }),
              duration: formatDuration(durationMinutes),
              durationMinutes: durationMinutes,
              quality: entry.quality || 'good',
              notes: entry.notes || '',
              rawStartTime: startTime,
              rawEndTime: endTime,
              userId: entry.user_id,
              externalId: entry.external_id,
              syncedAt: entry.synced_at ? new Date(entry.synced_at) : null,
              creatorName: creatorName,
              isShared: isShared,
              sharedWithUserId: entry.shared_with_user_id
            };
          } catch (err) {
            console.error('Fehler bei der Konvertierung eines Eintrags:', err, entry);
            // Fallback mit Minimal-Daten
            return {
              id: entry.id || "",
              startTime: startTime.toString(),
              endTime: endTime.toString(),
              duration: "0h 0m",
              durationMinutes: 0,
              quality: 'good',
              notes: 'Fehlerhafter Eintrag',
              rawStartTime: startTime,
              rawEndTime: endTime,
              userId: entry.user_id,
              isShared: false,
              creatorName: "Fehler"
            };
          }
        });

        console.log('Verarbeitete Sessions:', sessions.length);
        setSleepEntries(sessions);
        
        // Gruppiere Einträge nach Datum
        const grouped = groupEntriesByDate(sessions);
        console.log('Gruppierte Einträge Anzahl:', Object.keys(grouped).length);
        console.log('Gruppierte Einträge Schlüssel:', Object.keys(grouped));
        
        // Falls keine Gruppierung erfolgt ist, obwohl Daten da sind
        if (Object.keys(grouped).length === 0 && sessions.length > 0) {
          console.warn('Warnung: Es wurden keine Einträge gruppiert, obwohl Sessions vorhanden sind!');
          
          // Versuche manuelle Gruppierung als Fallback
          const manualGrouped: Record<string, SleepSession[]> = {};
          sessions.forEach(session => {
            try {
              const dateKey = format(session.rawStartTime, 'yyyy-MM-dd');
              if (!manualGrouped[dateKey]) {
                manualGrouped[dateKey] = [];
              }
              manualGrouped[dateKey].push(session);
            } catch (err) {
              console.error('Fehler bei manueller Gruppierung:', err);
            }
          });
          
          console.log('Manuell gruppierte Einträge:', Object.keys(manualGrouped).length);
          setGroupedEntries(manualGrouped);
        } else {
          setGroupedEntries(grouped);
        }

        // Gesamt- und Durchschnittswerte berechnen
        calculateSleepStatistics(sessions);
        
        // Filtere Sitzungen für die Tagesvisualisierung
        filterSessionsForSelectedDay(sessions);
      } else {
        console.log('Keine Schlafeinträge in der Datenbank gefunden');
        setSleepEntries([]);
        setGroupedEntries({});
      }
    } catch (error) {
      console.error('Fehler beim Laden der Schlafdaten:', error);
      setSleepEntries([]);
      setGroupedEntries({});
    }
  };

  // Berechnung der Schlafstatistiken
  const calculateSleepStatistics = (sessions: SleepSession[]) => {
    // Berechne Gesamtschlaf heute
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySessions = sessions.filter(session => {
      const sessionStart = new Date(session.startTime.split(' ')[0].split('.').reverse().join('-'));
      return sessionStart.getTime() >= today.getTime();
    });
    
    const totalToday = todaySessions.reduce((total, session) => total + session.durationMinutes, 0);
    setTotalSleepToday(totalToday);

    // Berechne durchschnittliche Schlafdauer der letzten 7 Tage
    if (sessions.length > 0) {
      const avgDuration = sessions.slice(0, Math.min(sessions.length, 7))
        .reduce((total, session) => total + session.durationMinutes, 0) / Math.min(sessions.length, 7);
      setAverageSleepDuration(Math.round(avgDuration));
    }
  };

  // Formatiere die Dauer für die Anzeige
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Filtere Sitzungen für den ausgewählten Tag
  const filterSessionsForSelectedDay = (sessions: SleepSession[]) => {
    const filteredSessions = sessions.filter(session => {
      const sessionDate = session.rawStartTime;
      return isToday(sessionDate);
    });
    
    setDayViewSessions(filteredSessions);
  };
  
  // Berechne die Position und Größe des Balkens basierend auf Start- und Endzeit
  const calculateBarPosition = (startTime: Date, endTime: Date) => {
    const totalDayMinutes = 24 * 60;
    
    const startMinuteOfDay = (startTime.getHours() * 60) + startTime.getMinutes();
    const endMinuteOfDay = (endTime.getHours() * 60) + endTime.getMinutes();
    
    const startPercentage = (startMinuteOfDay / totalDayMinutes) * 100;
    const widthPercentage = ((endMinuteOfDay - startMinuteOfDay) / totalDayMinutes) * 100;
    
    return {
      startPercentage,
      widthPercentage
    };
  };
  
  // Funktion zum Gruppieren der Einträge nach Tag mit verbesserter Fehlerbehandlung
  const groupEntriesByDate = (entries: SleepSession[]): Record<string, SleepSession[]> => {
    if (!entries || entries.length === 0) {
      console.log('Keine Einträge zum Gruppieren vorhanden');
      return {};
    }
    
    console.log(`Gruppiere ${entries.length} Einträge nach Datum`);
    
    const grouped: Record<string, SleepSession[]> = {};
    
    entries.forEach((entry, index) => {
      try {
        if (!entry.rawStartTime) {
          console.warn(`Eintrag ${index} hat kein gültiges Startdatum:`, entry);
          return;
        }
        
        // Formatiere das Datum als YYYY-MM-DD für die Gruppierung
        // Falls es Probleme mit dem Datum gibt, fange es auf
        let dateKey;
        try {
          dateKey = format(entry.rawStartTime, 'yyyy-MM-dd');
        } catch (error) {
          console.error(`Fehler beim Formatieren des Datums für Eintrag ${index}:`, error);
          // Fallback: Versuche direktes String-Parsing
          const dateStr = entry.startTime.split(' ')[0]; // "dd.MM.yyyy HH:mm" -> "dd.MM.yyyy"
          const [day, month, year] = dateStr.split('.');
          dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log(`Fallback-Datum für Eintrag ${index}: ${dateKey}`);
        }
        
        if (!dateKey) {
          console.warn(`Kein gültiges Datum für Eintrag ${index} gefunden`);
          return;
        }
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        
        grouped[dateKey].push(entry);
        
      } catch (error) {
        console.error(`Fehler bei der Gruppierung von Eintrag ${index}:`, error);
      }
    });
    
    // Sortiere die Einträge innerhalb jeder Gruppe nach Startzeit (neueste zuerst)
    Object.keys(grouped).forEach(date => {
      try {
        grouped[date].sort((a, b) => {
          // Mit Fehlerbehandlung, falls getTime() fehlschlägt
          try {
            return b.rawStartTime.getTime() - a.rawStartTime.getTime();
          } catch (error) {
            console.error(`Fehler beim Sortieren der Einträge für Datum ${date}:`, error);
            return 0;
          }
        });
      } catch (error) {
        console.error(`Fehler beim Verarbeiten der Gruppe für Datum ${date}:`, error);
      }
    });
    
    console.log(`Gruppierung abgeschlossen. ${Object.keys(grouped).length} Tage gefunden.`);
    Object.keys(grouped).forEach(date => {
      console.log(`- ${date}: ${grouped[date].length} Einträge`);
    });
    
    return grouped;
  };

  // Zeige Details eines Schlafeintrags an
  const showSleepEntryDetails = (entry: SleepSession) => {
    setSelectedSleepEntry(entry);
    setShowDetailModal(true);
  };

  // Schließe das Details-Modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedSleepEntry(null);
  };
  
  // Löschen eines Schlafeintrags
  const handleDeleteSleepEntry = async (entryId: string) => {
    try {
      if (!user || !entryId) return;
      
      // Bestätigungsdialog anzeigen
      Alert.alert(
        'Eintrag löschen',
        'Möchtest du diesen Schlafeintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        [
          {
            text: 'Abbrechen',
            style: 'cancel'
          },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              // Anzeigen des Lade-Indikators
              setIsSyncing(true);
              
              // Eintrag aus der Datenbank löschen
              const result = await deleteSleepEntry(entryId);
              
              if (!result.success) {
                console.error('Fehler beim Löschen des Schlafeintrags:', result.error);
                Alert.alert('Fehler', 'Der Schlafeintrag konnte nicht gelöscht werden.');
                setIsSyncing(false);
                return;
              }
              
              // Aktualisiere die Anzeige
              loadSleepData();
              
              // Erfolgsbenachrichtigung
              Alert.alert('Erfolg', 'Der Schlafeintrag wurde erfolgreich gelöscht.');
              
              // Automatische Synchronisierung nach 2 Sekunden
              console.log('Starte automatische Partner-Synchronisierung nach Löschung in 2 Sekunden...');
              setTimeout(async () => {
                try {
                  // Daten synchronisieren
                  const syncResult = await syncAllSleepEntries();
                  
                  if (syncResult.success) {
                    console.log(`Automatische Synchronisierung nach Löschung erfolgreich: ${syncResult.syncedCount || 0} Einträge synchronisiert`);
                    setSyncInfo({
                      lastSync: new Date(),
                      syncedCount: syncResult.syncedCount || 0,
                      message: syncResult.message
                    });
                    
                    // Daten nach der Synchronisierung neu laden
                    await loadSleepData();
                  } else {
                    console.error('Fehler bei der automatischen Synchronisierung nach Löschung:', syncResult.error);
                  }
                } catch (error) {
                  console.error('Unerwarteter Fehler bei der automatischen Synchronisierung nach Löschung:', error);
                } finally {
                  setIsSyncing(false);
                }
              }, 2000); // 2 Sekunden Verzögerung
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Löschanfrage:', error);
      Alert.alert('Fehler', 'Die Löschanfrage konnte nicht verarbeitet werden.');
    }
  };
  
  // Starte Bearbeitung eines Schlafeintrags
  const handleEditSleepEntry = (entry: SleepSession) => {
    // Hier kann später eine Edit-Funktionalität implementiert werden
    // Für jetzt zeigen wir einfach die Details an
    showSleepEntryDetails(entry);
  };
  
  // Rendern einer Gruppe von Schlafeinträgen für ein Datum im Stil des Wehen-Trackers
  const renderDateGroup = (date: string, entries: SleepSession[] = []) => {
    try {
      console.log(`Rendere Gruppe für Datum ${date} mit ${entries.length} Einträgen`);
      
      if (!entries || entries.length === 0) {
        console.warn(`Keine Einträge für Datum ${date} vorhanden`);
        return null;
      }
      
      let dateObj;
      try {
        dateObj = parseISO(date);
        console.log(`Parsed date ${date} to ${dateObj.toISOString()}`);
      } catch (error) {
        console.error(`Fehler beim Parsen des Datums ${date}:`, error);
        // Fallback: Versuche manuelles Parsing
        const [year, month, day] = date.split('-');
        if (year && month && day) {
          dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          console.log(`Fallback-Parsen des Datums ${date} zu ${dateObj.toISOString()}`);
        } else {
          return null;
        }
      }
      
      const formattedDate = format(dateObj, 'EEEE, dd. MMMM yyyy', { locale: de });
      
      return (
        <View key={date} style={styles.dayContainer}>
          <View style={styles.dateHeader}>
            <ThemedText style={styles.dateText}>{formattedDate}</ThemedText>
          </View>
          
          <View style={styles.timeline}>
            {entries.map((entry, index) => {
              try {
                const isLast = index === entries.length - 1;
                const isExpanded = entry.isExpanded;
                const entryNumber = entries.length - index;
                
                return (
                  <View key={`${entry.id || index}`} style={styles.timelineItem}>
                    {/* Zeitstempel */}
                    <View style={styles.timeColumn}>
                      <ThemedText style={styles.timeText}>
                        {format(entry.rawStartTime, 'HH:mm', { locale: de })}
                      </ThemedText>
                    </View>
                    
                    {/* Timeline-Linie und Punkt */}
                    <View style={styles.lineColumn}>
                      <View style={[
                        styles.timelineDot,
                        { backgroundColor: entry.quality ? getQualityColor(entry.quality) : getQualityColor('good') }
                      ]} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    
                    {/* Schlaf-Karte */}
                    <View style={styles.cardColumn}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => showSleepEntryDetails(entry)}
                      >
                        <ThemedView
                          style={[
                            styles.sleepCard,
                            { borderLeftColor: entry.quality ? getQualityColor(entry.quality) : getQualityColor('good') },
                            // Füge einen bestimmten Stil für Einträge hinzu, die nicht vom aktuellen Benutzer erstellt wurden
                            entry.creatorName !== "Du" && styles.partnerEntryCard
                          ]}
                          lightColor={colorScheme === 'light' ? 'rgba(247, 239, 229, 0.8)' : theme.card}
                          darkColor={colorScheme === 'dark' ? 'rgba(92, 77, 65, 0.8)' : theme.card}
                        >
                          <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                              <ThemedText style={styles.cardTitle}>
                                Schlaf #{entryNumber}
                              </ThemedText>
                              {/* Zeige den Ersteller für geteilte Einträge an */}
                              {entry.isShared && (
                                <View style={styles.creatorBadge}>
                                  <IconSymbol 
                                    name={entry.creatorName === "Du" ? "person.circle" : "person.2.circle"} 
                                    size={14} 
                                    color="#FFFFFF" 
                                  />
                                  <ThemedText style={styles.creatorBadgeText}>
                                    {entry.creatorName === "Du" ? "Geteilt" : entry.creatorName}
                                  </ThemedText>
                                </View>
                              )}
                              <View style={[
                                styles.qualityBadge,
                                { backgroundColor: entry.quality ? getQualityColor(entry.quality) : getQualityColor('good') }
                              ]}>
                                <ThemedText style={styles.qualityBadgeText}>
                                  {entry.quality === 'good' ? 'Gut' : 
                                   entry.quality === 'medium' ? 'Mittel' : 'Schlecht'}
                                </ThemedText>
                              </View>
                            </View>
                          </View>
                          
                          <View style={styles.cardDetails}>
                            <View style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Dauer:</ThemedText>
                              <ThemedText style={styles.detailValue}>{entry.duration}</ThemedText>
                            </View>
                            
                            {entry.notes ? (
                              <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Notizen:</ThemedText>
                                <ThemedText style={styles.detailValue}>{entry.notes}</ThemedText>
                              </View>
                            ) : null}
                            
                            {isExpanded && (
                              <View style={styles.expandedDetails}>
                                <View style={styles.divider} />
                                
                                <View style={styles.detailRow}>
                                  <ThemedText style={styles.detailLabel}>Startzeit:</ThemedText>
                                  <ThemedText style={styles.detailValue}>
                                    {format(entry.rawStartTime, 'dd.MM.yyyy HH:mm', { locale: de })}
                                  </ThemedText>
                                </View>
                                
                                <View style={styles.detailRow}>
                                  <ThemedText style={styles.detailLabel}>Endzeit:</ThemedText>
                                  <ThemedText style={styles.detailValue}>
                                    {format(entry.rawEndTime, 'dd.MM.yyyy HH:mm', { locale: de })}
                                  </ThemedText>
                                </View>
                                
                                {/* Aktions-Buttons - nur in aufgeklappter Karte anzeigen */}
                                <View style={styles.actionButtonsContainer}>
                                  {/* Bearbeiten-Button */}
                                  <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={(e) => {
                                      e.stopPropagation(); // Verhindert, dass der Klick die Karte erweitert
                                      handleEditSleepEntry(entry);
                                    }}
                                  >
                                    <IconSymbol name="pencil" size={16} color="#A8D8A8" />
                                    <ThemedText style={styles.editButtonText}>Bearb.</ThemedText>
                                  </TouchableOpacity>
                                  
                                  {/* Teilen-Button nur anzeigen, wenn der aktuelle Benutzer der Ersteller ist und der Eintrag nicht bereits geteilt ist */}
                                  {entry.userId === user?.id && !entry.sharedWithUserId && (
                                    <TouchableOpacity
                                      style={styles.shareButton}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        handleShareSleepEntry(entry);
                                      }}
                                    >
                                      <IconSymbol name="person.badge.plus" size={16} color="#6C8FF9" />
                                      <ThemedText style={styles.shareButtonText}>Teilen</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                  
                                  {/* Freigabe aufheben-Button, wenn der Eintrag geteilt ist und der aktuelle Benutzer der Ersteller ist */}
                                  {entry.userId === user?.id && entry.sharedWithUserId && (
                                    <TouchableOpacity
                                      style={styles.unshareButton}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        handleUnshareSleepEntryImproved(entry);
                                      }}
                                    >
                                      <IconSymbol name="person.badge.minus" size={16} color="#F9C66C" />
                                      <ThemedText style={styles.unshareButtonText}>Freigabe aufheben</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                  
                                  {/* Lösch-Button */}
                                  <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={(e) => {
                                      e.stopPropagation(); // Verhindert, dass der Klick die Karte erweitert
                                      handleDeleteSleepEntry(entry.id);
                                    }}
                                  >
                                    <IconSymbol name="trash" size={16} color="#FF6B6B" />
                                    <ThemedText style={styles.deleteButtonText}>Lösch.</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        </ThemedView>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              } catch (error) {
                console.error(`Fehler beim Rendern des Eintrags ${entry.id} für Datum ${date}:`, error);
                return null;
              }
            })}
          </View>
        </View>
      );
    } catch (error) {
      console.error(`Fehler beim Rendern der Gruppe für Datum ${date}:`, error);
      return null;
    }
  };

  // Diese Funktion wurde nach unten verschoben

  // Akzeptieren einer Verbindungsanfrage (für Testzwecke)
  const acceptConnectionRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_connections')
        .update({ status: 'active' })
        .eq('id', connectionId);
      
      if (error) {
        console.error('Fehler beim Akzeptieren der Verbindung:', error);
        Alert.alert('Fehler', `Fehler beim Akzeptieren der Verbindung: ${error.message}`);
        return;
      }
      
      Alert.alert('Erfolg', 'Verbindung erfolgreich akzeptiert!');
      loadConnectedUsers();
    } catch (error) {
      console.error('Fehler beim Akzeptieren der Verbindung:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Akzeptieren der Verbindung');
    }
  };

  // Debug: Datenbank direkt abfragen und gruppierte Einträge anzeigen
  const debugCheckDatabaseAndGroups = async () => {
    if (!user) return;
    
    try {
      console.log('Prüfe Datenbankstruktur und Schlafeinträge mit verbesserten Funktionen...');
      
      // Informiere den Benutzer über den Start der Prüfung
      Alert.alert('Datenprüfung', 'Prüfe Datenbank und lade Einträge...');
      
      console.log('Verwende verbesserte Ladefunktionen statt Datenbankstruktur-Check');
      
      // Verwende die verbesserte loadAllSleepEntries-Funktion
      const result = await loadAllSleepEntries();
      
      if (!result.success) {
        console.error('Fehler beim Laden der Schlafeinträge:', result.error);
        Alert.alert('Fehler', 'Laden der Schlafeinträge fehlgeschlagen: ' + result.error);
        return;
      }
      
      console.log(`Verbesserte Ladefunktion: ${result.entries?.length || 0} Einträge geladen`);
      
      // Prüfe auf geteilte Einträge
      let sharedEntries = result.entries?.filter(entry => entry.shared_with_user_id !== null || entry.user_id !== user?.id);
      let ownEntries = result.entries?.filter(entry => entry.user_id === user?.id);
      
      console.log(`Davon: ${ownEntries?.length || 0} eigene Einträge, ${sharedEntries?.length || 0} geteilte Einträge`);
      
      // Lade verbundene Benutzer
      const connectedUsersResult = await loadConnectedUsers();
      
      if (!connectedUsersResult.success) {
        console.error('Fehler beim Laden verbundener Benutzer:', connectedUsersResult.error);
      } else {
        console.log(`${connectedUsersResult.linkedUsers?.length || 0} verbundene Benutzer gefunden`);
      }

      // Zeige Ergebnisse in Alert an
      Alert.alert(
        'Datenbank OK',
        `${ownEntries?.length || 0} eigene Einträge\n${sharedEntries?.length || 0} geteilte Einträge\n${connectedUsersResult.linkedUsers?.length || 0} verbundene Benutzer`
      );
      
      // Teste Realtime-Synchronisierung
      try {
        const realtimeStatus = await activateRealtimeSync((payload) => {
          console.log('Realtime-Update erhalten:', payload);
        });
        
        if (realtimeStatus.success) {
          console.log('Realtime-Synchronisierung erfolgreich aktiviert');
        } else {
          console.error('Fehler bei Realtime-Aktivierung:', realtimeStatus.error);
        }
      } catch (error) {
        console.error('Fehler bei Realtime-Test:', error);
      }
      
    } catch (error) {
      console.error('Fehler bei Datenbankprüfung:', error);
      Alert.alert('Fehler', 'Bei der Datenbankprüfung ist ein Fehler aufgetreten: ' + String(error));
    }
  };

  // Nach debugCheckDatabaseAndGroups Funktion
  const debugCheckConnections = async () => {
    try {
      setIsSyncing(true);

      // Verbundene Benutzer abrufen und im Detail ausgeben
      const { linkedUsers } = await getLinkedUsersWithDetails();
      console.log('Verbundene Benutzer:', JSON.stringify(linkedUsers, null, 2));
      
      // Anzeige der IDs zum einfachen Vergleich
      if (linkedUsers && linkedUsers.length > 0) {
        alert(`${linkedUsers.length} verbundene Benutzer gefunden:\n${
          linkedUsers.map(u => `${u.displayName}: ${u.userId}`).join('\n')
        }`);
      } else {
        alert('Keine verbundenen Benutzer gefunden');
      }

      return true;
    } catch (error) {
      console.error('Fehler beim Prüfen der Verbindungen:', error);
      alert(`Fehler: ${error}`);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Nach debugCheckConnections Funktion
  const debugCheckConnectionsDetailed = async () => {
    try {
      setIsSyncing(true);
      
      // Original-Methode
      console.log('Teste Original-Methode:');
      const { success: success1, linkedUsers: linkedUsers1, error: error1 } = 
        await getLinkedUsersWithDetails();
      console.log('Original-Methode Ergebnis:', 
        success1 ? `${linkedUsers1?.length || 0} verbundene Benutzer gefunden` : `Fehler: ${error1}`);
      
      // Alternative Methode importieren und testen
      console.log('Teste Alternative Methode:');
      const { getLinkedUsersAlternative } = await import('../lib/sleepData');
      const { success: success2, linkedUsers: linkedUsers2, error: error2 } = 
        await getLinkedUsersAlternative();
      console.log('Alternative Methode Ergebnis:', 
        success2 ? `${linkedUsers2?.length || 0} verbundene Benutzer gefunden` : `Fehler: ${error2}`);
      
      // Ergebnisse anzeigen
      const result1Text = success1 
        ? `${linkedUsers1?.length || 0} Benutzer: ${linkedUsers1?.map(u => u.displayName).join(', ') || 'keine'}`
        : `Fehler: ${error1}`;
      
      const result2Text = success2 
        ? `${linkedUsers2?.length || 0} Benutzer: ${linkedUsers2?.map(u => u.displayName).join(', ') || 'keine'}`
        : `Fehler: ${error2}`;
      
      Alert.alert(
        'Verbundene Benutzer Test',
        `Original: ${result1Text}\n\nAlternativ: ${result2Text}`
      );
      
      // Wenn die alternative Methode erfolgreicher ist, setzen wir die Ergebnisse
      if (!success1 && success2 && linkedUsers2?.length) {
        setConnectedUsers(linkedUsers2);
        setConnectionStatus('connected');
        Alert.alert(
          'Erfolg!',
          'Die verbundenen Benutzer wurden mit der alternativen Methode geladen.'
        );
      }
      
      return true;
    } catch (error) {
      console.error('Fehler beim detaillierten Prüfen der Verbindungen:', error);
      Alert.alert('Fehler', String(error));
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Hier wird die globale getQualityColor-Funktion verwendet, die oben im File definiert ist

  // Teile einen Schlafeintrag mit einem Partner
  const handleShareSleepEntry = async (entry: SleepSession) => {
    if (!user) return;
    
    try {
      // Lade verbundene Benutzer
      const { linkedUsers } = await getLinkedUsersWithDetails();
      
      if (!linkedUsers || linkedUsers.length === 0) {
        Alert.alert(
          'Keine verbundenen Benutzer',
          'Du hast derzeit keine verbundenen Partner, mit denen du diesen Eintrag teilen könntest.'
        );
        return;
      }
      
      // Erstelle Auswahloptionen für jeden verbundenen Benutzer
      const options = linkedUsers.map(lu => ({
        text: lu.displayName || lu.userId,
        onPress: async () => {
          console.log(`Teile Eintrag ${entry.id} mit Benutzer ${lu.userId}`);
          
          // Zeige Ladeindikator
          setIsSyncing(true);
          
          try {
            const result = await shareSleepEntryImproved(entry.id, lu.userId);
            
            if (result.success) {
              Alert.alert('Erfolg', `Eintrag wurde erfolgreich mit ${lu.displayName || 'Partner'} geteilt.`);
              // Daten neu laden
              await loadSleepData();
            } else {
              console.error('Fehler beim Teilen des Eintrags:', result.error);
              Alert.alert('Fehler', `Fehler beim Teilen des Eintrags: ${result.error}`);
            }
          } catch (error) {
            console.error('Unerwarteter Fehler beim Teilen:', error);
            Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
          } finally {
            setIsSyncing(false);
          }
        }
      }));
      
      // Füge Option zum Abbrechen hinzu
      options.push({
        text: 'Abbrechen',
        onPress: () => {} // Leere Funktion, um den Linter-Fehler zu beheben
      });
      
      // Zeige ActionSheet
      Alert.alert(
        'Mit Partner teilen',
        'Wähle einen Partner, mit dem du diesen Schlafeintrag teilen möchtest:',
        options
      );
    } catch (error) {
      console.error('Fehler beim Laden der verbundenen Benutzer:', error);
      Alert.alert('Fehler', 'Die verbundenen Benutzer konnten nicht geladen werden.');
    }
  };

  // Teilen eines Eintrags aufheben
  const handleUnshareSleepEntryImproved = async (entry: SleepSession) => {
    if (!user) return;
    
    try {
      Alert.alert(
        'Freigabe aufheben',
        'Möchtest du die Freigabe dieses Eintrags wirklich aufheben?',
        [
          {
            text: 'Abbrechen',
            style: 'cancel'
          },
          {
            text: 'Freigabe aufheben',
            style: 'destructive',
            onPress: async () => {
              // Zeige Ladeindikator
              setIsSyncing(true);
              
              try {
                const result = await unshareSleepEntryImproved(entry.id);
                
                if (result.success) {
                  Alert.alert('Erfolg', 'Die Freigabe wurde erfolgreich aufgehoben.');
                  // Daten neu laden
                  loadSleepData();
                } else {
                  console.error('Fehler beim Aufheben der Freigabe:', result.error);
                  Alert.alert('Fehler', `Fehler beim Aufheben der Freigabe: ${result.error}`);
                }
              } catch (error) {
                console.error('Unerwarteter Fehler beim Aufheben der Freigabe:', error);
                Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
              } finally {
                setIsSyncing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Aufheben der Freigabe:', error);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    }
  };

  // Fehlende Funktion hinzufügen: Umschalten des expandierten Zustands eines Eintrags
  const toggleExpandedView = (entryId: string) => {
    setSleepEntries(prevEntries => prevEntries.map(entry => ({
      ...entry,
      isExpanded: entry.id === entryId ? !entry.isExpanded : entry.isExpanded
    })));
  };
  
  // Verbesserte Funktion zum Synchronisieren von Schlafeinträgen
  const syncSleepEntries = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um die Synchronisierung zu nutzen.');
        return false;
      }

      setIsSyncing(true);
      const result = await syncAllSleepEntries();
      
      if (result.success) {
        console.log(`Synchronisierung erfolgreich: ${result.syncedCount || 0} Einträge synchronisiert`);
        setSyncInfo({
          lastSync: new Date(),
          syncedCount: result.syncedCount || 0,
          message: result.message
        });
        
        // Lade Daten neu nach erfolgreicher Synchronisierung
        await loadSleepData();
        return true;
      } else {
        console.error('Fehler bei der Synchronisierung:', result.error);
        setSyncInfo({
          lastSync: new Date(),
          error: result.error,
          message: result.message
        });
        return false;
      }
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Synchronisierung:', error);
      setSyncInfo({
        lastSync: new Date(),
        error: 'Unerwarteter Fehler bei der Synchronisierung',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title="Schlaf-Tracker" 
          showBackButton={false}
        />
        
        {/* Kalender-Button (unten rechts) */}
        <TouchableOpacity 
          style={{
            position: 'absolute',
            bottom: 30,
            right: 20,
            zIndex: 999,
            backgroundColor: 'rgba(168, 216, 168, 0.9)',
            width: 50,
            height: 50,
            borderRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 5
          }}
          onPress={toggleInfoPopup}
        >
          <IconSymbol name="calendar" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadSleepData();
                await loadConnectedUsers();
                setRefreshing(false);
              }}
            />
          }
        >
          {/* Debug-Panel (nur im Debug-Modus sichtbar) */}
          {debugMode && (
            <ThemedView 
              style={styles.debugPanel} 
              lightColor="#FFE0B2" 
              darkColor="#3E2723"
            >
              <ThemedText style={styles.debugTitle}>Debug-Modus</ThemedText>
              
              <View style={styles.debugRow}>
                <ThemedText>Verbindungsstatus: </ThemedText>
                <View style={[
                  styles.connectionStatusDot, 
                  { backgroundColor: 
                    connectionStatus === 'connected' ? '#4CAF50' : 
                    connectionStatus === 'loading' ? '#FFC107' : '#F44336' 
                  }
                ]} />
                <ThemedText>
                  {connectionStatus === 'connected' ? 'Verbunden' : 
                   connectionStatus === 'loading' ? 'Wird geladen...' : 'Nicht verbunden'}
                </ThemedText>
              </View>
              
              <ThemedText style={styles.debugLabel}>Verbundene Nutzer ({connectedUsers.length}):</ThemedText>
              {connectedUsers.length > 0 ? (
                connectedUsers.map((conn, index) => (
                  <View key={conn.connectionId} style={styles.connectedUserItem}>
                    <ThemedText>{conn.displayName}</ThemedText>
                    <ThemedText style={styles.debugSmallText}>ID: {conn.userId}</ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.debugSmallText}>Keine verbundenen Nutzer gefunden</ThemedText>
              )}
              
              <View style={styles.debugButtons}>
                <TouchableOpacity 
                  style={styles.debugButton}
                  onPress={createTestConnection}
                >
                  <ThemedText style={styles.debugButtonText}>Test-Verbindung erstellen</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.debugButton}
                  onPress={loadConnectedUsers}
                >
                  <ThemedText style={styles.debugButtonText}>Verbindungen neu laden</ThemedText>
                </TouchableOpacity>
              </View>
              
              <View style={styles.debugButtons}>
                <TouchableOpacity 
                  style={styles.debugButton}
                  onPress={syncSleepEntries}
                  disabled={isSyncing}
                >
                  <ThemedText style={styles.debugButtonText}>
                    {isSyncing ? 'Synchronisiere...' : 'Schlafeinträge synchronisieren'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              
              <ThemedText style={styles.debugFooter}>
                Deine Benutzer-ID: {user?.id}
              </ThemedText>
            </ThemedView>
          )}

          {/* Sync Status indicator (shown when syncing) */}
          {isSyncing && (
            <View style={styles.syncingContainer}>
              <ActivityIndicator color="#A8D8A8" size="small" />
              <ThemedText style={styles.syncingText}>Synchronisiere...</ThemedText>
            </View>
          )}

          {/* Verbindungs-Banner (nur bei vorhandenen Verbindungen) */}
          {connectedUsers.length > 0 && (
            <View style={styles.connectionBanner}>
              <View style={styles.connectionIconContainer}>
                <IconSymbol name="link.circle.fill" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.connectionText}>
                {connectedUsers.length === 1
                  ? `Daten werden mit ${connectedUsers[0].displayName} geteilt`
                  : `Daten werden mit ${connectedUsers.length} Personen geteilt`}
              </Text>
              {!isSyncing && (
                <TouchableOpacity 
                  style={styles.syncButton} 
                  onPress={syncSleepEntries}
                >
                  <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Synchronization error message */}
          {syncInfo?.error && (
            <View style={styles.syncErrorContainer}>
              <ThemedText style={styles.syncErrorTitle}>Fehler bei der Synchronisierung</ThemedText>
              <ThemedText style={styles.syncErrorText}>{syncInfo.error}</ThemedText>
            </View>
          )}

          {/* Statistiken mit verbessertem Design */}
          <View style={styles.statsRow}>
            <ThemedView 
              style={styles.statCard} 
              lightColor={theme.card} 
              darkColor={theme.cardDark}
            >
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBackground, { backgroundColor: '#F2E2CE' }]}>
                  <IconSymbol name="clock.fill" size={20} color="#5C4033" />
                </View>
              </View>
              <ThemedText style={styles.statValue}>{formatDuration(totalSleepToday)}</ThemedText>
              <ThemedText style={styles.statLabel}>Schlaf heute</ThemedText>
            </ThemedView>

            <ThemedView 
              style={styles.statCard} 
              lightColor={theme.card} 
              darkColor={theme.cardDark}
            >
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBackground, { backgroundColor: '#9DBEBB' }]}>
                  <IconSymbol name="chart.bar.fill" size={20} color="#5C4033" />
                </View>
              </View>
              <ThemedText style={styles.statValue}>{formatDuration(averageSleepDuration)}</ThemedText>
              <ThemedText style={styles.statLabel}>Ø Schlafdauer</ThemedText>
            </ThemedView>
          </View>

          {/* Kreisförmige Ansicht */}
          <View style={styles.circleViewCard}>
            {renderCircularDayView()}
            
            {/* Anzeige der Startzeit, falls eine Aufzeichnung läuft */}
            {isTracking && currentEntry && (
              <ThemedText style={styles.startTimeText}>
                Beginn: {format(currentEntry.start_time, 'dd.MM.yyyy HH:mm:ss', { locale: de })}
              </ThemedText>
            )}
          </View>

          {/* Frühere Einträge mit verbessertem Design */}
          <ThemedView 
            style={styles.entriesContainer} 
            lightColor={theme.card} 
            darkColor={theme.cardDark}
          >
            <View style={styles.entriesHeader}>
              <ThemedText style={styles.entriesTitle}>Frühere Schlafeinträge</ThemedText>
              <ThemedText style={styles.entriesCount}>{sleepEntries.length} Einträge</ThemedText>
            </View>
            
            {sleepEntries.length > 0 ? (
              <View>
                {Object.keys(groupedEntries).length > 0 ? (
                  // Wir fügen hier eine try-catch-Block hinzu, um Renderingfehler abzufangen
                  <View>
                    {(() => {
                      try {
                        const dateKeys = Object.keys(groupedEntries)
                          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                        
                        console.log(`Rendere ${dateKeys.length} Datums-Gruppen:`, dateKeys);
                        
                        return dateKeys.map(date => {
                          console.log(`Rendere Gruppe für Datum: ${date} mit ${groupedEntries[date]?.length || 0} Einträgen`);
                          const result = renderDateGroup(date, groupedEntries[date]);
                          if (!result) {
                            console.warn(`Keine Ergebnisse für Gruppe ${date} erhalten`);
                          }
                          return result;
                        }).filter(Boolean); // Filtere null/undefined Einträge
                      } catch (error) {
                        console.error('Fehler beim Rendern der gruppierten Einträge:', error);
                        return (
                          <View style={styles.errorContainer}>
                            <IconSymbol name="exclamationmark.triangle" size={40} color="#FF6B6B" />
                            <ThemedText style={styles.errorText}>
                              Fehler beim Laden der Einträge.
                            </ThemedText>
                            <TouchableOpacity 
                              style={styles.retryButton}
                              onPress={() => loadSleepData()}
                            >
                              <ThemedText style={styles.retryButtonText}>Erneut versuchen</ThemedText>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                    })()}
                  </View>
                ) : (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                    <ThemedText style={styles.loadingText}>Schlafeinträge werden geladen...</ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noEntriesContainer}>
                <IconSymbol name="moon.zzz.fill" size={40} color="#E0E0E0" />
                <ThemedText style={styles.noEntriesText}>
                  Noch keine Schlafeinträge vorhanden.
                </ThemedText>
                <TouchableOpacity
                  style={styles.createButtonContainer}
                  onPress={handleStartSleepTracking}
                >
                  <LinearGradient
                    colors={['#5DBE70', '#4A9E5C']}
                    style={styles.createButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <IconSymbol name="plus" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.createButtonText}>Schlafaufzeichnung starten</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ThemedView>
        </ScrollView>

        {/* Schlaf-Eintrag Detail Modal */}
        {showDetailModal && selectedSleepEntry && (
          <View style={styles.detailModalOverlay}>
            <ThemedView style={styles.detailModalContainer} lightColor={theme.card} darkColor={theme.cardDark}>
              <View style={styles.detailModalHeader}>
                <ThemedText style={styles.detailModalTitle}>Schlafeintrag Details</ThemedText>
                <TouchableOpacity onPress={closeDetailModal} style={styles.closeButton}>
                  <IconSymbol name="xmark.circle.fill" size={24} color="#7D5A50" />
                </TouchableOpacity>
              </View>
              
              {/* Detail-Info */}
              <View style={styles.detailContent}>
                {/* Creator info - neu hinzugefügt */}
                <View style={styles.detailRow}>
                  <IconSymbol name="person.fill" size={18} color="#9DBEBB" />
                  <ThemedText style={styles.detailLabel}>Erstellt von:</ThemedText>
                  <View style={styles.creatorContainer}>
                    <ThemedText style={styles.detailValue}>{selectedSleepEntry.creatorName}</ThemedText>
                    {selectedSleepEntry.isShared && (
                      <View style={styles.sharedBadge}>
                        <IconSymbol name="link.circle.fill" size={12} color="#FFFFFF" />
                        <ThemedText style={styles.sharedBadgeText}>Geteilt</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.detailRow}>
                  <IconSymbol name="clock.fill" size={18} color="#9DBEBB" />
                  <ThemedText style={styles.detailLabel}>Dauer:</ThemedText>
                  <ThemedText style={styles.detailValue}>{selectedSleepEntry.duration}</ThemedText>
                </View>
                
                <View style={styles.detailRow}>
                  <IconSymbol name="calendar" size={18} color="#9DBEBB" />
                  <ThemedText style={styles.detailLabel}>Start:</ThemedText>
                  <ThemedText style={styles.detailValue}>{selectedSleepEntry.startTime}</ThemedText>
                </View>
                
                <View style={styles.detailRow}>
                  <IconSymbol name="calendar" size={18} color="#9DBEBB" />
                  <ThemedText style={styles.detailLabel}>Ende:</ThemedText>
                  <ThemedText style={styles.detailValue}>{selectedSleepEntry.endTime}</ThemedText>
                </View>
                
                <View style={styles.detailRow}>
                  <IconSymbol name="star.fill" size={18} color={
                    selectedSleepEntry.quality === 'good' ? '#9DBEBB' : 
                    selectedSleepEntry.quality === 'medium' ? '#FFC107' : '#FF6B6B'
                  } />
                  <ThemedText style={styles.detailLabel}>Qualität:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedSleepEntry.quality === 'good' ? 'Gut' : 
                     selectedSleepEntry.quality === 'medium' ? 'Mittel' : 'Schlecht'}
                  </ThemedText>
                </View>
                
                {selectedSleepEntry.notes ? (
                  <View style={styles.notesSection}>
                    <ThemedText style={styles.notesLabel}>Notizen:</ThemedText>
                    <ThemedView style={styles.notesBox} lightColor="rgba(233, 201, 182, 0.1)" darkColor="rgba(60, 50, 48, 0.3)">
                      <ThemedText style={styles.notesContent}>{selectedSleepEntry.notes}</ThemedText>
                    </ThemedView>
                  </View>
                ) : null}
              </View>
              
              <TouchableOpacity 
                style={styles.deleteEntryButton}
                onPress={() => {
                  closeDetailModal();
                  handleDeleteSleepEntry(selectedSleepEntry.id);
                }}
              >
                <IconSymbol name="trash" size={16} color="#FF6B6B" />
                <ThemedText style={styles.deleteEntryButtonText}>Eintrag löschen</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        )}

        {/* Notiz-Eingabe-Modal mit verbessertem Design */}
        {showNoteInput && (
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContainer} lightColor={theme.card} darkColor={theme.cardDark}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Schlafaufzeichnung abschließen</ThemedText>
                <IconSymbol name="moon.fill" size={24} color="#7D5A50" />
              </View>
              
              <View style={styles.qualitySelection}>
                <ThemedText style={styles.qualityLabel}>Schlafqualität:</ThemedText>
                <View style={styles.qualityButtons}>
                  <TouchableOpacity 
                    style={[
                      styles.qualityButton, 
                      selectedQuality === 'good' && styles.qualityButtonSelected,
                      { borderColor: '#4CAF50' }
                    ]}
                    onPress={() => setSelectedQuality('good')}
                  >
                    <IconSymbol name="star.fill" size={16} color="#4CAF50" />
                    <ThemedText style={styles.qualityButtonText}>Gut</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.qualityButton, 
                      selectedQuality === 'medium' && styles.qualityButtonSelected,
                      { borderColor: '#FFC107' }
                    ]}
                    onPress={() => setSelectedQuality('medium')}
                  >
                    <IconSymbol name="star.fill" size={16} color="#FFC107" />
                    <ThemedText style={styles.qualityButtonText}>Mittel</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.qualityButton, 
                      selectedQuality === 'bad' && styles.qualityButtonSelected,
                      { borderColor: '#F44336' }
                    ]}
                    onPress={() => setSelectedQuality('bad')}
                  >
                    <IconSymbol name="star.fill" size={16} color="#F44336" />
                    <ThemedText style={styles.qualityButtonText}>Schlecht</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <ThemedText style={styles.notesLabel}>Notizen (optional):</ThemedText>
              <ThemedView style={styles.notesInput} lightColor="#F5F5F5" darkColor="#2A2A2A">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="z.B. Schwer eingeschlafen, häufig aufgewacht..."
                  placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                  multiline
                  style={{
                    color: colorScheme === 'dark' ? '#FFF' : '#333',
                    padding: 10,
                    height: 100,
                    textAlignVertical: 'top'
                  }}
                />
              </ThemedView>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.discardButton]}
                  onPress={discardSleepEntry}
                >
                  <ThemedText style={styles.discardButtonText}>Verwerfen</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelNoteInput}
                >
                  <ThemedText style={styles.cancelButtonText}>Abbrechen</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveNoteAndFinishEntry}
                >
                  <LinearGradient
                    colors={['#5DBE70', '#4A9E5C']}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        )}
      </SafeAreaView>

      {/* Info-PopUp Modal */}
      {showInfoPopup && (
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.infoModalContainer} lightColor={theme.card} darkColor={theme.cardDark}>
            <View style={styles.infoModalHeader}>
              <ThemedText style={styles.infoModalTitle}>Schlaftracker Übersicht</ThemedText>
              <TouchableOpacity onPress={closeInfoPopup} style={styles.closeButton}>
                <IconSymbol name="xmark.circle.fill" size={24} color="#7D5A50" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.infoModalContent}>
              {/* Kalender-Heatmap für die Schlafqualität */}
              <View style={styles.infoSection}>
                <ThemedText style={styles.infoSectionTitle}>Monatsübersicht - Schlafqualität</ThemedText>
                <ThemedText style={styles.infoText}>
                  Die Farben zeigen, wie gut dein Baby an den verschiedenen Tagen geschlafen hat. Jeder Tag wird anhand der am längsten vorkommenden Schlafqualität bewertet.
                </ThemedText>
                
                <CalendarHeatmap groupedEntries={groupedEntries} />
              </View>
              
              <View style={styles.infoSection}>
                <ThemedText style={styles.infoSectionTitle}>Wie funktioniert der Schlaftracker?</ThemedText>
                <ThemedText style={styles.infoText}>
                  Mit dem Schlaftracker kannst du die Schlafzeiten deines Babys protokollieren. Starte den Tracker, wenn dein Baby einschläft, und stoppe ihn, wenn es aufwacht.
                </ThemedText>
              </View>
              
              <View style={styles.infoSection}>
                <ThemedText style={styles.infoSectionTitle}>Tipps zur Verwendung</ThemedText>
                <View style={styles.tipItem}>
                  <IconSymbol name="1.circle.fill" size={20} color="#A8D8A8" />
                  <ThemedText style={styles.tipText}>Tippe auf Start, wenn dein Baby einschläft.</ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <IconSymbol name="2.circle.fill" size={20} color="#A8D8A8" />
                  <ThemedText style={styles.tipText}>Tippe auf Stopp, wenn dein Baby aufwacht.</ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <IconSymbol name="3.circle.fill" size={20} color="#A8D8A8" />
                  <ThemedText style={styles.tipText}>Bewerte die Schlafqualität und füge optional Notizen hinzu.</ThemedText>
                </View>
                <View style={styles.tipItem}>
                  <IconSymbol name="4.circle.fill" size={20} color="#A8D8A8" />
                  <ThemedText style={styles.tipText}>Tippe auf einen früheren Eintrag, um Details zu sehen oder den Eintrag zu bearbeiten.</ThemedText>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeInfoButton}
              onPress={closeInfoPopup}
            >
              <ThemedText style={styles.closeInfoButtonText}>Verstanden</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      )}

      {/* Sync-Funktionalität ist jetzt vollständig in die App integriert */}

      {/* Debug-Info-Panel - immer sichtbar für Fehlerbehebung */}
      <View style={styles.debugInfoPanel}>
        <Text style={styles.debugInfoText}>
          Schlafeinträge: {sleepEntries.length} | 
          Gruppierte Daten: {Object.keys(groupedEntries).length > 0 ? 
            `${Object.keys(groupedEntries).length} Tage (${Object.keys(groupedEntries).join(', ')})` : 
            'Keine'} |
          Partner-Feature: Aktiv (Abfrage inkl. shared_with_user_id)
        </Text>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 5,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statIconContainer: {
    marginBottom: 10,
  },
  statIconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  circleViewCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    backgroundColor: '#0E0B28', // Fester dunkler Hintergrund unabhängig vom Theming
    overflow: 'hidden',
  },
  circleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  circularLegend: {
    marginTop: 10,
    marginBottom: 5,
    alignItems: 'center',
  },
  legendTitle: {
    marginBottom: 10,
  },
  legendTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4F0E5',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legendCircleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginVertical: 5,
  },
  legendCircleColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  legendTextCircle: {
    fontSize: 16,
    color: '#F4F0E5',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  entriesContainer: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  entriesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5C4033',
  },
  entriesCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  entrySeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 10,
  },
  noEntriesContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noEntriesText: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 10,
  },
  // Styles für die neue Timeline-Ansicht im Wehen-Tracker-Stil
  dayContainer: {
    marginBottom: 24,
  },
  dateHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeColumn: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lineColumn: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#DDDDDD',
    position: 'absolute',
    top: 12,
    bottom: -16,
    left: 11,
  },
  cardColumn: {
    flex: 1,
    paddingLeft: 8,
  },
  // Neue Kartenkomponenten-Styles basierend auf dem Wehen-Tracker
  sleepCard: {
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8,
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardDetails: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#DDDDDD',
    marginVertical: 8,
  },
  expandedDetails: {
    marginTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 216, 168, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#A8D8A8',
  },
  editButtonText: {
    color: '#A8D8A8',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 143, 249, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#6C8FF9',
  },
  shareButtonText: {
    color: '#6C8FF9',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  unshareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 198, 108, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F9C66C',
  },
  unshareButtonText: {
    color: '#F9C66C',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5C4033',
  },
  qualitySelection: {
    marginBottom: 20,
  },
  qualityLabel: {
    fontSize: 16,
    marginBottom: 12,
    color: '#7D5A50',
  },
  qualityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  qualityButtonSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  qualityButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  notesLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#7D5A50',
  },
  notesInput: {
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  discardButton: {
    backgroundColor: '#FFE0E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  discardButtonText: {
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  startTimeText: {
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.7,
  },
  detailModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  detailModalContainer: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 159, 129, 0.3)',
    paddingBottom: 10,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5C4033',
  },
  closeButton: {
    padding: 5,
  },
  detailContent: {
    marginBottom: 20,
  },
  detailModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailModalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7D5A50',
    marginLeft: 8,
    width: 60,
  },
  detailModalValue: {
    fontSize: 15,
    color: '#5C4033',
    flex: 1,
  },
  notesSection: {
    marginTop: 10,
  },
  notesBox: {
    padding: 12,
    borderRadius: 10,
    minHeight: 80,
  },
  notesContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5C4033',
  },
  deleteEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 15,
    alignSelf: 'center',
  },
  deleteEntryButtonText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },

  syncButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3F51B5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  connectionIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  connectionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  debugPanel: {
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 5,
  },
  debugSmallText: {
    fontSize: 12,
    opacity: 0.8,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  connectionStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  connectedUserItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  debugButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  debugButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  debugButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  debugFooter: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 15,
    textAlign: 'center',
  },
  syncStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  syncStatusText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginLeft: 3,
  },
  syncedItemsBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  syncedItemsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3F51B5',
  },
  syncErrorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  syncErrorTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#F44336',
  },
  syncErrorText: {
    fontSize: 12,
  },
  debugButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  // Styles für den Info-Button und das Info-PopUp
  infoButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A8D8A8', // Passend zu den Pastelfarben des Trackers
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  infoModalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  infoModalContent: {
    maxHeight: Dimensions.get('window').height * 0.7,
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5C4033',
    marginBottom: 15,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 5,
  },
  tipText: {
    fontSize: 14,
    color: '#5C4033',
    marginLeft: 10,
    flex: 1,
  },
  closeInfoButton: {
    backgroundColor: '#A8D8A8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeInfoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Styles für den Kalender
  calendarContainer: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#7D5A50',
    textTransform: 'capitalize',
  },
  calendarDayNames: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  calendarDayNameCell: {
    flex: 1,
    alignItems: 'center',
    padding: 5,
  },
  calendarDayNameText: {
    fontSize: 12,
    color: '#7D5A50',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%', // 7 Tage pro Woche
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTodayCell: {
    borderWidth: 1,
    borderColor: '#7D5A50',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 12,
    color: '#7D5A50',
  },
  calendarDayIndicator: {
    width: '80%',
    height: '30%',
    borderRadius: 4,
    marginTop: 3,
  },
  calendarLegend: {
    marginTop: 15,
  },
  calendarLegendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 8,
  },
  calendarLegendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  calendarLegendText: {
    fontSize: 12,
    color: '#7D5A50',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginBottom: 10,
  },
  syncingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#7D5A50',
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  creatorContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sharedBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(63, 81, 181, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  sharedBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  partnerEntryCard: {
    borderRightWidth: 4,
    borderRightColor: 'rgba(63, 81, 181, 0.7)',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 81, 181, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  creatorBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  partnerLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  partnerLegendLine: {
    width: 20,
    height: 3,
    marginRight: 8,
    borderColor: 'rgba(63, 81, 181, 0.9)',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#7D5A50',
    marginTop: 10,
  },
  debugContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  debugButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  debugButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  debugInfoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10, 
    borderRadius: 8,
    zIndex: 1000,
  },
  debugInfoText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#A8D8A8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButtonContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  editButton: {
    backgroundColor: '#A8D8A8',
  },
  shareButton: {
    backgroundColor: '#6C8FF9',
  },
  unshareButton: {
    backgroundColor: '#F9C66C',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  // Sync-Test-Styles wurden entfernt, da nicht mehr benötigt
}); 