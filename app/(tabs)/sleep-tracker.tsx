import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
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
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedBackground } from '@/components/ThemedBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

import { SleepEntry, SleepQuality, startSleepTracking, stopSleepTracking } from '@/lib/sleepData';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Reusable GlassCard using expo-blur
function GlassCard({
  children,
  style,
  intensity = 26,
  overlayColor = 'rgba(255,255,255,0.30)',
  borderColor = 'rgba(255,255,255,0.65)',
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;          // 0..100
  overlayColor?: string;       // tint-like overlay
  borderColor?: string;        // per-card border nuance
}) {
  return (
    <View style={[styles.glassContainer, { borderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint="light" />
      <View style={[styles.glassOverlay, { backgroundColor: overlayColor }]} />
      {children}
    </View>
  );
}

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
  const getSleepType = (startTime: string, durationMinutes?: number) => {
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

// Liquid Glass Card Component
const LiquidGlassCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
  onPress?: () => void;
  activeOpacity?: number;
}> = ({ 
  children, 
  style, 
  intensity = 24, 
  overlayColor = 'rgba(255,255,255,0.15)', 
  borderColor = 'rgba(255,255,255,0.3)',
  onPress,
  activeOpacity = 0.9
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  
  return (
    <CardComponent 
      style={[styles.liquidGlassWrapper, style]} 
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
      <BlurView intensity={intensity} tint="light" style={styles.liquidGlassBackground as any}>
        <View style={[styles.liquidGlassContainer as any, { borderColor }]}>
          <View style={[styles.liquidGlassOverlay as any, { backgroundColor: overlayColor }]} />
          {children}
        </View>
      </BlurView>
    </CardComponent>
  );
};

export default function SleepTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  // State management
  const [sleepEntries, setSleepEntries] = useState<ClassifiedSleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSleepEntry, setActiveSleepEntry] = useState<ClassifiedSleepEntry | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [editingEntry, setEditingEntry] = useState<ClassifiedSleepEntry | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Splash System komplett entfernt - saubere Sleep-Tracker Implementierung

  // Sleep Modal States
  const [sleepModalData, setSleepModalData] = useState({
    start_time: new Date(),
    end_time: null as Date | null,
    quality: null as SleepQuality | null,
    notes: ''
  });
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
  }, []);

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
      const { success, entries, error } = await loadAllVisibleSleepEntries();
      
      if (success && entries) {
        const classifiedEntries = entries.map(classifySleepEntry);
        setSleepEntries(classifiedEntries);
        
        // Find active entry
        const active = classifiedEntries.find(entry => entry.isActive);
        setActiveSleepEntry(active || null);
      } else {
        console.error('Error loading sleep data:', error);
      }
    } catch (error) {
      console.error('Failed to load sleep data:', error);
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
  const handleStartSleep = async (period: SleepPeriod) => {
    try {
      const { success, entry, error } = await startSleepTracking();
      
      if (success && entry) {
        const classifiedEntry = classifySleepEntry(entry);
        setActiveSleepEntry(classifiedEntry);
        await loadSleepData();

        // Splash anzeigen
        const period = new Date().getHours() >= 20 || new Date().getHours() < 10 ? 'night' : 'day';
        showSuccessSplash(
          '#87CEEB', // Baby blue
          period === 'night' ? '🌙' : '😴',
          period === 'night' ? 'sleep_start_night' : 'sleep_start_day'
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
      const { success, error } = await stopSleepTracking(activeSleepEntry.id, quality, notes);
      
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
        const { data, error } = await supabase
        .from('sleep_entries')
          .update({
            start_time: sleepData.start_time,
            end_time: sleepData.end_time ?? null,
            quality: sleepData.quality || null,
            notes: sleepData.notes ?? null,
            duration_minutes: sleepData.end_time
              ? Math.round((new Date(sleepData.end_time).getTime() - new Date(sleepData.start_time).getTime()) / 60000)
            : null
        })
          .eq('id', editingEntry.id)
          .select();

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
            start_time: sleepData.start_time,
            end_time: sleepData.end_time ?? null,
            quality: sleepData.quality || null,
            notes: sleepData.notes ?? null,
            duration_minutes: sleepData.end_time
              ? Math.round((new Date(sleepData.end_time).getTime() - new Date(sleepData.start_time).getTime()) / 60000)
            : null
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
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('sleep_entries')
                .delete()
                .eq('id', entryId);

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

  // Compute high-level stats & score (last 24h)
  const computeStats = () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const inWindow = sleepEntries.filter(e => {
      const st = new Date(e.start_time).getTime();
      return st >= now - dayMs;
    });
    const totalMinutes = inWindow.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const napsCount = inWindow.filter(e => e.period === 'day').length;
    const longestStretch = inWindow.reduce((max, e) => {
      const dur = e.duration_minutes || 0;
      return dur > max ? dur : max;
    }, 0);
    
    // Sleep quality based on duration and consistency
    const idealSleep = 12 * 60; // 12 hours for babies
    const sleepEfficiency = Math.min(100, (totalMinutes / idealSleep) * 100);
    const score = Math.min(100, Math.round(sleepEfficiency));
    
    return { totalMinutes, napsCount, longestStretch, score, sleepEfficiency };
  };

  const stats = computeStats();

  const minutesToHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const getNextSleepRecommendation = () => {
    const hour = currentTime.getHours();
    if (hour >= 10 && hour < 14) return 'Mittagsschlaf';
    if (hour >= 14 && hour < 18) return 'Nachmittagsschlaf';
    return 'Nachtschlaf';
  };

  const qualityPillActive = (q: 'good' | 'medium' | 'bad'): ViewStyle => ({
    backgroundColor:
      q === 'good' ? 'rgba(56,161,105,0.25)' : q === 'medium' ? 'rgba(245,166,35,0.25)' : 'rgba(229,62,62,0.25)',
  });

    // Setze die Modal-Daten beim Öffnen
    useEffect(() => {
      if (showInputModal) {
        if (editingEntry) {
          // Bearbeitungsmodus - lade vorhandene Daten
          setSleepModalData({
            start_time: new Date(editingEntry.start_time),
            end_time: editingEntry.end_time ? new Date(editingEntry.end_time) : null,
            quality: editingEntry.quality,
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
            onPress={() => setSelectedTab(tab)} // Erstmal nur visuell - ohne Funktion
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
            <Text style={styles.kpiTitle}>Heute</Text>
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
              <View style={[styles.centralIcon, { backgroundColor: activeSleepEntry ? 'rgba(135, 206, 235, 0.9)' : 'rgba(255, 140, 66, 0.9)', borderRadius: 30, padding: 8, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 4 }]}>
                <IconSymbol name={activeSleepEntry ? "moon.fill" : "sun.max.fill"} size={28} color="#FFFFFF" />
                </View>
                </View>

            <View pointerEvents="none" style={styles.lowerContent}>
              <Text style={[styles.centralStatus, { color: '#6B4C3B', fontWeight: '700' }]}>
                {activeSleepEntry ? 'Schläft' : 'Wach'}
              </Text>
                <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                {activeSleepEntry
                  ? `Seit ${new Date(activeSleepEntry.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                  : `Bereit für ${getNextSleepRecommendation()}`
                }
                </Text>
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
          onPress={() => handleStopSleep()}
          activeOpacity={0.9}
        >
          <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 4 }]}>
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
            style={styles.liquidGlassCardWrapper}
              onPress={() => handleStartSleep(currentTime.getHours() >= 20 || currentTime.getHours() < 10 ? 'night' : 'day')}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 78, 198, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 4 }]}>
                  <IconSymbol name="moon.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Schlaf starten</Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Timer beginnen</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
              onPress={() => {
                setEditingEntry(null);
                setSelectedActivityType('feeding');
                setSelectedSubType(null);
                setShowInputModal(true);
              }}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 4 }]}>
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

  // Next Sleep Window Component
  const getNextSleepWindow = () => {
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    
    if (hour >= 9 && hour < 12) {
      return { time: '12:30 - 14:00', type: 'Mittagsschlaf', icon: 'sun.haze.fill', color: '#FFB84D' };
    } else if (hour >= 12 && hour < 19) {
      return { time: '19:30 - 07:00', type: 'Nachtschlaf', icon: 'moon.fill', color: '#8E4EC6' };
    } else {
      return { time: '19:30 - 07:00', type: 'Nachtschlaf', icon: 'moon.fill', color: '#8E4EC6' };
    }
  };

  const NextSleepWindow = () => {
    const nextWindow = getNextSleepWindow();
    
    return (
      <View style={styles.liquidGlassWrapper}>
        <BlurView intensity={22} tint="light" style={styles.liquidGlassBackground}>
          <View style={[styles.liquidGlassContainer, styles.nextSleepCard]}>
            <View style={styles.nextSleepContent}>
              <View style={[styles.iconContainer, { backgroundColor: `${nextWindow.color === '#8E4EC6' ? 'rgba(142, 78, 198, 0.9)' : nextWindow.color === '#FF8C42' ? 'rgba(255, 140, 66, 0.9)' : 'rgba(255, 184, 77, 0.9)'}`, borderRadius: 30, padding: 8, marginBottom: 0, marginRight: 16, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 4 }]}>
                <IconSymbol name={nextWindow.icon as any} size={28} color="#FFFFFF" />
              </View>
              <View style={styles.nextSleepInfo}>
                <Text style={[styles.nextSleepType, { color: '#6B4C3B', fontSize: 18, fontWeight: '700' }]}>{nextWindow.type}</Text>
                <Text style={[styles.nextSleepTime, { color: '#7D5A50', fontSize: 16, fontWeight: '600' }]}>{nextWindow.time}</Text>
              </View>
            </View>
          </View>
        </BlurView>
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
          {/* Central Timer */}
          <Animated.View style={{ opacity: appearAnim }}>
            <CentralTimer />
          </Animated.View>

          {/* Schlaferfassung Section */}
          <Text style={styles.sectionTitle}>Schlaferfassung</Text>

          {/* Action Buttons */}
          <ActionButtons />

          {/* Timeline Section */}
          <Text style={styles.sectionTitle}>Timeline</Text>

          {/* Sleep Entries - Timeline Style like daily_old.tsx */}
          <View style={styles.entriesSection}>
            {sleepEntries.map((entry, index) => (
                <ActivityCard
                  key={entry.id || index}
                  entry={convertSleepToDailyEntry(entry)}
                  onDelete={handleDeleteEntry}
                  onEdit={(entry) => {
                    setEditingEntry(entry as any);
                    setSelectedActivityType('feeding'); // Sleep wird als feeding behandelt
                    setSelectedSubType('feeding_bottle'); // Standard subtype
                    setShowInputModal(true);
                  }}
                />
            ))}
          {sleepEntries.length === 0 && !isLoading && (
            <LiquidGlassCard style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💤</Text>
              <Text style={styles.emptyTitle}>Noch keine Schlafphasen</Text>
              <Text style={styles.emptySubtitle}>Starte den ersten Schlaf-Eintrag!</Text>
                <TouchableOpacity style={[styles.actionButton, styles.manualButton, { marginTop: 16 }]} onPress={() => {
                  setEditingEntry(null);
                  setSelectedActivityType('feeding');
                  setSelectedSubType(null);
                  setShowInputModal(true);
                }}>
                <Text style={styles.actionButtonText}>Manuell hinzufügen</Text>
              </TouchableOpacity>
            </LiquidGlassCard>
          )}
          </View>
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
              onPress={() => setShowInputModal(false)}
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
                  onPress={() => setShowInputModal(false)}
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
                  onPress={() => handleSaveEntry({
                    start_time: sleepModalData.start_time.toISOString(),
                    end_time: sleepModalData.end_time?.toISOString() || null,
                    quality: sleepModalData.quality,
                    notes: sleepModalData.notes
                  })}
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
                          onPress={() => setShowStartPicker(true)}
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
                          onPress={() => setShowEndPicker(true)}
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
                              onPress={() => setShowStartPicker(false)}
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
                              onPress={() => setShowEndPicker(false)}
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
                            onPress={() => setSleepModalData(prev => ({ ...prev, quality: q }))}
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
                      <TextInput
                        style={styles.notesInput}
                        placeholder="Optionale Notizen zum Schlaf..."
                        placeholderTextColor="#A8978E"
                        value={sleepModalData.notes}
                        onChangeText={notes => setSleepModalData(prev => ({ ...prev, notes }))}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    {/* Delete Button für Bearbeitung */}
                    {editingEntry && (
                      <View style={styles.section}>
                        <TouchableOpacity
                          style={[styles.deleteButton]}
                          onPress={() => {
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
  scrollContent: { paddingBottom: 140, paddingHorizontal: 20 },

  // KPI glass cards (Kompakt)
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 60,
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
    color: '#5e3db3',
    marginTop: 1,
    letterSpacing: -0.5,
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
    paddingVertical: 8,
    marginBottom: 8,
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
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 11, // Match fontSize for perfect alignment
    maxWidth: 180,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
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
  activeTopTabText: { color: '#5e3db3' },

  // Cards Grid (from home.tsx)
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  // Liquid Glass Cards (from home.tsx)
  liquidGlassCardWrapper: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullWidthStopButton: {
    width: '100%',
    marginBottom: 14,
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
    shadowOpacity: 0.8,
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
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  liquidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Entries Container
  entriesContainer: {
    gap: 12,
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
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
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
    fontSize: 16,
    color: '#333333',
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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

});