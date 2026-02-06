import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, SafeAreaView, StatusBar, Text, TouchableWithoutFeedback, Platform, TextInputProps } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getWeightEntries, deleteWeightEntry, WeightEntry, WeightSubject, saveWeightEntry } from '@/lib/weight';
import { supabase, getCachedUser } from '@/lib/supabase';
import { Stack } from 'expo-router';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM } from '@/constants/DesignGuide';
import ActivityCard from '@/components/ActivityCard';
import { PRIMARY as PLANNER_PRIMARY } from '@/constants/PlannerDesign';
import FloatingAddButton from '@/components/planner/FloatingAddButton';
import TextInputOverlay from '@/components/modals/TextInputOverlay';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';

const SUBJECT_COLORS: Record<WeightSubject, string> = {
  mom: '#5E3DB3',
  baby: '#2D9CDB',
};
const DARK_CHART_COLORS: Partial<Record<WeightSubject, string>> = {
  // Kräftigeres Lila für bessere Sichtbarkeit der Gewichtskurve auf dunklem Hintergrund
  mom: '#EE4BFF',
};

const SUBJECT_OPTIONS: WeightSubject[] = ['mom', 'baby'];
const BABY_WEIGHT_FACTOR = 1000;
const isBabySubject = (subject: WeightSubject) => subject === 'baby';
const getWeightUnit = (subject: WeightSubject) => (isBabySubject(subject) ? 'g' : 'kg');
const getDisplayWeightValue = (weightKg: number, subject: WeightSubject) =>
  isBabySubject(subject) ? weightKg * BABY_WEIGHT_FACTOR : weightKg;
const getParentEmoji = (role?: string | null) => (role === 'papa' ? '👨' : '👩');
const formatWeightDisplayValue = (weightKg: number, subject: WeightSubject) => {
  if (isBabySubject(subject)) {
    const grams = weightKg * BABY_WEIGHT_FACTOR;
    return `${grams.toLocaleString('de-DE')} g`;
  }
  const formattedKg = weightKg.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return `${formattedKg} kg`;
};
const normalizeWeightInput = (value: string, subject: WeightSubject) => {
  const trimmed = value.trim();
  if (isBabySubject(subject)) {
    return trimmed.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
  }
  return trimmed.replace(',', '.');
};
// HEADER_TEXT_COLOR wird nun dynamisch über useAdaptiveColors bestimmt
const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

