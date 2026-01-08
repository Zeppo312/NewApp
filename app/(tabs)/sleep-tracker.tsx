
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  Animated,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedBackground } from '@/components/ThemedBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import TextInputOverlay from '@/components/modals/TextInputOverlay';

import { SleepEntry, SleepQuality, startSleepTracking, stopSleepTracking, loadConnectedUsers } from '@/lib/sleepData';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import ActivityInputModal from '@/components/ActivityInputModal';
// SplashOverlay Import entfernt - keine Popups
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressCircle } from '@/components/ProgressCircle';
import type { ViewStyle } from 'react-native';
import { GlassCard, LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM, RADIUS, PRIMARY, GLASS_BORDER, GLASS_OVERLAY, FONT_SM, FONT_MD, FONT_LG } from '@/constants/DesignGuide';
import { getBabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { predictNextSleepWindow, updatePersonalizationAfterNap, type SleepWindowPrediction } from '@/lib/sleep-window';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Typografie helper
const FONT_NUM = { fontVariant: ['tabular-nums'] };

// Globale Helper-Funktionen für Zeitberechnungen
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart)) / 60000 | 0;

// Match Timeline (ActivityCard marginHorizontal=8 -> 16px gesamt)
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

const COLS = 7;
const GUTTER = 4; // weniger Abstand zwischen Spalten => mehr Netto-Breite
const COL_WIDTH = Math.floor((contentWidth - (COLS - 1) * GUTTER) / COLS);
const totalGutters = (COLS - 1) * GUTTER;
const colsWidth = COLS * COL_WIDTH;
const leftover = contentWidth - (colsWidth + totalGutters); // 0..(COLS-1)

// Week-Chart spezifische Konstanten (wie Timeline)
const WEEK_CONTENT_WIDTH = contentWidth - TIMELINE_INSET * 2;
const WEEK_COL_WIDTH   = Math.floor((WEEK_CONTENT_WIDTH - (COLS - 1) * GUTTER) / COLS);
const WEEK_COLS_WIDTH  = COLS * WEEK_COL_WIDTH;
const WEEK_LEFTOVER    = WEEK_CONTENT_WIDTH - (WEEK_COLS_WIDTH + totalGutters);

// Highlight-Karten Konstanten (2-Spalten Layout)
const HL_COLS = 2;
const HL_GUTTER = 12;
const HL_COL_WIDTH = Math.floor((WEEK_CONTENT_WIDTH - (HL_COLS - 1) * HL_GUTTER) / HL_COLS);
const HL_COLS_WIDTH = HL_COLS * HL_COL_WIDTH;
const HL_LEFTOVER = WEEK_CONTENT_WIDTH - (HL_COLS_WIDTH + (HL_COLS - 1) * HL_GUTTER);

// Action Buttons Konstanten (2-Spalten Layout)
const GRID_COLS = 2;
const GRID_GUTTER = 12;
const GRID_COL_W = Math.floor((contentWidth - (GRID_COLS - 1) * GRID_GUTTER) / GRID_COLS);
const GRID_LEFTOVER = contentWidth - (GRID_COLS * GRID_COL_W + (GRID_COLS - 1) * GRID_GUTTER);

const MAX_BAR_H = 140; // Höhe der Balkenfläche (mehr Luft)

// GlassCard imported from DesignGuide

// Types for sleep periods
type SleepPeriod = 'day' | 'night';

// Sleep Entry with period classification
interface ClassifiedSleepEntry extends SleepEntry {
  period: SleepPeriod;
  isActive: boolean;
}

// Convert SleepEntry to DailyEntry format for ActivityCard
const convertSleepToDailyEntry = (sleepEntry: ClassifiedSleepEntry): any => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Bestimme Schlaftyp basierend auf Startzeit
    const getSleepType = (startTime: string | Date, durationMinutes?: number) => {
    const date = new Date(startTime);
    const hour = date.getHours();
    
    // Nickerchen: max 30 Minuten
    if (durationMinutes && durationMinutes <= 30) {
      return 'nickerchen';
    }
    
    // Nachtschlaf: 18:00-06:00
    if (hour >= 18 || hour <= 6) {
      return 'nacht';
    }
    
    // Mittagsschlaf: 12:00-14:00
    if (hour >= 12 && hour <= 14) {
      return 'mittag';
    }
    
    // Tagschlaf: 06:01-17:59 (außer Mittagszeit)
    return 'tag';
  };

  const getSleepEmoji = (sleepType: string, quality?: SleepQuality) => {
    if (sleepType === 'nickerchen') return '😌';
    if (sleepType === 'nacht') return '💤';
    if (sleepType === 'mittag') return '😴';
    if (sleepType === 'tag') return '☀️';
    
    // Fallback basierend auf Qualität
    switch (quality) {
      case 'good': return '😴';
      case 'medium': return '😐';
      case 'bad': return '😵';
      default: return '💤';
    }
  };

  const getSleepLabel = (sleepType: string, quality?: SleepQuality) => {
    let baseLabel = '';
    
    switch (sleepType) {
      case 'nickerchen': baseLabel = 'Nickerchen'; break;
      case 'nacht': baseLabel = 'Nachtschlaf'; break;
      case 'mittag': baseLabel = 'Mittagsschlaf'; break;
      case 'tag': baseLabel = 'Tagschlaf'; break;
      default: baseLabel = 'Schlaf'; break;
    }
    
    if (!quality) return baseLabel;
    
    switch (quality) {
      case 'good': return `Guter ${baseLabel}`;
      case 'medium': return `Mittlerer ${baseLabel}`;
      case 'bad': return `Schlechter ${baseLabel}`;
      default: return baseLabel;
    }
  };

  // Bestimme Schlaftyp basierend auf Startzeit und Dauer
  const sleepType = getSleepType(sleepEntry.start_time, sleepEntry.duration_minutes);

  const notes = [];
  if (sleepEntry.quality) {
    notes.push(`Qualität: ${sleepEntry.quality === 'good' ? 'Gut' : sleepEntry.quality === 'medium' ? 'Mittel' : 'Schlecht'}`);
  }
  if (sleepEntry.notes) {
    notes.push(sleepEntry.notes);
  }
  if (sleepEntry.duration_minutes) {
    notes.push(`Dauer: ${formatDuration(sleepEntry.duration_minutes)}`);
  }

  return {
    id: sleepEntry.id,
    entry_date: sleepEntry.start_time,
    entry_type: 'sleep',
    start_time: sleepEntry.start_time,
    end_time: sleepEntry.end_time,
    notes: notes.join(' • '),
    feeding_type: undefined,
    feeding_volume_ml: undefined,
    feeding_side: undefined,
    diaper_type: undefined,
    // Sleep-specific data
    sleep_quality: sleepEntry.quality,
    sleep_type: sleepType,
    duration_minutes: sleepEntry.duration_minutes,
    // For ActivityCard compatibility
    sub_type: `sleep_${sleepEntry.quality || 'unknown'}_${sleepType}`,
    emoji: getSleepEmoji(sleepType, sleepEntry.quality),
    label: getSleepLabel(sleepType, sleepEntry.quality)
  };
};

// Manual entry modal data
interface ManualEntryData {
  start_time: Date;
  end_time?: Date;
  quality?: SleepQuality;
  notes?: string;
  period: SleepPeriod;
}

// LiquidGlassCard imported from DesignGuide