export default function WeightTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  // Verwende useAdaptiveColors für korrekte Farben basierend auf Hintergrundbild
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const getSubjectColor = (subject: WeightSubject) =>
    isDark ? lightenHex(SUBJECT_COLORS[subject]) : SUBJECT_COLORS[subject];

  const getChartColor = (subject: WeightSubject) => {
    if (!isDark) return SUBJECT_COLORS[subject];
    return DARK_CHART_COLORS[subject] ?? getSubjectColor(subject);
  };

  // Dark Mode angepasste Farben (wie in sleep-tracker.tsx)
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const headerTextColor = textSecondary; // Ersetzt HEADER_TEXT_COLOR

  // Glass-Overlay Farbe: bei dunklem Hintergrund abgedunkelt (wie im Sleep-Tracker Wochenansicht)
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;

  // router wird durch die BackButton-Komponente verwaltet
  const insets = useSafeAreaInsets();
  const { activeBaby, activeBabyId, isReady } = useActiveBaby();

  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<WeightSubject>('mom');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightModalSubject, setWeightModalSubject] = useState<WeightSubject>('mom');
  const [weightInput, setWeightInput] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [weightDate, setWeightDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusConfig, setFocusConfig] = useState<{ field: 'weight' | 'notes'; label: string; placeholder?: string; multiline?: boolean; keyboardType?: TextInputProps['keyboardType']; inputMode?: TextInputProps['inputMode']; } | null>(null);
  const [focusValue, setFocusValue] = useState('');

  const babyLabel = useMemo(() => activeBaby?.name?.trim() || 'Mini', [activeBaby?.name]);
  const subjectLabels = useMemo(
    () => ({ mom: 'Ich', baby: babyLabel }),
    [babyLabel]
  );
  const subjectCopyLabels = useMemo(
    () => ({ mom: 'dich', baby: babyLabel }),
    [babyLabel]
  );

  // Lade Gewichtsdaten beim ersten Rendern
  useEffect(() => {
    loadUserRole();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadWeightEntries();
  }, [isReady, activeBabyId]);

  // Lade Gewichtsdaten
  const loadWeightEntries = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getWeightEntries(undefined, activeBabyId);
      if (error) throw error;
      const normalized = (data || []).map((entry) => ({
        ...entry,
        subject: entry.subject ?? 'mom',
      }));
      setWeightEntries(normalized);
    } catch (error) {
      console.error('Error loading weight entries:', error);
      Alert.alert('Fehler', 'Beim Laden der Gewichtsdaten ist ein Fehler aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRole = async () => {
    try {
      const { data: userData } = await getCachedUser();
      if (!userData.user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (error) {
        console.error('Error loading user role:', error);
        return;
      }
      setUserRole(data?.user_role ?? null);
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  // Lösche einen Gewichtseintrag
  const handleDeleteWeightEntry = async (id: string) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Gewichtseintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              const { error } = await deleteWeightEntry(id);
              if (error) throw error;

              // Lade Gewichtsdaten neu
              setIsLoading(true);
              await loadWeightEntries();
              Alert.alert('Erfolg', 'Dein Gewichtseintrag wurde erfolgreich gelöscht.');
            } catch (error) {
              console.error('Error deleting weight entry:', error);
              Alert.alert('Fehler', 'Beim Löschen des Gewichtseintrags ist ein Fehler aufgetreten.');
            } finally {
              setIsSaving(false);
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const openWeightModal = (subject?: WeightSubject) => {
    const nextSubject = subject ?? selectedSubject;
    if (nextSubject === 'baby' && !activeBabyId) {
      Alert.alert('Hinweis', 'Bitte wähle zuerst ein Kind aus.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setWeightDate(today);
    setWeightModalSubject(nextSubject);
    setWeightInput('');
    setWeightNotes('');
    setEditingEntry(null);
    setShowDatePicker(false);
    setWeightModalVisible(true);
    setFocusConfig(null);
    setFocusValue('');
  };

  const closeWeightModal = () => {
    setWeightModalVisible(false);
    setShowDatePicker(false);
    setEditingEntry(null);
    setFocusConfig(null);
    setFocusValue('');
  };

  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateOnly = (dateStr: string) => {
    const parts = dateStr.split('-').map((p) => Number(p));
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      const [y, m, d] = parts;
      const parsed = new Date();
      parsed.setFullYear(y, (m ?? 1) - 1, d ?? 1);
      parsed.setHours(12, 0, 0, 0);
      return parsed;
    }
    const fallback = new Date(dateStr);
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  };

  const handleSaveWeightEntry = async () => {
    const normalizedInput = normalizeWeightInput(weightInput, weightModalSubject);
    const parsedWeight = parseFloat(normalizedInput);
    const unitLabel = isBabySubject(weightModalSubject) ? 'Gramm' : 'Kilogramm';
    if (!normalizedInput || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Hinweis', `Bitte gib ein gültiges Gewicht in ${unitLabel} ein.`);
      return;
    }
    if (weightModalSubject === 'baby' && !activeBabyId) {
      Alert.alert('Hinweis', 'Bitte wähle zuerst ein Kind aus.');
      return;
    }

    try {
      setIsSaving(true);
      const storedWeight = isBabySubject(weightModalSubject)
        ? parsedWeight / BABY_WEIGHT_FACTOR
        : parsedWeight;
      const { error } = await saveWeightEntry({
        date: toDateString(weightDate),
        weight: storedWeight,
        subject: weightModalSubject,
        baby_id: weightModalSubject === 'baby' ? activeBabyId : null,
        notes: weightNotes.trim() ? weightNotes.trim() : undefined,
      });
      if (error) throw error;

      await loadWeightEntries();
      setSelectedSubject(weightModalSubject);
      setEditingEntry(null);
      setWeightModalVisible(false);
      Alert.alert('Erfolg', 'Gewichtseintrag gespeichert.');
    } catch (error) {
      console.error('Error saving weight entry:', error);
      Alert.alert('Fehler', 'Beim Speichern des Gewichtseintrags ist ein Fehler aufgetreten.');
    } finally {
      setIsSaving(false);
    }
  };

  const openFocusEditor = (cfg: { field: 'weight' | 'notes'; label: string; placeholder?: string; multiline?: boolean; keyboardType?: TextInputProps['keyboardType']; inputMode?: TextInputProps['inputMode']; }) => {
    setFocusConfig(cfg);
    setFocusValue(cfg.field === 'weight' ? weightInput : weightNotes);
  };

  const closeFocusEditor = () => {
    setFocusConfig(null);
    setFocusValue('');
  };

  const saveFocusEditor = (next?: string) => {
    if (!focusConfig) return;
    const val = typeof next === 'string' ? next : focusValue;
    if (focusConfig.field === 'weight') {
      setWeightInput(val);
    } else {
      setWeightNotes(val);
    }
    closeFocusEditor();
  };

  const handleEditWeightEntry = (entry: any) => {
    const source = weightEntries.find((e) => e.id === entry.id);
    if (!source) return;
    const parsedDate = parseDateOnly(source.date);
    const subject = source.subject ?? 'mom';
    const displayValue = getDisplayWeightValue(source.weight, subject);
    setWeightModalSubject(subject);
    setWeightInput(
      isBabySubject(subject) ? String(displayValue) : String(source.weight).replace('.', ',')
    );
    setWeightNotes(source.notes ?? '');
    setWeightDate(parsedDate);
    setEditingEntry(source);
    setShowDatePicker(false);
    setWeightModalVisible(true);
    setFocusConfig(null);
    setFocusValue('');
  };

  // Bereite die Daten für das Diagramm vor (nach Range)
  const prepareChartData = (
    entries: WeightEntry[],
    range: 'week' | 'month' | 'year' | 'all',
    legendLabel: string,
    colorHex: string,
    lineStrokeWidth = 3
  ) => {
    const sortedEntries = [...entries].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const colorFn = (opacity = 1) => toRgba(colorHex, opacity);

    if (sortedEntries.length === 0) {
      return {
        data: {
          labels: [],
          datasets: [{ data: [] as number[], color: colorFn, strokeWidth: lineStrokeWidth }],
          legend: [`Gewicht ${legendLabel}`],
        },
        meta: { segments: 5, decimalPlaces: 1 },
      };
    }

    const latestDate = new Date(sortedEntries[sortedEntries.length - 1].date);

    const filterByRange = () => {
      if (range === 'all') return sortedEntries;
      const start = new Date(latestDate);
      if (range === 'week') start.setDate(start.getDate() - 6);
      if (range === 'month') start.setDate(start.getDate() - 29);
      if (range === 'year') start.setDate(start.getDate() - 364);
      return sortedEntries.filter((entry) => {
        const d = new Date(entry.date);
        return d >= start && d <= latestDate;
      });
    };

    // Immer mindestens zwei Punkte: falls Range zu wenige liefert, nehme die letzten beiden gesamten Einträge
    const filtered = filterByRange();
    const ensureMinimumEntries = () => {
      if (filtered.length >= 2) return filtered;
      if (sortedEntries.length >= 2) return sortedEntries.slice(-2);
      return filtered;
    };

    const effectiveEntries = ensureMinimumEntries();
    if (effectiveEntries.length < 2) {
      return {
        data: {
          labels: [],
          datasets: [{ data: [] as number[], color: colorFn, strokeWidth: lineStrokeWidth }],
          legend: [`Gewicht ${legendLabel}`],
        },
        meta: { segments: 5, decimalPlaces: 1 },
      };
    }

    // Pro Datum nur den letzten Eintrag
    const perDateMap: Record<string, WeightEntry> = {};
    effectiveEntries.forEach((entry) => {
      perDateMap[entry.date] = entry;
    });
    const deduped = Object.values(perDateMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labelsRaw = deduped.map((entry) => {
      const d = new Date(entry.date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}.${month}.`;
    });
    const dataPoints = deduped.map((entry) => entry.weight);

    const maxLabels = 12;
    const step = Math.max(1, Math.ceil(labelsRaw.length / maxLabels));
    const labels = labelsRaw.map((label, i) => (i % step === 0 ? label : ''));

    const minVal = Math.min(...dataPoints);
    const maxVal = Math.max(...dataPoints);
    const rangeSpan = Math.max(0.1, maxVal - minVal);
    const decimalPlaces = maxVal < 10 ? 2 : maxVal < 100 ? 1 : 0;
    const segments = rangeSpan <= 2 ? 4 : rangeSpan <= 10 ? 5 : 6;

    return {
      data: {
        labels,
        datasets: [{ data: dataPoints, color: colorFn, strokeWidth: lineStrokeWidth }],
        legend: [`Gewicht ${legendLabel}`],
      },
      meta: { segments, decimalPlaces },
    };
  };

  const filteredEntries = useMemo(
    () => weightEntries.filter((entry) => (entry.subject ?? 'mom') === selectedSubject),
    [weightEntries, selectedSubject]
  );

  const chartEntries = useMemo(
    () =>
      filteredEntries.map((entry) => ({
        ...entry,
        weight: getDisplayWeightValue(entry.weight, selectedSubject),
      })),
    [filteredEntries, selectedSubject]
  );

  const subjectColor = useMemo(() => getSubjectColor(selectedSubject), [selectedSubject, isDark]);
  const chartColor = useMemo(() => getChartColor(selectedSubject), [selectedSubject, isDark]);
  const chartLineStrokeWidth = isDark && selectedSubject === 'mom' ? 4 : 3;

  const { data: chartData, meta: chartMeta } = useMemo(
    () =>
      prepareChartData(
        chartEntries,
        selectedRange,
        subjectLabels[selectedSubject],
        chartColor,
        chartLineStrokeWidth
      ),
    [chartEntries, selectedRange, selectedSubject, chartColor, chartLineStrokeWidth, subjectLabels]
  );

  // Rendere die Gewichtskurve
  const renderWeightChart = () => {
    const subjectCopyLabel = subjectCopyLabels[selectedSubject];
    const unitLabel = getWeightUnit(selectedSubject);
    const isNeonMomChart = isDark && selectedSubject === 'mom';
    const chartFillFromOpacity = isNeonMomChart ? 0.3 : 0.15;
    const chartFillToOpacity = isNeonMomChart ? 0.08 : 0.02;
    const chartDotStrokeWidth = isNeonMomChart ? '3' : '2';
    const hasSeries =
      !!chartData &&
      !!chartData.datasets &&
      chartData.datasets.length > 0 &&
      chartData.datasets[0].data.length >= 2;

    return (
      <>
        {/* Range Tabs bleiben immer sichtbar */}
        <View style={styles.topTabsContainer}>
          {([
            { id: 'week', label: 'Woche' },
            { id: 'month', label: 'Monat' },
            { id: 'year', label: 'Jahr' },
            { id: 'all', label: 'Gesamt' },
          ] as const).map(t => {
            const isActive = selectedRange === t.id;
            const tabTint = subjectColor;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.topTab,
                  {
                    borderColor: isDark ? toRgba(tabTint, 0.28) : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
                  },
                  isActive && [
                    styles.activeTopTab,
                    {
                      borderColor: toRgba(tabTint, 0.65),
                      backgroundColor: isDark ? toRgba(tabTint, 0.2) : 'rgba(255,255,255,0.9)',
                    },
                  ],
                ]}
                onPress={() => setSelectedRange(t.id)}
              >
                <View style={styles.topTabInner}>
                  <Text style={[styles.topTabText, { color: textSecondary }, isActive && [styles.activeTopTabText, { color: subjectColor }]]}>{t.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasSeries ? (
          <LiquidGlassCard style={styles.chartContainer} intensity={26} overlayColor={glassOverlay}>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={screenWidth - LAYOUT_PAD * 2}
                height={220}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: 'transparent',
                  backgroundGradientTo: 'transparent',
                  decimalPlaces: chartMeta.decimalPlaces, // Dynamische Nachkommastellen je nach Wertebereich
                  color: () => textPrimary,
                  labelColor: () => textSecondary,
                  style: {
                    borderRadius: 22,
                  },
                  propsForDots: {
                    r: '5',
                    strokeWidth: chartDotStrokeWidth,
                    stroke: chartColor,
                    fill: chartColor,
                  },
                  // Formatierung der Y-Achsen-Labels (kg-Anzeige)
                  formatYLabel: (value) => `${value} ${unitLabel}`, // Einheit je nach Subjekt
                  // Mehr Platz zwischen den Datenpunkten
                  propsForBackgroundLines: {
                    strokeWidth: 1,
                    stroke: 'rgba(0,0,0,0.06)',
                  },
                  // Anpassung der Beschriftungen
                  propsForLabels: {
                    fontSize: 12,
                    fontWeight: '600',
                  },
                  // Spezifische Anpassung der Y-Achsen-Labels
                  propsForVerticalLabels: {
                    fontSize: 12,
                    fontWeight: '500',
                  },
                  // Spezifische Anpassung der X-Achsen-Labels
                  propsForHorizontalLabels: {
                    fontSize: 12,
                    fontWeight: '600',
                    dy: -2,
                    rotation: 0,
                  },
                  fillShadowGradientFrom: chartColor,
                  fillShadowGradientFromOpacity: chartFillFromOpacity,
                  fillShadowGradientTo: chartColor,
                  fillShadowGradientToOpacity: chartFillToOpacity,
                }}
                transparent
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={true}
                segments={chartMeta.segments} // Dynamisch basierend auf Spannweite
                withVerticalLines={false} // Keine vertikalen Linien für bessere Übersicht
                withHorizontalLines={true} // Horizontale Linien beibehalten
                withVerticalLabels={true}
                withHorizontalLabels={true}
                fromZero={false} // Automatische Skalierung (nicht auf 0 fixiert, damit Babys fein bleiben)
                yAxisLabel="" // Leeres Präfix
                yAxisSuffix="" // Kein Suffix an jedem Wert
                formatXLabel={(value) => value} // Standard-Formatierung für X-Achse
              />
            </View>
          </LiquidGlassCard>
        ) : (
          <LiquidGlassCard style={styles.emptyChartContainer} intensity={26} overlayColor={glassOverlay}>
            <IconSymbol name="chart.line.uptrend.xyaxis" size={40} color={isDark ? adaptiveColors.iconSecondary : theme.tabIconDefault} />
            <ThemedText style={[styles.emptyChartText, { color: textSecondary }]}>
              Füge mindestens zwei Gewichtseinträge für {subjectCopyLabel} hinzu, um eine Kurve zu sehen.
            </ThemedText>
          </LiquidGlassCard>
        )}
      </>
    );
  };

  // Mappe Gewichtseintrag auf ActivityCard-kompatibles Format
  const convertWeightToDailyEntry = (e: WeightEntry): any => {
    const subject = e.subject ?? 'mom';
    const displayWeight = formatWeightDisplayValue(e.weight, subject);
    const parentEmoji = getParentEmoji(userRole);
    const displayDate = formatDisplayDate(parseDateOnly(e.date));
    return {
      id: e.id,
      entry_date: e.date,
      entry_type: 'other',
      // keine Zeiten -> keine Zeit-Pills
      notes: e.notes ?? undefined,
      // Custom Anzeige wie im Sleep-Tracker (über emoji/label)
      emoji: subject === 'baby' ? '👶' : parentEmoji,
      label: `${subjectLabels[subject]}: ${displayWeight}`,
      weightValue: e.weight,
      weightSubject: subject,
      weightNotes: e.notes ?? '',
      weightDate: e.date,
      weightDateLabel: displayDate,
      rawWeightEntry: e,
    };
  };

  // Rendere die Gewichtseinträge
  const renderWeightEntries = () => {
    const subjectLabel = subjectCopyLabels[selectedSubject];
    if (filteredEntries.length === 0) {
      return (
        <LiquidGlassCard style={styles.emptyState} intensity={26} overlayColor={glassOverlay}>
          <IconSymbol name="scalemass" size={40} color={isDark ? adaptiveColors.iconSecondary : theme.tabIconDefault} />
          <ThemedText style={[styles.emptyStateText, { color: textPrimary }]}>
            Noch keine Gewichtseinträge für {subjectLabel}
          </ThemedText>
          <ThemedText style={[styles.emptyStateSubtext, { color: textSecondary }]}>
            Füge deinen ersten Gewichtseintrag hinzu, um die Kurve für {subjectLabel} zu sehen.
          </ThemedText>
        </LiquidGlassCard>
      );
    }

    const sortedEntries = [...filteredEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
      <View style={styles.timelineSection}>
        <Text style={[styles.sectionTitleSleepLike, { color: textSecondary }]}>Gewichtseinträge für {subjectLabel}</Text>
        <View style={{ alignSelf: 'center', width: contentWidth }}>
          <View style={[styles.entriesContainer, { paddingHorizontal: TIMELINE_INSET }]}>
            {sortedEntries.map((entry) => (
              <ActivityCard
                key={entry.id}
                entry={convertWeightToDailyEntry(entry)}
                onDelete={(id) => handleDeleteWeightEntry(id)}
                onEdit={(cardEntry) => handleEditWeightEntry(cardEntry)}
                marginHorizontal={8}
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderSubjectSwitch = () => (
    <LiquidGlassCard style={styles.subjectSwitcherCard} intensity={26} overlayColor={glassOverlay}>
      <ThemedText style={[styles.subjectSwitcherTitle, { color: textPrimary }]}>
        Für wen möchtest du tracken?
      </ThemedText>
      <ThemedText style={[styles.subjectSwitcherSubtitle, { color: textSecondary }]}>
        Wechsle zwischen {babyLabel} und dir, um die passenden Einträge zu sehen.
      </ThemedText>
      <View style={styles.subjectPillRow}>
        {SUBJECT_OPTIONS.map((subjectKey) => {
          const isActive = selectedSubject === subjectKey;
          const pillColor = getSubjectColor(subjectKey);
          return (
            <TouchableOpacity
              key={subjectKey}
              style={[
                styles.subjectPill,
                {
                  borderColor: isDark ? toRgba(pillColor, 0.35) : 'rgba(255,255,255,0.35)',
                  backgroundColor: isDark ? toRgba(pillColor, 0.12) : 'rgba(255,255,255,0.6)',
                },
                isActive && [
                  styles.subjectPillActive,
                  {
                    borderColor: toRgba(pillColor, 0.6),
                    backgroundColor: isDark ? toRgba(pillColor, 0.24) : 'rgba(255,255,255,0.95)',
                  },
                ],
              ]}
              onPress={() => setSelectedSubject(subjectKey)}
              activeOpacity={0.85}
            >
              <Text style={[styles.subjectPillText, { color: textSecondary }, isActive && [styles.subjectPillTextActive, { color: textPrimary }]]}>
                {subjectLabels[subjectKey]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </LiquidGlassCard>
  );

  const renderWeightCaptureModal = () => (
    <Modal
      visible={weightModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeWeightModal}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)' }]}>
        <TouchableWithoutFeedback onPress={closeWeightModal}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'extraLight'}
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? 'rgba(10,10,12,0.86)' : 'transparent',
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
              paddingBottom: Math.max(28, insets.bottom + 16),
            },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                styles.headerButtonGhost,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
              ]}
              onPress={closeWeightModal}
            >
              <Text style={[styles.closeHeaderButtonText, { color: headerTextColor }]}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.modalTitle, { color: headerTextColor }]}>{editingEntry ? 'Gewicht bearbeiten' : 'Gewicht hinzufügen'}</Text>
              <Text style={[styles.modalSubtitle, { color: headerTextColor }]}>Für dich oder {babyLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.headerButton, styles.saveHeaderButton, { backgroundColor: PLANNER_PRIMARY }]}
              onPress={handleSaveWeightEntry}
            >
              <Text style={styles.saveHeaderButtonText}>✓</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: headerTextColor }]}>Für wen?</Text>
              <View style={styles.typeSwitchRow}>
                {SUBJECT_OPTIONS.map((subjectKey) => {
                  const isActive = weightModalSubject === subjectKey;
                  return (
                    <TouchableOpacity
                      key={subjectKey}
                      style={[
                        styles.typeSwitchButton,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
                          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.05)',
                        },
                        isActive && styles.typeSwitchButtonActive,
                      ]}
                      onPress={() => setWeightModalSubject(subjectKey)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.typeSwitchLabel, { color: headerTextColor }, isActive && styles.typeSwitchLabelActive]}>
                        {subjectLabels[subjectKey]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: headerTextColor }]}>Gewicht ({getWeightUnit(weightModalSubject)})</Text>
              <View
                style={[
                  styles.pickerBlock,
                  {
                    backgroundColor: isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.inlineField,
                    {
                      backgroundColor: isDark ? 'rgba(24,24,28,0.92)' : 'rgba(255,255,255,0.92)',
                      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  activeOpacity={0.9}
                    onPress={() =>
                      openFocusEditor({
                        field: 'weight',
                        label: `Gewicht (${getWeightUnit(weightModalSubject)})`,
                        placeholder: isBabySubject(weightModalSubject) ? 'z. B. 3500' : 'z. B. 65,4',
                        keyboardType: isBabySubject(weightModalSubject) ? 'number-pad' : 'decimal-pad',
                        inputMode: isBabySubject(weightModalSubject) ? 'numeric' : 'decimal',
                      })
                    }
                >
                  <Text style={[styles.inlineFieldLabel, { color: headerTextColor }]}>Gewicht</Text>
                  <Text style={[weightInput.trim() ? styles.inlineFieldValue : styles.inlineFieldPlaceholder, { color: weightInput.trim() ? headerTextColor : `${headerTextColor}B3` }]}>
                    {weightInput.trim()
                      ? `${weightInput.trim()} ${getWeightUnit(weightModalSubject)}`
                      : 'Tippe zum Eingeben'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: headerTextColor }]}>Datum</Text>
              <View
                style={[
                  styles.pickerBlock,
                  {
                    backgroundColor: isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <TouchableOpacity style={styles.selectorHeader} onPress={() => setShowDatePicker((prev) => !prev)} activeOpacity={0.9}>
                  <Text style={[styles.pickerLabel, { color: headerTextColor }]}>Messdatum</Text>
                  <Text style={[styles.selectorValue, { color: headerTextColor }]}>{formatDisplayDate(weightDate)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <View
                    style={[
                      styles.pickerInner,
                      {
                        backgroundColor: isDark ? 'rgba(22,22,26,0.95)' : 'rgba(255,255,255,0.95)',
                      },
                    ]}
                  >
                    <DateTimePicker
                      value={weightDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, date) => {
                        if (date) {
                          const normalized = new Date(date);
                          normalized.setHours(12, 0, 0, 0);
                          setWeightDate(normalized);
                        }
                        if (Platform.OS !== 'ios') {
                          setShowDatePicker(false);
                        } else if (event?.type === 'dismissed') {
                          setShowDatePicker(false);
                        }
                      }}
                      maximumDate={new Date()}
                      style={styles.dateTimePicker}
                    />
                    {Platform.OS === 'ios' && (
                      <View style={styles.datePickerActions}>
                        <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowDatePicker(false)}>
                          <Text style={styles.datePickerCancelText}>Fertig</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: headerTextColor }]}>Notizen</Text>
              <View
                style={[
                  styles.pickerBlock,
                  {
                    backgroundColor: isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.85)',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.inlineField,
                    styles.inlineFieldMultiline,
                    {
                      backgroundColor: isDark ? 'rgba(24,24,28,0.92)' : 'rgba(255,255,255,0.92)',
                      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  activeOpacity={0.9}
                  onPress={() =>
                    openFocusEditor({
                      field: 'notes',
                      label: 'Notizen',
                      placeholder: 'z. B. Messzeitpunkt oder besondere Hinweise',
                      multiline: true,
                    })
                  }
                >
                  <Text style={[styles.inlineFieldLabel, { color: headerTextColor }]}>Details</Text>
                  <Text
                    style={[weightNotes.trim() ? styles.inlineFieldValue : styles.inlineFieldPlaceholder, { color: weightNotes.trim() ? headerTextColor : `${headerTextColor}B3` }]}
                    numberOfLines={3}
                  >
                    {weightNotes.trim() || 'Tippe zum Hinzufügen'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          <TextInputOverlay
            visible={!!focusConfig}
            label={focusConfig?.label ?? ''}
            value={focusValue}
            placeholder={focusConfig?.placeholder}
            multiline={!!focusConfig?.multiline}
            accentColor={PLANNER_PRIMARY}
            keyboardType={focusConfig?.keyboardType}
            inputMode={focusConfig?.inputMode}
            onClose={closeFocusEditor}
            onSubmit={(next) => saveFocusEditor(next)}
          />
        </BlurView>
      </View>
    </Modal>
  );

  // Rendere die SaveView-Komponente
  const renderSaveView = () => {
    return (
      <Modal
        transparent={true}
        visible={isSaving}
        animationType="fade"
      >
        <View style={styles.saveViewContainer}>
          <LiquidGlassCard style={styles.saveView} intensity={26} overlayColor={glassOverlay}>
            <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.accent} />
            <ThemedText style={[styles.saveViewText, { color: textPrimary }]}>
              Daten werden gespeichert...
            </ThemedText>
          </LiquidGlassCard>
        </View>
      </Modal>
    );
  };

  // Holen der Bildschirmabmessungen für das Diagramm
  const screenWidth = Dimensions.get('window').width;
  const contentWidth = screenWidth - 2 * LAYOUT_PAD;
  const TIMELINE_INSET = 8;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        {/* SaveView Modal */}
        {renderSaveView()}
        {renderWeightCaptureModal()}

        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          
          <Header title="Gewichtskurve" showBackButton />
          
          <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.accent} />
                <ThemedText style={[styles.loadingText, { color: textSecondary }]}>Daten werden geladen...</ThemedText>
              </View>
            ) : (
              <>
                {renderSubjectSwitch()}
                {renderWeightChart()}
                {renderWeightEntries()}
              </>
            )}
            </ScrollView>
          </View>
          <FloatingAddButton onPress={() => openWeightModal(selectedSubject)} bottomInset={Math.max(88, insets.bottom + 54)} rightInset={18} />
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent background to show the image
  },
  container: {
    flex: 1,
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: LAYOUT_PAD,
    paddingBottom: 40,
  },

  saveViewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  saveView: {
    padding: 20,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveViewText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  chartContainer: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%', // Volle Breite nutzen
    borderRadius: 22,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    width: '100%',
    justifyContent: 'center', // Zentriert den Chart horizontal
  },
  // yAxisLabel wurde entfernt, da kg jetzt direkt in den Y-Achsenwerten angezeigt wird
  chart: {
    borderRadius: 22,
    marginVertical: 8,
    paddingHorizontal: 0,
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 22,
    marginBottom: 20,
  },
  emptyChartText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  entriesContainer: {
    gap: 16,
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
  },
  timelineSection: {
    paddingHorizontal: 0,
  },
  sectionTitleSleepLike: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    fontSize: 18,
    fontWeight: '700',
    // color wird dynamisch gesetzt
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.2,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 80, // Höher positioniert, um nicht vom Navigationsbalken verdeckt zu werden
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 22,
    marginVertical: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Top tabs (like sleep-tracker)
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: {},
  topTabText: { fontSize: 13, fontWeight: '700' }, // color wird dynamisch gesetzt
  activeTopTabText: { fontWeight: '800' },
  // Modal styles (match Planner Capture)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalScrollContent: {
    paddingBottom: 24,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerButtonGhost: {
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  closeHeaderButtonText: {
    fontSize: 20,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
    // color wird dynamisch gesetzt
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
    width: '100%',
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    // color wird dynamisch gesetzt
  },
  typeSwitchRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeSwitchButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  typeSwitchButtonActive: {
    backgroundColor: PLANNER_PRIMARY,
    borderColor: PLANNER_PRIMARY,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  typeSwitchLabel: {
    fontSize: 13,
    fontWeight: '600',
    // color wird dynamisch gesetzt
  },
  typeSwitchLabelActive: {
    color: '#fff',
  },
  pickerBlock: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    gap: 8,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '500',
    // color wird dynamisch gesetzt
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  pickerInner: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },
  dateTimePicker: {
    alignSelf: 'stretch',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: PLANNER_PRIMARY,
  },
  datePickerCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineField: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  inlineFieldMultiline: {
    minHeight: 110,
    justifyContent: 'flex-start',
  },
  inlineFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  inlineFieldValue: {
    fontSize: 16,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  inlineFieldPlaceholder: {
    fontSize: 16,
    fontWeight: '600',
    // color wird dynamisch gesetzt
  },
  subjectSwitcherCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    gap: 6,
  },
  subjectSwitcherTitle: {
    fontSize: 17,
    fontWeight: '700',
    // color wird dynamisch gesetzt
    textAlign: 'center',
  },
  subjectSwitcherSubtitle: {
    fontSize: 13,
    // color wird dynamisch gesetzt
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 6,
  },
  subjectPillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  subjectPill: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  subjectPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectPillText: {
    fontSize: 14,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  subjectPillTextActive: {
    // color wird dynamisch gesetzt
  },
});