export default function SleepTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const { activeBabyId } = useActiveBaby();
  const paywallCheckInFlight = useRef(false);
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  // State management
  const [sleepEntries, setSleepEntries] = useState<ClassifiedSleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSleepEntry, setActiveSleepEntry] = useState<ClassifiedSleepEntry | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingEntry, setEditingEntry] = useState<ClassifiedSleepEntry | null>(null);
  const hasAutoSelectedDateRef = useRef(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Navigation offsets für Woche und Monat
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = diese Woche, -1 = letzte, +1 = nächste
  const [monthOffset, setMonthOffset] = useState(0); // 0 = dieser Monat, -1 = vorheriger, +1 = nächster
  const [currentTime, setCurrentTime] = useState(new Date());
  const [babyBirthdate, setBabyBirthdate] = useState<Date | null>(null);
  const [sleepPrediction, setSleepPrediction] = useState<SleepWindowPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const predictionRef = useRef<SleepWindowPrediction | null>(null);

  // Bei Tabwechsel Offsets zurücksetzen
  useEffect(() => {
    setWeekOffset(0);
    setMonthOffset(0);
  }, [selectedTab]);

  // Splash System komplett entfernt - saubere Sleep-Tracker Implementierung

  // Sleep Modal States
  const [sleepModalData, setSleepModalData] = useState({
    start_time: new Date(),
    end_time: null as Date | null,
    quality: null as SleepQuality | null,
    notes: ''
  });

  // Notes overlay (wie Planner)
  const [notesOverlayVisible, setNotesOverlayVisible] = useState(false);
  const [notesOverlayValue, setNotesOverlayValue] = useState('');

  const openNotesEditor = () => {
    setNotesOverlayValue(sleepModalData.notes ?? '');
    setNotesOverlayVisible(true);
  };

  const closeNotesEditor = () => {
    setNotesOverlayVisible(false);
    setNotesOverlayValue('');
  };

  const saveNotesEditor = (next?: string) => {
    const val = typeof next === 'string' ? next : notesOverlayValue;
    setSleepModalData((prev) => ({ ...prev, notes: val }));
    closeNotesEditor();
  };

  useEffect(() => {
    if (!showInputModal) {
      closeNotesEditor();
    }
  }, [showInputModal]);

  const checkPaywallGate = useCallback(async () => {
    if (paywallCheckInFlight.current || !user) return;
    paywallCheckInFlight.current = true;

    try {
      const { shouldShow } = await shouldShowPaywall();
      if (shouldShow) {
        await markPaywallShown('sleep-tracker');
        router.push({
          pathname: '/paywall',
          params: { next: '/(tabs)/sleep-tracker', origin: 'sleep-tracker' }
        });
      }
    } catch (err) {
      console.error('Paywall check on sleep tracker failed:', err);
    } finally {
      paywallCheckInFlight.current = false;
    }
  }, [router, user]);

  useFocusEffect(
    useCallback(() => {
      checkPaywallGate();
    }, [checkPaywallGate])
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Splash System wie in daily_old.tsx
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashBg, setSplashBg] = useState<string>('rgba(0,0,0,0.6)');
  const [splashEmoji, setSplashEmoji] = useState<string>('✅');
  const [splashText, setSplashText] = useState<string>('Gespeichert');
  const splashAnim = useRef(new Animated.Value(0)).current;
  const splashEmojiAnim = useRef(new Animated.Value(0.9)).current;
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [splashTitle, setSplashTitle] = useState<string>('');
  const [splashSubtitle, setSplashSubtitle] = useState<string>('');
  const [splashStatus, setSplashStatus] = useState<string>('');
  const [splashHint, setSplashHint] = useState<string>('');

  // Animation refs
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [elapsedTime, setElapsedTime] = useState(0);
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSleepData();
  }, [activeBabyId]);

  // Lade die aktuelle Partner-ID (aus account_links) für neue Einträge
  const refreshPartnerId = useCallback(async () => {
    if (!user?.id) {
      setPartnerId(null);
      return null;
    }
    try {
      const { success, linkedUsers } = await loadConnectedUsers(true);
      if (success && linkedUsers && linkedUsers.length > 0) {
        setPartnerId(linkedUsers[0].userId);
        return linkedUsers[0].userId;
      }
    } catch (err) {
      console.error('Failed to load partner id:', err);
    }
    setPartnerId(null);
    return null;
  }, [user?.id, activeBabyId]);

  const getEffectivePartnerId = useCallback(async () => {
    if (partnerId) return partnerId;
    return refreshPartnerId();
  }, [partnerId, refreshPartnerId]);

  useEffect(() => {
    refreshPartnerId();
  }, [refreshPartnerId]);

  useEffect(() => {
    if (!user?.id) {
      setBabyBirthdate(null);
      return;
    }

    let isMounted = true;

    const fetchBabyProfile = async () => {
      try {
        const { data } = await getBabyInfo(activeBabyId ?? undefined);
        if (!isMounted) return;

        if (data?.birth_date) {
          const parsed = new Date(data.birth_date);
          setBabyBirthdate(Number.isNaN(parsed.getTime()) ? null : parsed);
        } else {
          setBabyBirthdate(null);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load baby info for sleep prediction:', error);
        }
      }
    };

    fetchBabyProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [appearAnim]);

  // Live time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer animation for active sleep
  useEffect(() => {
    if (activeSleepEntry) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(activeSleepEntry.start_time).getTime();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);

      // Pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        clearInterval(interval);
        pulseAnimation.stop();
      };
    }
  }, [activeSleepEntry, pulseAnim]);

  const updateSleepPrediction = useCallback(
    async (entries: ClassifiedSleepEntry[]) => {
      if (!user?.id) {
        setSleepPrediction(null);
        predictionRef.current = null;
        setPredictionLoading(false);
        return;
      }

      setPredictionLoading(true);
      try {
        const prediction = await predictNextSleepWindow({
          userId: user.id,
          birthdate: babyBirthdate ?? undefined,
          entries,
          anchorBedtime: '19:30',
        });
        setSleepPrediction(prediction);
        predictionRef.current = prediction;
        setPredictionError(null);
      } catch (error) {
        console.error('Failed to predict next sleep window:', error);
        setSleepPrediction(null);
        predictionRef.current = null;
        setPredictionError('Vorhersage aktuell nicht möglich');
      } finally {
        setPredictionLoading(false);
      }
    },
    [user?.id, babyBirthdate]
  );

  useEffect(() => {
    updateSleepPrediction(sleepEntries);
  }, [sleepEntries, updateSleepPrediction]);

  // Classify sleep entry by time period
  const classifySleepEntry = (entry: any): ClassifiedSleepEntry => {
    const startHour = new Date(entry.start_time).getHours();
    const period: SleepPeriod = (startHour >= 6 && startHour < 20) ? 'day' : 'night';
    const isActive = !entry.end_time;
    
    return {
      ...entry,
      period,
      isActive
    };
  };

  // Load sleep data
  const loadSleepData = async () => {
    try {
      setIsLoading(true);
      const { success, entries, error } = await loadAllVisibleSleepEntries(activeBabyId ?? undefined);
      
      if (success && entries) {
        const classifiedEntries = entries.map(classifySleepEntry);
        setSleepEntries(classifiedEntries);
        
        // Find active entry
        const active = classifiedEntries.find(entry => entry.isActive);
        setActiveSleepEntry(active || null);

        // Wenn kein Eintrag für das aktuell ausgewählte Datum vorhanden ist,
        // springe beim ersten Laden automatisch zum jüngsten Eintrag.
        if (
          !hasAutoSelectedDateRef.current &&
          classifiedEntries.length > 0 &&
          !classifiedEntries.some(e => {
            const s = new Date(e.start_time);
            const ee = e.end_time ? new Date(e.end_time) : new Date();
            const ds = startOfDay(selectedDate);
            const de = endOfDay(selectedDate);
            return overlapMinutes(s, ee, ds, de) > 0;
          })
        ) {
          const latest = classifiedEntries.reduce((latestEntry, entry) => {
            if (!latestEntry) return entry;
            return new Date(entry.start_time).getTime() > new Date(latestEntry.start_time).getTime()
              ? entry
              : latestEntry;
          }, null as ClassifiedSleepEntry | null);

          if (latest) {
            hasAutoSelectedDateRef.current = true;
            setSelectedTab('day');
            setSelectedDate(new Date(latest.start_time));
          }
        }
      } else {
        console.error('Error loading sleep data:', error);
      }
    } catch (error) {
      console.error('Failed to load sleep data:', error);
      setPredictionLoading(false);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSleepData();
  };

  // Start sleep tracking
  const handleStartSleep = async (_period: SleepPeriod) => {
    try {
      const effectivePartnerId = await getEffectivePartnerId();
      const { success, entry, error } = await startSleepTracking(
        undefined,
        effectivePartnerId || undefined,
        activeBabyId ?? undefined
      );
      
      if (success && entry) {
        const classifiedEntry = classifySleepEntry(entry);
        setActiveSleepEntry(classifiedEntry);

        if (user?.id && predictionRef.current) {
          try {
            await updatePersonalizationAfterNap(
              user.id,
              predictionRef.current.napIndexToday,
              predictionRef.current.timeOfDayBucket,
              predictionRef.current.recommendedStart,
              new Date(entry.start_time),
            );
          } catch (personalizationError) {
            console.error('Failed to update sleep personalization:', personalizationError);
          } finally {
            predictionRef.current = null;
            setSleepPrediction(null);
            setPredictionError(null);
            setPredictionLoading(true);
          }
        }

        await loadSleepData();

        // Splash anzeigen
        const currentPeriod: SleepPeriod =
          new Date().getHours() >= 20 || new Date().getHours() < 10 ? 'night' : 'day';
        showSuccessSplash(
          '#87CEEB', // Baby blue
          currentPeriod === 'night' ? '🌙' : '😴',
          currentPeriod === 'night' ? 'sleep_start_night' : 'sleep_start_day'
        );
      } else {
        Alert.alert('Fehler', error || 'Schlaftracking konnte nicht gestartet werden');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Starten des Schlaftrackers');
    }
  };

  // Stop sleep tracking
  const handleStopSleep = async (quality?: SleepQuality, notes?: string) => {
    if (!activeSleepEntry?.id) return;

    try {
      const { success, error } = await stopSleepTracking(
        activeSleepEntry.id,
        quality || 'medium',
        notes,
        undefined,
        activeBabyId ?? undefined
      );
      
      if (success) {
        setActiveSleepEntry(null);
        await loadSleepData();

        // Splash anzeigen je nach Qualität
        const splashKind = quality === 'good' ? 'sleep_stop_good' : quality === 'bad' ? 'sleep_stop_bad' : 'sleep_stop_medium';
        const splashColor = quality === 'good' ? '#38A169' : quality === 'bad' ? '#E53E3E' : '#F5A623';
        const splashEmoji = quality === 'good' ? '😴' : quality === 'bad' ? '😵' : '😐';
        showSuccessSplash(splashColor, splashEmoji, splashKind);
      } else {
        Alert.alert('Fehler', error || 'Schlaftracking konnte nicht gestoppt werden');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Stoppen des Schlaftrackers');
    }
  };

  // Handle save entry (compatible with SleepInputModal)
  const handleSaveEntry = async (payload: any) => {
    try {
      if (!user?.id) {
        Alert.alert('Fehler', 'Benutzer nicht angemeldet');
        return;
      }

      console.log('🔍 handleSaveEntry called with:', payload);
      console.log('🔍 editingEntry:', editingEntry);

      const effectivePartnerId = await getEffectivePartnerId();

      // SleepInputModal sendet die Daten direkt als Objekt
      const sleepData = payload;

      // Validierung der Daten
      if (!sleepData.start_time) {
        Alert.alert('Fehler', 'Startzeit ist erforderlich');
        return;
      }

      if (editingEntry?.id) {
        console.log('🔄 Updating existing entry:', editingEntry.id);
        // Update existing entry
        let updateQuery = supabase
          .from('sleep_entries')
          .update({
            start_time: sleepData.start_time,
            end_time: sleepData.end_time ?? null,
            quality: sleepData.quality || null,
            notes: sleepData.notes ?? null,
            duration_minutes: sleepData.end_time
              ? Math.round((new Date(sleepData.end_time).getTime() - new Date(sleepData.start_time).getTime()) / 60000)
            : null,
            partner_id: editingEntry.partner_id ?? effectivePartnerId ?? null
        })
          .eq('id', editingEntry.id);

        if (activeBabyId) {
          updateQuery = updateQuery.eq('baby_id', activeBabyId);
        }

        const { data, error } = await updateQuery.select();

        if (error) {
          console.error('❌ Update error:', error);
          Alert.alert('Fehler beim Aktualisieren', `${error.message}\nCode: ${error.code || 'unknown'}`);
          return;
        }

        console.log('✅ Entry updated successfully:', data);
        // Splash anzeigen für Bearbeitung
        showSuccessSplash('#4A90E2', '✏️', 'sleep_edit_save');
      } else {
        console.log('➕ Creating new entry');
        // Create new entry
        const { data, error } = await supabase
          .from('sleep_entries')
          .insert({
            user_id: user.id,
            baby_id: activeBabyId ?? null,
            start_time: sleepData.start_time,
            end_time: sleepData.end_time ?? null,
            quality: sleepData.quality || null,
            notes: sleepData.notes ?? null,
            duration_minutes: sleepData.end_time
              ? Math.round((new Date(sleepData.end_time).getTime() - new Date(sleepData.start_time).getTime()) / 60000)
            : null,
            partner_id: effectivePartnerId ?? null
          })
          .select();

        if (error) {
          console.error('❌ Insert error:', error);
          Alert.alert('Fehler beim Speichern', `${error.message}\nCode: ${error.code || 'unknown'}\nHint: ${error.hint || 'keine'}`);
          return;
        }

        console.log('✅ Entry created successfully:', data);
        // Splash anzeigen für neuen Eintrag
        showSuccessSplash('#8E4EC6', '💤', 'sleep_manual_save');
      }

      setShowInputModal(false);
      setEditingEntry(null);
      setSleepModalData({
        start_time: new Date(),
        end_time: null,
        quality: null,
        notes: ''
      });
      setShowStartPicker(false);
      setShowEndPicker(false);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Sleep entry save error:', error);
      Alert.alert(
        'Unerwarteter Fehler', 
        `${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n\nBitte versuche es erneut oder kontaktiere den Support.`
      );
    }
  };


  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Schlaf-Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => { triggerHaptic(); } },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic();
            try {
              let deleteQuery = supabase
                .from('sleep_entries')
                .delete()
                .eq('id', entryId);

              if (activeBabyId) {
                deleteQuery = deleteQuery.eq('baby_id', activeBabyId);
              }

              const { error } = await deleteQuery;

              if (error) throw error;
              
              await loadSleepData();
              Alert.alert('Erfolg', 'Eintrag wurde gelöscht! 🗑️');
            } catch (error) {
              Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden');
            }
          }
        }
      ]
    );
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration for completed entries
  const formatCompletedDuration = (durationMinutes: number) => {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get quality color
  const getQualityColor = (quality?: SleepQuality) => {
    switch (quality) {
      case 'good': return '#38A169';
      case 'medium': return '#F5A623';
      case 'bad': return '#E53E3E';
      default: return '#A0AEC0';
    }
  };

  // Get quality emoji
  const getQualityEmoji = (quality?: SleepQuality) => {
    switch (quality) {
      case 'good': return '😴';
      case 'medium': return '😐';
      case 'bad': return '😵';
      default: return '💤';
    }
  };

  // Splash Funktion wie in daily_old.tsx
  const showSuccessSplash = (hex: string, emoji: string, kind: string) => {
    const rgba = (h: string, a: number) => {
      const c = h.replace('#','');
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    setSplashBg(rgba(hex, 1));
    setSplashEmoji(emoji);
    // Texte je Kontext - angepasst für Sleep
    if (kind === 'sleep_start_night') {
      setSplashTitle('Nachtschlaf läuft');
      setSplashSubtitle('Gute Nacht, kleiner Schatz. Träum schön.');
      setSplashStatus('Timer gestartet...');
      setSplashHint('Du machst das großartig 🌙');
      setSplashText('');
    } else if (kind === 'sleep_start_day') {
      setSplashTitle('Tagschlaf läuft');
      setSplashSubtitle('Kuschel-Nap – Energie tanken.');
      setSplashStatus('Timer gestartet...');
      setSplashHint('Erholung ist wichtig 💤');
      setSplashText('');
    } else if (kind === 'sleep_stop_good') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Guter Schlaf – perfekt erholt!');
      setSplashStatus('');
      setSplashHint('Ein weiterer Meilenstein heute ✨');
      setSplashText('');
    } else if (kind === 'sleep_stop_medium') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Okay geschlafen – das ist völlig normal.');
      setSplashStatus('');
      setSplashHint('Jeder Schlaf ist wertvoll 💕');
      setSplashText('');
    } else if (kind === 'sleep_stop_bad') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Unruhiger Schlaf – morgen wird besser.');
      setSplashStatus('');
      setSplashHint('Du gibst dein Bestes, das reicht 🤍');
      setSplashText('');
    } else if (kind === 'sleep_manual_save') {
      setSplashTitle('Schlaf gespeichert');
      setSplashSubtitle('Eintrag erfolgreich hinzugefügt.');
      setSplashStatus('');
      setSplashHint('Danke für die genaue Aufzeichnung 💕');
      setSplashText('');
    } else if (kind === 'sleep_edit_save') {
      setSplashTitle('Schlaf aktualisiert');
      setSplashSubtitle('Änderungen erfolgreich gespeichert.');
      setSplashStatus('');
      setSplashHint('Die Daten wurden aktualisiert ✏️');
      setSplashText('');
    } else {
      setSplashTitle('Schlaf-Aktion');
      setSplashSubtitle('Erfolgreich ausgeführt.');
      setSplashStatus('');
      setSplashHint('Alles in Ordnung ✅');
      setSplashText('');
    }
    setSplashVisible(true);
    // reset and animate in
    splashAnim.setValue(0);
    Animated.timing(splashAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    splashEmojiAnim.setValue(0.9);
    Animated.sequence([
      Animated.timing(splashEmojiAnim, { toValue: 1.1, duration: 220, useNativeDriver: true }),
      Animated.spring(splashEmojiAnim, { toValue: 1, useNativeDriver: true })
    ]).start();
    // clear previous timer
    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    splashTimerRef.current = setTimeout(() => {
      Animated.timing(splashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setSplashVisible(false);
      });
    }, 4500);
  };

  // Group entries by period
  const groupedEntries = sleepEntries.reduce((acc, entry) => {
    if (!acc[entry.period]) {
      acc[entry.period] = [];
    }
    acc[entry.period].push(entry);
    return acc;
  }, {} as Record<SleepPeriod, ClassifiedSleepEntry[]>);

  // Compute high-level stats & score (heutiger Kalendertag 00:00–24:00 lokal)
  const computeStats = () => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd   = endOfDay(selectedDate);

    let totalMinutes = 0;
    let longestStretch = 0;
    let napsCount = 0;

    for (const e of sleepEntries) {
      const s = new Date(e.start_time);
      const ee = e.end_time ? new Date(e.end_time) : new Date();
      const mins = overlapMinutes(s, ee, dayStart, dayEnd);
      if (!mins) continue;

      totalMinutes += mins;
      longestStretch = Math.max(longestStretch, mins);

      // Naps = kurze Schläfchen (<= 30 Min), egal ob Tag/Nacht klassifiziert
      if (mins <= 30) napsCount += 1;
    }

    // Beispiel-Score: 14h Ziel, lineare Abweichung (keine 100% bei 25h)
    const target = 14 * 60;
    const deviation = Math.abs(totalMinutes - target);
    const score = Math.max(0, Math.round(100 - (deviation / target) * 100));

    return { totalMinutes, napsCount, longestStretch, score };
  };

  const stats = computeStats();

  const minutesToHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  };
  const formatClockTime = (date: Date) =>
    date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Daily navigation helpers
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const goPrevDay = () => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd; });
  const goNextDay = () => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; });
  const today = new Date();
  const nextDisabled = isSameDay(selectedDate, today) || selectedDate > today;

  const qualityPillActive = (q: 'good' | 'medium' | 'bad'): ViewStyle => ({
    backgroundColor:
      q === 'good' ? 'rgba(56,161,105,0.25)' : q === 'medium' ? 'rgba(245,166,35,0.25)' : 'rgba(229,62,62,0.25)',
  });

  // Einträge für den aktuell ausgewählten Tag (Tag-Ansicht)
  const dayEntries = useMemo(() => {
    const ds = startOfDay(selectedDate);
    const de = endOfDay(selectedDate);
    return sleepEntries
      .filter(e => {
        const s = new Date(e.start_time);
        const ee = e.end_time ? new Date(e.end_time) : new Date();
        return overlapMinutes(s, ee, ds, de) > 0;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sleepEntries, selectedDate]);

  const jumpToLatestEntry = useCallback(() => {
    if (sleepEntries.length === 0) return;
    const latest = sleepEntries.reduce((latestEntry, entry) => {
      if (!latestEntry) return entry;
      return new Date(entry.start_time).getTime() > new Date(latestEntry.start_time).getTime()
        ? entry
        : latestEntry;
    }, null as ClassifiedSleepEntry | null);

    if (latest) {
      setSelectedTab('day');
      setSelectedDate(new Date(latest.start_time));
    }
  }, [sleepEntries]);

    // Setze die Modal-Daten beim Öffnen
    useEffect(() => {
      if (showInputModal) {
        if (editingEntry) {
          // Bearbeitungsmodus - lade vorhandene Daten
          setSleepModalData({
            start_time: new Date(editingEntry.start_time),
            end_time: editingEntry.end_time ? new Date(editingEntry.end_time) : null,
            quality: editingEntry.quality || null,
          notes: editingEntry.notes || ''
          });
        } else {
          // Neuer Eintrag - setze Standardwerte
          setSleepModalData({
            start_time: new Date(),
            end_time: null,
            quality: null,
          notes: ''
          });
        }
      }
    }, [showInputModal, editingEntry]);


  // Top Tabs Component (exakt wie daily_old.tsx)
  const TopTabs = () => (
    <View style={styles.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard key={tab} style={[styles.topTab, selectedTab === tab && styles.activeTopTab]} intensity={22}>
          <TouchableOpacity
            style={styles.topTabInner}
            onPress={() => {
              triggerHaptic();
              setSelectedTab(tab);
            }} // Erstmal nur visuell - ohne Funktion
            activeOpacity={0.85}
          >
            <Text style={[styles.topTabText, selectedTab === tab && styles.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  // Status Metrics Bar Component (Standard App-Layout)
  const StatusMetricsBar = () => (
    <>
      <View style={styles.kpiRow}>
        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(142, 78, 198, 0.1)"
          borderColor="rgba(142, 78, 198, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="moon.fill" size={12} color="#8E4EC6" />
            <Text style={styles.kpiTitle}>{isSameDay(selectedDate, today) ? 'Heute' : selectedDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</Text>
        </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>{minutesToHMM(stats.totalMinutes)}</Text>
        </GlassCard>

        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(255, 140, 66, 0.1)"
          borderColor="rgba(255, 140, 66, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="zzz" size={12} color="#FF8C42" />
            <Text style={styles.kpiTitle}>Naps</Text>
        </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>{stats.napsCount}</Text>
        </GlassCard>
        </View>

      <View style={styles.kpiRow}>
        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(168, 196, 162, 0.1)"
          borderColor="rgba(168, 196, 162, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="clock.fill" size={12} color="#A8C4A2" />
            <Text style={styles.kpiTitle}>Längster</Text>
        </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>{minutesToHMM(stats.longestStretch)}</Text>
        </GlassCard>

        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(255, 155, 155, 0.1)"
          borderColor="rgba(255, 155, 155, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="chart.line.uptrend.xyaxis" size={12} color="#FF9B9B" />
            <Text style={styles.kpiTitle}>Score</Text>
      </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>{stats.score}%</Text>
        </GlassCard>
      </View>
    </>
  );

  // Central Timer Component (Baby Blue Circle Only)
  const CentralTimer = () => {
    const ringSize = screenWidth * 0.75;
    const circleSize = ringSize * 0.8;
    const progress = activeSleepEntry ? (elapsedTime / (8 * 60 * 60)) * 100 : 0; // 8h max
    
    return (
      <View style={styles.centralTimerContainer}>
        <Animated.View style={[styles.centralContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View
            style={[
              styles.circleArea,
              { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }
            ]}
          >
            {/* Glass Circle Background */}
            <View style={[styles.glassCircle, { 
              width: circleSize, 
              height: circleSize, 
              borderRadius: circleSize / 2,
            }]}>
              <BlurView intensity={18} tint="light" style={[styles.glassCircleBlur, { borderRadius: circleSize / 2 }]}>
                <View style={[styles.glassCircleOverlay, { borderRadius: circleSize / 2 }]} />
              </BlurView>
            </View>
            
            {/* Progress Circle as absolute overlay */}
            <View style={[styles.progressAbsolute, { width: circleSize, height: circleSize }]}>
            <ProgressCircle 
              progress={progress}
              size={circleSize}
              strokeWidth={8}
              progressColor={activeSleepEntry ? "#87CEEB" : "rgba(135, 206, 235, 0.4)"} // Baby blue
              backgroundColor="rgba(135, 206, 235, 0.2)"
              textColor="transparent"
            />
          </View>
          
          {/* Absolute centered time - always in perfect center */}
            <View pointerEvents="none" style={styles.centerOverlay}>
              <Text style={[styles.centralTime, { color: '#6B4C3B', fontWeight: '800' }]}>
                {activeSleepEntry
                  ? formatDuration(elapsedTime)
                  : currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
          </View>
          
            {/* Content positioned absolutely above and below the center */}
            <View pointerEvents="none" style={styles.upperContent}>
              <View style={[styles.centralIcon, { backgroundColor: activeSleepEntry ? 'rgba(135, 206, 235, 0.9)' : 'rgba(255, 140, 66, 0.9)', borderRadius: 30, padding: 8, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                <IconSymbol name={activeSleepEntry ? "moon.fill" : "sun.max.fill"} size={28} color="#FFFFFF" />
                </View>
                </View>

            <View pointerEvents="none" style={styles.lowerContent}>
              {activeSleepEntry && (
                <Text style={[styles.centralStatus, { color: '#6B4C3B', fontWeight: '700' }]}>
                  Schläft
                </Text>
              )}
              {activeSleepEntry ? (
                <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                  Seit {new Date(activeSleepEntry.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : predictionLoading ? (
                <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                  Schlaffenster wird berechnet...
                </Text>
              ) : sleepPrediction ? (
                <>
                  <Text style={[styles.centralHintPrimary, { color: '#6B4C3B' }]}>
                    Nächste Schlafphase um
                  </Text>
                  <Text style={[styles.centralHintSecondary, { color: '#7D5A50' }]}>
                    {formatClockTime(sleepPrediction.recommendedStart)}
                  </Text>
                </>
              ) : (
                <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                  {predictionError || 'Bereit für den nächsten Schlaf'}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  };

  // Action Buttons (Home.tsx style)
  const ActionButtons = () => {
    return (
    <View style={styles.cardsGrid}>
      {activeSleepEntry ? (
          // Vollbreite Schlaf-beenden Button
        <TouchableOpacity
            style={[styles.fullWidthStopButton]}
          onPress={() => {
            triggerHaptic();
            handleStopSleep();
          }}
          activeOpacity={0.9}
        >
          <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Schlaf beenden</Text>
              <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Timer stoppen</Text>
            </View>
          </BlurView>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W, marginRight: GRID_GUTTER }]}
              onPress={() => {
                triggerHaptic();
                handleStartSleep(currentTime.getHours() >= 20 || currentTime.getHours() < 10 ? 'night' : 'day');
              }}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 78, 198, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                  <IconSymbol name="moon.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Schlaf starten</Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Timer beginnen</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W }]}
              onPress={() => {
                triggerHaptic();
                setEditingEntry(null);
                setShowInputModal(true);
              }}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                  <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Manuell</Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Eintrag hinzufügen</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
  };

  // Wochenansicht Component (Design Guide konform)
  const WeekView = () => {
    // Referenz-Datum: Heute + (weekOffset * 7 Tage)
    const refDate = useMemo(() => {
      const d = new Date();
      d.setDate(d.getDate() + weekOffset * 7);
      return d;
    }, [weekOffset]);
    
    // Lokale Hilfsfunktionen
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    const getWeekEnd = (date: Date) => {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return weekEnd;
    };

    const getWeekDays = (date: Date) => {
      const weekStart = getWeekStart(date);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        days.push(day);
      }
      return days;
    };
    
    const weekDays = useMemo(() => getWeekDays(refDate), [refDate]);
    const weekStart = useMemo(() => getWeekStart(refDate), [refDate]);
    const weekEnd = useMemo(() => getWeekEnd(refDate), [refDate]);

    // Hilfsfunktionen (lokaler Tag, kein UTC-Shift)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Minuten-Überlappung zweier Zeitintervalle
    const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
      const ms = Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart));
      return Math.round(ms / 60000);
    };

    // Berechne Schlaf-Minuten für genau diesen Kalendertag (00:00–24:00 lokal)
    const getDayStats = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);

      let totalMinutes = 0;
      let nightMinutes = 0;
      let dayMinutes   = 0;

      for (const e of sleepEntries) {
        const eStart = new Date(e.start_time);
        const eEnd   = e.end_time ? new Date(e.end_time) : new Date(); // laufender Schlaf bis jetzt

        const mins = overlapMinutes(eStart, eEnd, dayStart, dayEnd);
        if (mins > 0) {
          totalMinutes += mins;
          if (e.period === 'night') {
            nightMinutes += mins;
          } else {
            dayMinutes += mins;
          }
        }
      }
      return { totalMinutes, nightMinutes, dayMinutes, count: totalMinutes > 0 ? 1 : 0 };
    };

    // Berechne Max-Höhe für Balkendiagramm
    const dayTotals = weekDays.map((day: Date) => getDayStats(day).totalMinutes);
    const maxMinutes = Math.max(...dayTotals, 480); // Min 8h für vernünftige Skala

    // Wochen-spezifische Highlight-Berechnung
    const weekSpanStart = startOfDay(weekStart);
    const weekSpanEnd   = endOfDay(weekEnd);

    // Wochen-spezifische Berechnung für Zusammenfassung
    const nightWeekMins = sleepEntries.reduce((sum, e) => {
      if (e.period !== 'night') return sum;
      const s = new Date(e.start_time);
      const eEnd = e.end_time ? new Date(e.end_time) : new Date();
      return sum + overlapMinutes(s, eEnd, weekSpanStart, weekSpanEnd);
    }, 0);

    const dayWeekMins = sleepEntries.reduce((sum, e) => {
      if (e.period !== 'day') return sum;
      const s = new Date(e.start_time);
      const eEnd = e.end_time ? new Date(e.end_time) : new Date();
      return sum + overlapMinutes(s, eEnd, weekSpanStart, weekSpanEnd);
    }, 0);

    // gesamte Schlafminuten dieser Woche (mit Intervall-Überlappung)
    const totalWeekMins = sleepEntries.reduce((sum, e) => {
      const s = new Date(e.start_time);
      const eEnd = e.end_time ? new Date(e.end_time) : new Date();
      return sum + overlapMinutes(s, eEnd, weekSpanStart, weekSpanEnd);
    }, 0);

    
    return (
      <View style={styles.weekViewContainer}>
        {/* Week Navigation - Design Guide konform */}
        <View style={styles.weekNavigationContainer}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o - 1);
            }}
          >
            <Text style={styles.weekNavButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.weekHeaderCenter}>
            <Text style={styles.weekHeaderTitle}>Wochenübersicht</Text>
            <Text style={styles.weekHeaderSubtitle}>
              {weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
            </Text>
              </View>

          <TouchableOpacity
            style={[styles.weekNavButton, weekOffset >= 0 && { opacity: 0.4 }]}
            disabled={weekOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o + 1);
            }}
          >
            <Text style={styles.weekNavButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Balkendiagramm - Design Guide konform mit Liquid Glass */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={styles.chartTitle}>Schlafzeiten dieser Woche</Text>

          {/* feste Gesamtbreite = WEEK_CONTENT_WIDTH (wie Timeline) */}
          <View style={[styles.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
            {weekDays.map((day: Date, i: number) => {
              const stats = getDayStats(day);
              // Sehr große Werte deckeln (z. B. „34h“)
              const minutesCapped = Math.min(stats.totalMinutes, 24 * 60);
              const totalH = minutesCapped ? (minutesCapped / maxMinutes) * MAX_BAR_H : 0;
              const hours = Math.round(stats.totalMinutes / 60);

              // Pixelgenaue Spaltenbreite für Week-Chart
              const extra = i < WEEK_LEFTOVER ? 1 : 0;

              return (
                <TouchableOpacity
                  key={i}
                  style={{
                    width: WEEK_COL_WIDTH + extra,
                    marginRight: i < (COLS - 1) ? GUTTER : 0,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(day);
                    setSelectedTab('day');
                  }}
                >
                  <View style={[styles.chartBarContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    {totalH > 0 && <View
                      style={[
                        styles.chartBar,
                        styles.chartBarTotal,
                        { height: totalH, width: Math.max(10, Math.round(WEEK_COL_WIDTH * 0.66)) }
                      ]}
                    />}
                  </View>

                  <View style={[styles.chartLabelContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    <Text allowFontScaling={false} style={styles.chartLabel}>{['Mo','Di','Mi','Do','Fr','Sa','So'][i]}</Text>
                    <Text allowFontScaling={false} style={styles.chartValue}>
                      {hours > 24 ? '24h+' : `${hours}h`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </LiquidGlassCard>

        {/* Wochenzusammenfassung - Design Guide konform */}
        <LiquidGlassCard style={styles.weekSummaryCard}>
          <View style={styles.summaryInner}>
            <Text style={styles.summaryTitle}>Wochenzusammenfassung</Text>
            <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🌙</Text>
                  <Text style={styles.statValue}>{Math.round(nightWeekMins / 60)}h</Text>
                  <Text style={styles.statLabel}>Nachtschlaf</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>☀️</Text>
                  <Text style={styles.statValue}>{Math.round(dayWeekMins / 60)}h</Text>
                  <Text style={styles.statLabel}>Tagschlaf</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>⭐</Text>
                  <Text style={styles.statValue}>{Math.round(totalWeekMins / 7 / 60)}h</Text>
                  <Text style={styles.statLabel}>Ø pro Tag</Text>
                </View>
            </View>
          </View>
        </LiquidGlassCard>

        {/* Trend-Analyse - Design Guide konform */}
        <LiquidGlassCard style={styles.trendCard}>
          <View style={styles.trendInner}>
            <Text style={styles.trendTitle}>Trend-Analyse</Text>
            <View style={styles.trendContent}>
              <View style={styles.trendItem}>
                <Text style={styles.trendEmoji}>📈</Text>
                <Text style={styles.trendText}>Gute Schlafqualität</Text>
              </View>
              <View style={styles.trendItem}>
                <Text style={styles.trendEmoji}>😴</Text>
                <Text style={styles.trendText}>Stabile Einschlafzeiten</Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  // Monatsansicht Component (Design Guide konform)
  const MonthView = () => {
    // Referenz-Monat: aktueller Monat + monthOffset
    const refMonthDate = useMemo(() => {
      const d = new Date();
      d.setDate(1);                 // Normalize to first of month
      d.setMonth(d.getMonth() + monthOffset);
      return d;
    }, [monthOffset]);
    
    // Lokale Hilfsfunktionen
    const getMonthStart = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    };

    const getMonthEnd = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    };

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      return new Date(year, month + 1, 0).getDate();
    };
    
    const monthStart = useMemo(() => getMonthStart(refMonthDate), [refMonthDate]);
    const monthEnd = useMemo(() => getMonthEnd(refMonthDate), [refMonthDate]);
    const daysInMonth = useMemo(() => getDaysInMonth(refMonthDate), [refMonthDate]);

    // Erstelle Kalender-Grid - gruppiert nach Wochen (wie Wochenansicht)
    const getCalendarWeeks = () => {
      const weeks = [];
      const firstDayOfWeek = monthStart.getDay();
      const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Montag als erster Tag

      let currentWeek = [];
      
      // Füge leere Tage hinzu
      for (let i = 0; i < startOffset; i++) {
        currentWeek.push(null);
      }

      // Füge Tage des Monats hinzu
      for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
        
        // Wenn Woche voll (7 Tage)
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      // Füge letzte unvollständige Woche hinzu
      if (currentWeek.length > 0) {
        // Fülle mit null auf
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      return weeks;
    };

    const calendarWeeks = useMemo(() => getCalendarWeeks(), [monthStart, daysInMonth]);

    // Hilfsfunktionen für lokale Tage (kein UTC-Shift)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Minuten-Überlappung zweier Zeitintervalle
    const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
      const ms = Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart));
      return Math.round(ms / 60000);
    };

    const getEntriesForDate = (date: Date) => {
      if (!date) return [];
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);

      return sleepEntries.filter(entry => {
        const eStart = new Date(entry.start_time);
        const eEnd   = entry.end_time ? new Date(entry.end_time) : new Date();
        const mins = overlapMinutes(eStart, eEnd, dayStart, dayEnd);
        return mins > 0;
      });
    };

    const getDayScore = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);

      let totalMinutes = 0;
      for (const entry of sleepEntries) {
        const eStart = new Date(entry.start_time);
        const eEnd   = entry.end_time ? new Date(entry.end_time) : new Date();
        totalMinutes += overlapMinutes(eStart, eEnd, dayStart, dayEnd);
      }

      if (totalMinutes >= 480) return 'excellent'; // 8h+
      if (totalMinutes >= 360) return 'good';      // 6h+
      if (totalMinutes >= 240) return 'okay';      // 4h+
      return 'poor';                              // <4h
    };

    const getTotalMinutesForDate = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);
      return sleepEntries.reduce((sum, e) => {
        const s = new Date(e.start_time);
        const eEnd = e.end_time ? new Date(e.end_time) : new Date();
        return sum + overlapMinutes(s, eEnd, dayStart, dayEnd);
      }, 0);
    };

    // Neue Farbpalette für Kalender-Tiles (wie KPI-Cards)
    type DayScore = 'excellent' | 'good' | 'okay' | 'poor' | 'none';

    const getDayColors = (score: DayScore) => {
      switch (score) {
        case 'excellent': // 8h+
          return { bg: 'rgba(56,161,105,0.22)', text: '#2F855A', border: 'rgba(255,255,255,0.65)' }; // grün
        case 'good':      // 6h+
          return { bg: 'rgba(56,161,105,0.14)', text: '#2F855A', border: 'rgba(255,255,255,0.55)' }; // grün (heller)
        case 'okay':      // 4h+
          return { bg: 'rgba(245,166,35,0.18)', text: '#975A16', border: 'rgba(255,255,255,0.55)' }; // amber
        case 'poor':      // <4h
          return { bg: 'rgba(229,62,62,0.18)',  text: '#9B2C2C', border: 'rgba(255,255,255,0.55)' }; // rot
        default:
          return { bg: 'rgba(255,255,255,0.10)', text: '#7D5A50', border: 'rgba(255,255,255,0.35)' }; // glas neutral
      }
    };

    return (
      <View style={styles.monthViewContainer}>
        {/* Monats-Navigation - Design Guide konform */}
        <View style={styles.monthNavigationContainer}>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o - 1);
            }}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.monthHeaderCenter}>
            <Text style={styles.monthHeaderTitle}>
              {refMonthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.monthNavButton, monthOffset >= 0 && { opacity: 0.4 }]}
            disabled={monthOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o + 1);
            }}
          >
            <Text style={styles.monthNavButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Kalender-Block mit exakt gleicher Innenbreite wie Week-Chart */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={styles.chartTitle}>Schlafkalender</Text>
          <View style={{ width: WEEK_CONTENT_WIDTH, alignSelf: 'center', paddingVertical: 16 }}>
            {/* Wochentags-Header mit exakten Spaltenbreiten */}
            <View style={styles.weekdayHeader}>
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map((label, i) => {
                const extra = i < WEEK_LEFTOVER ? 1 : 0;
                return (
                  <View
                    key={label}
                    style={{
                      width: WEEK_COL_WIDTH + extra,
                      marginRight: i < 6 ? GUTTER : 0,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={styles.weekdayLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Tage: wochenweise, gleiche Spaltenbreiten & Gutter wie oben */}
            {calendarWeeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarWeek}>
                {week.map((date, dayIndex) => {
                  const extra = dayIndex < WEEK_LEFTOVER ? 1 : 0;
                  return (
                    <View
                      key={dayIndex}
                      style={{
                        width: WEEK_COL_WIDTH + extra,
                        marginRight: dayIndex < 6 ? GUTTER : 0,
                      }}
                    >
                      {date ? (() => {
                        const entriesCount = getEntriesForDate(date).length;
                        const totalMins = getTotalMinutesForDate(date);
                        const hours = Math.round(totalMins / 60); // runde auf ganze Stunden

                        const score = entriesCount > 0 ? getDayScore(date) : 'none';
                        const c = getDayColors(score as DayScore);
                        return (
                          <TouchableOpacity
                            style={[
                              styles.calendarDayButton,
                              { backgroundColor: c.bg, borderColor: c.border }
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedDate(date);
                              setSelectedTab('day');
                            }}
                          >
                            <Text style={[styles.calendarDayNumber, { color: c.text }]}>{date.getDate()}</Text>
                            {totalMins > 0 && (
                              <Text style={[styles.calendarDayHours, { color: c.text }]}>
                                {hours}h
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })() : (
                        <View style={styles.calendarDayEmpty} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </LiquidGlassCard>

        {/* Monatsstatistiken - Design Guide konform */}
        <LiquidGlassCard style={styles.monthSummaryCard}>
          <View style={styles.summaryInner}>
            <Text style={styles.summaryTitle}>Monatsübersicht</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>📊</Text>
                <Text style={styles.statValue}>{sleepEntries.length}</Text>
                <Text style={styles.statLabel}>Einträge</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⏰</Text>
                <Text style={styles.statValue}>{sleepEntries.length > 0 ? Math.round(sleepEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / sleepEntries.length / 60) : 0}h</Text>
                <Text style={styles.statLabel}>Ø pro Tag</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🏆</Text>
                <Text style={styles.statValue}>{sleepEntries.length > 0 ? Math.round(Math.max(...sleepEntries.map(e => e.duration_minutes || 0)) / 60) : 0}h</Text>
                <Text style={styles.statLabel}>Längster Schlaf</Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };




  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <Header 
          title="Schlaf-Tracker"
          subtitle="Verfolge Levis Schlafmuster"
        />

        {/* Top Tabs - über der Status Bar */}
        <TopTabs />

        {/* Status Bar */}
        <StatusMetricsBar />

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#7D5A50']}
              tintColor={theme.text}
            />
          }
        >
          {selectedTab === 'week' ? (
            <WeekView />
          ) : selectedTab === 'month' ? (
            <MonthView />
          ) : (
            <>
              {/* Day Navigation - gleiche Position/Höhe wie Woche/Monat */}
              <View style={styles.weekNavigationContainer}>
                <TouchableOpacity
                  style={styles.weekNavButton}
                  onPress={() => {
                    triggerHaptic();
                    goPrevDay();
                  }}
                >
                  <Text style={styles.weekNavButtonText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.weekHeaderCenter}>
                  <Text style={styles.weekHeaderTitle}>Tagesansicht</Text>
                  <Text style={styles.weekHeaderSubtitle}>
                    {isSameDay(selectedDate, today)
                      ? new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
                      : selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.weekNavButton, nextDisabled && { opacity: 0.4 }]}
                  disabled={nextDisabled}
                  onPress={() => {
                    triggerHaptic();
                    goNextDay();
                  }}
                >
                  <Text style={styles.weekNavButtonText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Central Timer - nur in Tag-Ansicht */}
              <Animated.View style={{ opacity: appearAnim }}>
                <CentralTimer />
              </Animated.View>

              {/* Schlaferfassung Section - nur in Tag-Ansicht */}
              <View style={styles.sleepCaptureSection}>
                <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Schlaferfassung</Text>

                {/* Action Buttons - nur in Tag-Ansicht */}
          <ActionButtons />
              </View>

              {/* Timeline Section - nur in Tag-Ansicht */}
            <View style={styles.timelineSection}>
              <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Timeline</Text>

              {/* Sleep Entries - Timeline Style like daily_old.tsx - nur in Tag-Ansicht */}
              <View style={styles.entriesContainer}>
            {dayEntries.map((entry, index) => (
                <ActivityCard
                  key={entry.id || index}
                  entry={convertSleepToDailyEntry(entry)}
                  onDelete={(entryId) => {
                    triggerHaptic();
                    handleDeleteEntry(entryId);
                  }}
                  onEdit={(entry) => {
                    triggerHaptic();
                    setEditingEntry(entry as any);
                    setShowInputModal(true);
                  }}
                  marginHorizontal={8}
                />
            ))}
          {dayEntries.length === 0 && !isLoading && (
            <LiquidGlassCard style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💤</Text>
              <Text style={styles.emptyTitle}>Keine Einträge für diesen Tag</Text>
              <Text style={styles.emptySubtitle}>
                {sleepEntries.length > 0
                  ? 'Wechsle das Datum oder springe zum letzten Eintrag.'
                  : 'Starte den ersten Schlaf-Eintrag!'}
              </Text>
              {sleepEntries.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.manualButton, { marginTop: 12 }]}
                  onPress={() => {
                    triggerHaptic();
                    jumpToLatestEntry();
                  }}
                >
                  <Text style={styles.actionButtonText}>Zum letzten Eintrag</Text>
                </TouchableOpacity>
              )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.manualButton, { marginTop: 16 }]}
                  onPress={() => {
                    triggerHaptic();
                    setEditingEntry(null);
                    setShowInputModal(true);
                  }}
                >
                <Text style={styles.actionButtonText}>Manuell hinzufügen</Text>
              </TouchableOpacity>
            </LiquidGlassCard>
          )}
          </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Sleep Input Modal direkt hier rendern */}
        <Modal 
          visible={showInputModal} 
          transparent={true} 
          animationType="slide" 
          onRequestClose={() => setShowInputModal(false)}
        >
          <View style={styles.modalOverlay}>
            {/* Background tap to close */}
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              onPress={() => {
                triggerHaptic();
                setShowInputModal(false);
              }}
              activeOpacity={1}
            />

            <BlurView
              style={styles.modalContent}
              tint="extraLight"
              intensity={80}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => {
                    triggerHaptic();
                    setShowInputModal(false);
                  }}
                >
                  <Text style={styles.closeHeaderButtonText}>✕</Text>
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                  <Text style={styles.modalTitle}>
                    {editingEntry ? 'Schlaf bearbeiten' : 'Schlaf hinzufügen'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {editingEntry ? 'Daten anpassen' : 'Neuen Eintrag erstellen'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.headerButton, styles.saveHeaderButton, { backgroundColor: '#8E4EC6' }]}
                  onPress={() => {
                    triggerHaptic();
                    handleSaveEntry({
                      start_time: sleepModalData.start_time.toISOString(),
                      end_time: sleepModalData.end_time?.toISOString() || null,
                      quality: sleepModalData.quality,
                      notes: sleepModalData.notes
                    });
                  }}
                >
                  <Text style={styles.saveHeaderButtonText}>✓</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                  <View style={{width: '100%', alignItems: 'center'}}>
                    
                    {/* Zeit Sektion */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>⏰ Zeitraum</Text>
                      
                      <View style={styles.timeRow}>
                        <TouchableOpacity 
                          style={styles.timeButton}
                          onPress={() => {
                            triggerHaptic();
                            setShowStartPicker(true);
                          }}
                        >
                          <Text style={styles.timeLabel}>Start</Text>
                          <Text style={styles.timeValue}>
                            {sleepModalData.start_time.toLocaleString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.timeButton}
                          onPress={() => {
                            triggerHaptic();
                            setShowEndPicker(true);
                          }}
                        >
                          <Text style={styles.timeLabel}>Ende</Text>
                          <Text style={styles.timeValue}>
                            {sleepModalData.end_time
                              ? sleepModalData.end_time.toLocaleString('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit'
                                })
                              : 'Offen'
                            }
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* DateTimePicker direkt im Modal - Zeit und Datum gleichzeitig */}
                      {showStartPicker && (
                        <View style={styles.datePickerContainer}>
                          <DateTimePicker
                            value={sleepModalData.start_time}
                            mode="datetime"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            onChange={(_, date) => {
                              if (date) setSleepModalData(prev => ({ ...prev, start_time: date }));
                            }}
                            style={styles.dateTimePicker}
                          />
                          <View style={styles.datePickerActions}>
                            <TouchableOpacity
                              style={styles.datePickerCancel}
                              onPress={() => {
                                triggerHaptic();
                                setShowStartPicker(false);
                              }}
                            >
                              <Text style={styles.datePickerCancelText}>Fertig</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {showEndPicker && (
                        <View style={styles.datePickerContainer}>
                          <DateTimePicker
                            value={sleepModalData.end_time || new Date()}
                            mode="datetime"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            onChange={(_, date) => {
                              if (date) setSleepModalData(prev => ({ ...prev, end_time: date }));
                            }}
                            style={styles.dateTimePicker}
                          />
                          <View style={styles.datePickerActions}>
                            <TouchableOpacity
                              style={styles.datePickerCancel}
                              onPress={() => {
                                triggerHaptic();
                                setShowEndPicker(false);
                              }}
                            >
                              <Text style={styles.datePickerCancelText}>Fertig</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>


                    {/* Qualität Sektion */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>😴 Schlafqualität</Text>
                      <View style={styles.optionsGrid}>
                        {(['good','medium','bad'] as const).map(q => (
                          <TouchableOpacity
                            key={q}
                            style={[
                              styles.optionButton,
                              { 
                                backgroundColor: sleepModalData.quality === q 
                                  ? (q === 'good' ? '#38A169' : q === 'medium' ? '#F5A623' : '#E53E3E')
                                  : 'rgba(230, 230, 230, 0.8)',
                                flex: 1,
                                marginHorizontal: 3
                              }
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSleepModalData(prev => ({ ...prev, quality: q }));
                            }}
                          >
                            <Text style={styles.optionIcon}>
                              {q === 'good' ? '😴' : q === 'medium' ? '😐' : '😵'}
                            </Text>
                            <Text style={[
                              styles.optionLabel,
                              { 
                                color: sleepModalData.quality === q ? '#FFFFFF' : '#333333'
                              }
                            ]}>
                              {q === 'good' ? 'Gut' : q === 'medium' ? 'Mittel' : 'Schlecht'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Notizen Sektion */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>📝 Notizen</Text>
                      <TouchableOpacity
                        style={styles.notesInput}
                        activeOpacity={0.9}
                        onPress={() => {
                          triggerHaptic();
                          openNotesEditor();
                        }}
                      >
                        <Text
                          style={sleepModalData.notes.trim() ? styles.notesText : styles.notesPlaceholder}
                          numberOfLines={3}
                        >
                          {sleepModalData.notes.trim() || 'Optionale Notizen zum Schlaf...'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Delete Button für Bearbeitung */}
                    {editingEntry && (
                      <View style={styles.section}>
                        <TouchableOpacity
                          style={[styles.deleteButton]}
                          onPress={() => {
                            triggerHaptic();
                            if (editingEntry.id) {
                              handleDeleteEntry(editingEntry.id);
                              setShowInputModal(false);
                              setEditingEntry(null);
                            }
                          }}
                        >
                          <Text style={styles.deleteButtonText}>🗑️ Eintrag löschen</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                  </View>
                </TouchableOpacity>
	              </ScrollView>
	            </BlurView>
	          </View>

	          <TextInputOverlay
	            visible={notesOverlayVisible}
	            label="Notizen"
	            value={notesOverlayValue}
	            placeholder="Optionale Notizen zum Schlaf..."
	            multiline
	            accentColor={PRIMARY}
	            onClose={closeNotesEditor}
	            onSubmit={(next) => saveNotesEditor(next)}
	          />

	        </Modal>
      </SafeAreaView>

      {/* Splash Popup wie in daily_old.tsx */}
      {splashVisible && (
        <Animated.View
          style={[styles.splashOverlay, { opacity: splashAnim }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[splashBg, splashBg]}
            style={StyleSheet.absoluteFillObject as any}
          />
          <View style={styles.splashCenterCard}>
            <Animated.View style={[styles.splashEmojiRing, { transform: [{ scale: splashEmojiAnim }] }]}>
              <Text style={styles.splashEmoji}>{splashEmoji}</Text>
            </Animated.View>
            {splashTitle ? <Text style={styles.splashTitle}>{splashTitle}</Text> : null}
            {splashSubtitle ? <Text style={styles.splashSubtitle}>{splashSubtitle}</Text> : null}
            {splashStatus ? <Text style={styles.splashStatus}>{splashStatus}</Text> : null}
            {splashHint ? (
              <View style={styles.splashHintCard}>
                <Text style={styles.splashHintText}>♡  {splashHint}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', backgroundColor: '#f5eee0' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 140, paddingHorizontal: LAYOUT_PAD },

  // KPI glass cards (Kompakt)
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: contentWidth,   // exakt gleich wie andere Abschnitte
    marginTop: 6,
    marginBottom: 4,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12, // Reduziertes Padding für bessere Balance
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  kpiHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 3,
  },
  kpiTitle: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#7D5A50',
    marginLeft: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: 1,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },
  kpiValueCentered: { 
    textAlign: 'center', 
    width: '100%' 
  },
  kpiSub: { 
    marginTop: 2,
    fontSize: 9, 
    color: '#7D5A50',
    textAlign: 'center',
    opacity: 0.8,
  },

  // Central Timer (Baby Blue Circle Only)
  centralTimerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  
  centralContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  // Neu: Expliziter quadratischer Container für den Kreis
  circleArea: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCircle: {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassCircleBlur: {
    flex: 1,
  },
  glassCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(135, 206, 235, 0.1)', // Baby blue overlay
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  // Neu: Progress Circle absolut positionieren
  progressAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Neu: Exakte Zentrierung der Uhrzeit
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Neu: Content über der Uhrzeit (Icon)
  upperContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '60%', // Icon oben im oberen Drittel
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Neu: Content unter der Uhrzeit (Status + Hinweis)
  lowerContent: {
    position: 'absolute',
    top: '60%', // Beginnt unter der Uhrzeit
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  centralIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralStatus: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 16,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  centralTime: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    lineHeight: 32, // Match fontSize for perfect alignment
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    textAlignVertical: 'center', // Android specific
    includeFontPadding: false, // Android specific - removes extra padding
    // Monospaced Ziffern für exakte Zentrierung
    fontVariant: ['tabular-nums'],
  },
  centralHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 200,
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
  centralHintPrimary: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
  },
  centralHintSecondary: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    includeFontPadding: false,
    opacity: 0.85,
  },

  sectionTitle: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.1,
  },
  sectionTitleTight: {
    marginTop: Math.max(2, SECTION_GAP_TOP - 12),
  },

  // Top Tabs (exakt wie daily_old.tsx)
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: 'rgba(94,61,179,0.65)' },
  topTabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  activeTopTabText: { color: PRIMARY },

  // Cards Grid (from home.tsx)
  cardsGrid: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: contentWidth,
    marginBottom: 0,
  },

  // Liquid Glass Cards (from home.tsx)
  liquidGlassCardWrapper: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullWidthStopButton: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullWidthCard: {
    width: '100%',
  },
  fullWidthCardTouchable: {
    flex: 1,
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },

  // Next Sleep Window Card (Home.tsx style)
  nextSleepCard: {
    padding: 20,
    backgroundColor: 'transparent',
    marginHorizontal: 4,
  },
  nextSleepContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextSleepInfo: {
    flex: 1,
  },
  nextSleepType: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  nextSleepTime: {
    fontSize: 16,
    fontWeight: '600',
  },


  // Glass base styles (from daily_old.tsx)
  glassContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },

  // Liquid Glass Base Styles
  liquidGlassWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassContainer: {
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  liquidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Schlaferfassung Section (Design Guide konform - gleiche Breite wie Wochenansicht)
  sleepCaptureSection: {
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
    paddingTop: 0,
    paddingBottom: 0,
  },

  // Timeline Section (Design Guide konform - gleiche Breite wie Wochenansicht)
  timelineSection: {
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
  },

  // Entries Container (Design Guide konform - gleiche Breite wie Wochenansicht)
  entriesContainer: {
    gap: 16,
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
    paddingVertical: 4,
  },

  // Action Button Styles (Home.tsx style)
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 8,
  },
  manualButton: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },


  // Empty State Styles
  emptyState: {
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A8978E',
    textAlign: 'center',
  },

  // Sleep Modal Styles - wie ActivityInputModal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimming backdrop
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    height: '85%',
    maxHeight: 700,
    minHeight: 650,
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  closeHeaderButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#888888',
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
    color: '#A8978E',
  },
  saveHeaderButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveHeaderButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
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
    elevation: 3,
  },
  optionIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    gap: 15,
  },
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
    elevation: 3,
  },
  timeLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    marginBottom: 5,
  },
  timeValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: 'bold',
  },
  notesInput: {
    width: '90%',
    minHeight: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  notesText: {
    fontSize: 16,
    color: '#333333',
  },
  notesPlaceholder: {
    fontSize: 16,
    color: '#A8978E',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // DatePicker Styles - im Modal integriert
  datePickerContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dateTimePicker: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  datePickerCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#8E4EC6',
  },
  datePickerCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Splash Styles wie in daily_old.tsx
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  splashEmoji: {
    fontSize: 72,
    textAlign: 'center',
    marginBottom: 10,
    color: '#fff',
  },
  splashText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  splashCenterCard: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  splashSubtitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  splashStatus: {
    marginTop: 30,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  splashHintCard: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
  },
  splashHintText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '700',
  },
  splashEmojiRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },

  // Wochen- und Monatsansicht Styles (Design Guide konform)
  weekViewContainer: {
    paddingHorizontal: 0,       // Padding bereits in contentWidth berücksichtigt
    paddingBottom: 20,
  },
  monthViewContainer: {
    paddingHorizontal: 0,       // Padding bereits in contentWidth berücksichtigt
    paddingBottom: 20,
  },

  // Navigation Styles (Design Guide konform)
  weekNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP_TOP,     // wie sectionTitle oben
    marginBottom: SECTION_GAP_BOTTOM, // wie sectionTitle unten
    paddingHorizontal: LAYOUT_PAD, // Navigation braucht eigenen Abstand
  },
  monthNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP_TOP,     // wie sectionTitle oben
    marginBottom: SECTION_GAP_BOTTOM, // wie sectionTitle unten
    paddingHorizontal: LAYOUT_PAD, // Navigation braucht eigenen Abstand
  },
  weekNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 6,                 // Mehr Touch-Komfort
  },
  monthNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  weekNavButtonText: {
    fontSize: 24,
    color: '#8E4EC6',
    fontWeight: 'bold',
  },
  monthNavButtonText: {
    fontSize: 24,
    color: '#8E4EC6',
    fontWeight: 'bold',
  },
  weekHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  monthHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 6,
  },
  monthHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekHeaderSubtitle: {
    fontSize: 12,
    color: '#7D5A50',
  },

  // Chart Styles (Design Guide konform)
    chartContainer: {
      marginBottom: 20,
      marginHorizontal: 0,        // Volle Breite wie Tagesansicht
      paddingHorizontal: 0,       // Volle Breite nutzen
    },
    chartGlassCard: {
      marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
      marginBottom: 20,           // Abstand zur nächsten Karte
      padding: 0,                 // Padding wird durch Container-Abstand geregelt
    },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D4A40',           // Dunkler für bessere Lesbarkeit auf Glass
    textAlign: 'center',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,                // Mehr Höhe für bessere Lesbarkeit
    paddingVertical: 16,        // Mehr Padding oben/unten
    paddingHorizontal: 0,       // Keine interne Breite — wir setzen contentWidth explizit
    width: '100%',              // Volle Breite der Glass Card
  },
  chartColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',  // Wochentage immer unten
    height: '100%',             // Volle Höhe der chartArea
  },
  chartBarContainer: {
    height: MAX_BAR_H,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  chartBar: {
    width: Math.max(10, Math.round(COL_WIDTH * 0.66)), // kräftiger und proportional
    borderRadius: 6,
    marginTop: 2,
    minHeight: 3,
  },
  chartBarTotal: {
    backgroundColor: '#8E4EC6', // Lila für Gesamtschlaf
  },
  chartLabel: {
    fontSize: screenWidth < 360 ? 11 : 12, // responsiv für schmale Geräte
    color: '#5D4A40',           // Dunkler für Glass Hintergrund
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    includeFontPadding: false,  // System-Scaling ausschalten
  },
  chartValue: {
    fontSize: screenWidth < 360 ? 11 : 12, // responsiv für schmale Geräte
    color: '#7D5A50',           // Dunkler für Glass Hintergrund
    fontWeight: '600',
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern für präzise Ausrichtung
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    includeFontPadding: false,  // System-Scaling ausschalten
  },
  chartLabelContainer: {
    minHeight: 44,              // Feste Höhe für einheitliche Ausrichtung
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: COL_WIDTH,           // fix = kein Umbruch/Abschnitt
  },

  // Summary Cards (Design Guide konform)
  weekSummaryCard: {
    padding: 0,                 // Padding entfernt für exakte Breite
    marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
    marginBottom: 20,           // Mehr Abstand
  },
  monthSummaryCard: {
    padding: 0,                          // wie chartGlassCard
    marginHorizontal: TIMELINE_INSET,    // gleiche Außenbreite
    marginBottom: 16,
  },
  // Wrapper für exakt gleiche Innenbreite wie Chart
  summaryInner: {
    width: WEEK_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 24,                // Innenabstand bleibt erhalten
  },
  summaryTitle: {
    fontSize: 18,               // Größerer Titel
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,                    // Gleichmäßige Verteilung
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,               // Größer für bessere Lesbarkeit
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 6,            // Mehr Abstand
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },
  statLabel: {
    fontSize: 13,               // Größer für bessere Lesbarkeit
    color: '#7D5A50',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Trend Card (Design Guide konform)
  trendCard: {
    padding: 0,                 // Padding entfernt für exakte Breite
    marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
    marginBottom: 8,            // kompakter, da keine Highlights mehr folgen
  },
  // Wrapper für exakt gleiche Innenbreite wie Chart
  trendInner: {
    width: WEEK_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 24,                // Innenabstand bleibt erhalten
  },
  trendTitle: {
    fontSize: 18,               // Größerer Titel
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textAlign: 'center',
  },
  trendContent: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 8,
  },
  trendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  trendEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  trendText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },

  // Calendar Styles (Design Guide konform)
    calendarContainer: {
      // hier *keine* feste Breite setzen – die kommt inline (WEEK_CONTENT_WIDTH)
      marginBottom: 20,
    },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7D5A50',
  },
  calendarWeek: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarDayButton: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderWidth: 1.25,                         // glasiger Rand
  },
  calendarDayEmpty: {
    aspectRatio: 1,
    width: '100%',
  },
  calendarDayNumber: {
    fontSize: 12,
    fontWeight: '600',
    // Textfarben kommen jetzt dynamisch
  },
  calendarDayIndicator: {
    fontSize: 8,
    marginTop: 2,
    opacity: 0.8,
    // Textfarben kommen jetzt dynamisch
  },
  calendarDayHours: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
    opacity: 0.9,
    fontVariant: ['tabular-nums'], // gleichbreite Ziffern
  },

  // Highlight Cards (Design Guide konform)
    highlightRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      width: WEEK_CONTENT_WIDTH,  // exakt wie Chart-Innenbreite
      marginBottom: 20,
    },
  highlightCard: {
    padding: 20,                // Mehr Padding
    marginHorizontal: 0,        // Kein zusätzlicher Margin
    alignItems: 'center',       // Inhalte zentrieren
    justifyContent: 'center',   // vertikal zentrieren
  },
  highlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightEmoji: {
    fontSize: 26,               // Größerer Emoji
    marginRight: 14,            // Mehr Abstand
  },
  highlightInfo: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 13,               // Größerer Label-Text
    color: '#7D5A50',
    fontWeight: '600',
    marginBottom: 6,            // Mehr Abstand
  },
  highlightValue: {
    fontSize: 18,               // Größerer Wert
    fontWeight: 'bold',
    color: '#8E4EC6',
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },

});
