import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Modal,
  TouchableOpacity,
  Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { Stack, useRouter } from 'expo-router';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { LiquidGlassCard, LAYOUT_PAD, TIMELINE_INSET, TEXT_PRIMARY, GLASS_BORDER, PRIMARY } from '@/constants/DesignGuide';
import { supabase, updateDueDateAndSync } from '@/lib/supabase';

type PregnancyStats = {
  daysLeft: number;
  currentWeek: number;
  currentDay: number;
  progress: number;
  trimester: string;
  daysPregnant: number;
  calendarMonth: number;
  pregnancyMonth: number;
};

const initialStats: PregnancyStats = {
  daysLeft: 0,
  currentWeek: 1,
  currentDay: 0,
  progress: 0,
  trimester: '1. Trimester',
  daysPregnant: 0,
  calendarMonth: 1,
  pregnancyMonth: 1,
};

const pastelPalette = {
  peach: 'rgba(255, 223, 209, 0.85)',
  rose: 'rgba(255, 210, 224, 0.8)',
  honey: 'rgba(255, 239, 214, 0.85)',
  sage: 'rgba(214, 236, 220, 0.78)',
  lavender: 'rgba(236, 224, 255, 0.78)',
  sky: 'rgba(222, 238, 255, 0.85)',
  blush: 'rgba(255, 218, 230, 0.8)',
};

const PURPLE_GLASS = 'rgba(142, 78, 198, 0.22)';
const PURPLE_GLASS_LIGHT = 'rgba(142, 78, 198, 0.12)';
const SOFT_HYPHEN = '\u00AD';

const GlassLayer = ({
  tint = 'rgba(255,255,255,0.22)',
  sheenOpacity = 0.35,
}: {
  tint?: string;
  sheenOpacity?: number;
}) => (
  <>
    <LinearGradient
      colors={[tint, 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glassLayerGradient}
    />
    <View style={[styles.glassSheen, { opacity: sheenOpacity }]} />
  </>
);

const getArcPath = (progress: number) => {
  const capped = Math.min(1, Math.max(0, progress));
  const angle = 2 * Math.PI * capped;
  const largeArcFlag = capped > 0.5 ? 1 : 0;
  const endX = 50 + 45 * Math.sin(angle);
  const endY = 50 - 45 * Math.cos(angle);

  return `
    M 50 5
    A 45 45 0 ${largeArcFlag} 1 ${endX} ${endY}
  `;
};

export default function PregnancyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PregnancyStats>(initialStats);

  useEffect(() => {
    if (user) {
      loadDueDate();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (dueDate) {
      calculateStats();
    }
  }, [dueDate]);

  const loadDueDate = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_settings')
        .select('due_date')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading due date:', error);
      } else if (data && data.due_date) {
        setDueDate(new Date(data.due_date));
      }
    } catch (err) {
      console.error('Failed to load due date:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = () => {
    if (!dueDate) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dueCopy = new Date(dueDate);
    dueCopy.setHours(0, 0, 0, 0);

    const difference = dueCopy.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.round(difference / (1000 * 60 * 60 * 24)));

    const totalDaysInPregnancy = 280;
    const daysPregnant = Math.min(totalDaysInPregnancy, Math.max(0, totalDaysInPregnancy - daysRemaining));

    const weeksPregnant = Math.floor(daysPregnant / 7);
    const daysInCurrentWeek = daysPregnant % 7;
    const currentWeek = Math.min(40, weeksPregnant + 1);

    const progress = Math.min(1, Math.max(0, daysPregnant / totalDaysInPregnancy));

    let trimester = '1. Trimester';
    if (currentWeek >= 28) {
      trimester = '3. Trimester';
    } else if (currentWeek >= 14) {
      trimester = '2. Trimester';
    }

    const calendarMonth = Math.max(1, Math.ceil(daysPregnant / 30));
    const pregnancyMonth = Math.max(1, Math.ceil(currentWeek / 4));

    setStats({
      daysLeft: daysRemaining,
      currentWeek,
      currentDay: daysInCurrentWeek,
      progress,
      trimester,
      daysPregnant,
      calendarMonth,
      pregnancyMonth,
    });
  };

  const saveDueDate = async (date: Date) => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtstermin zu speichern.');
      return;
    }

    try {
      const result = await updateDueDateAndSync(user.id, date);

      if (!result.success) {
        console.error('Error saving due date:', result.error);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
        return;
      }

      setDueDate(date);
      calculateStats();

      const syncedUsers = result.syncResult?.linkedUsers || [];
      if (syncedUsers.length > 0) {
        const linkedUserNames = syncedUsers.map((linkedUser: any) => linkedUser.firstName).join(', ');
        Alert.alert('Erfolg', `Geburtstermin gespeichert und mit ${linkedUserNames} synchronisiert.`);
      } else {
        Alert.alert('Erfolg', 'Geburtstermin erfolgreich gespeichert.');
      }
    } catch (err) {
      console.error('Failed to save due date:', err);
      Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        saveDueDate(selectedDate);
      }
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    if (tempDate) {
      saveDueDate(tempDate);
    }
    setShowDatePicker(false);
  };

  const showDatepicker = () => {
    if (Platform.OS === 'ios') {
      setTempDate(dueDate || new Date());
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const factItems = [
    {
      key: 'progress',
      label: 'Fortschritt',
      value: `${(stats.progress * 100).toFixed(1).replace('.', ',')} %`,
      caption: 'von 280 Tagen',
      icon: 'waveform.path.ecg' as const,
      accent: pastelPalette.rose,
      iconColor: '#D06262',
    },
    {
      key: 'days-pregnant',
      label: 'Tage schwanger',
      value: stats.daysPregnant.toLocaleString('de-DE'),
      caption: 'seit Beginn',
      icon: 'hourglass.bottomhalf.fill' as const,
      accent: pastelPalette.sage,
      iconColor: '#5A8F80',
    },
    {
      key: 'days-left',
      label: 'Tage bis EGT',
      value: stats.daysLeft.toLocaleString('de-DE'),
      caption: 'verbleibend',
      icon: 'calendar.badge.clock' as const,
      accent: pastelPalette.honey,
      iconColor: '#B7745D',
    },
    {
      key: 'trimester',
      label: 'Trimester',
      value: stats.trimester,
      caption: 'laufend',
      icon: 'sparkles' as const,
      accent: pastelPalette.sky,
      iconColor: '#7A6FD1',
    },
  ];

  const statTiles = [
    {
      key: 'week',
      label: 'Aktuelle SSW',
      value: `${stats.currentWeek}. SSW`,
      icon: 'calendar' as const,
      accent: pastelPalette.lavender,
      iconColor: '#7A6FD1',
    },
    {
      key: 'days',
      label: 'Tag der Woche',
      value: `${stats.currentDay} Tag${stats.currentDay === 1 ? '' : 'e'}`,
      icon: 'sunrise' as const,
      accent: pastelPalette.peach,
      iconColor: '#C17055',
    },
    {
      key: 'trimester-card',
      label: 'Trimester',
      value: stats.trimester,
      icon: 'circle.grid.hex' as const,
      accent: pastelPalette.blush,
      iconColor: '#CF6F8B',
    },
    {
      key: 'calendar-month',
      label: `Kalender${SOFT_HYPHEN}monat`,
      value: `${stats.calendarMonth}. Monat`,
      icon: 'chart.bar.xaxis' as const,
      accent: pastelPalette.sage,
      iconColor: '#5A8F80',
    },
    {
      key: 'pregnancy-month',
      label: `Schwangerschafts${SOFT_HYPHEN}monat`,
      value: `${stats.pregnancyMonth}. Monat`,
      icon: 'moon.stars.fill' as const,
      accent: pastelPalette.sky,
      iconColor: '#6C87C1',
    },
    {
      key: 'days-left-card',
      label: 'Tage bis zum EGT',
      value: stats.daysLeft.toLocaleString('de-DE'),
      icon: 'arrow.down' as const,
      accent: pastelPalette.honey,
      iconColor: '#B7745D',
    },
  ];

  if (!dueDate && !isLoading) {
    return (
      <ThemedBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Stack.Screen options={{ headerShown: false }} />
          <Header
            title="Schwangerschaft"
            subtitle="Countdown noch nicht gesetzt"
            showBackButton
          />
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            <LiquidGlassCard style={styles.glassCard}>
              <View style={styles.glassInner}>
                <ThemedText style={styles.sectionTitle}>Geburtstermin fehlt</ThemedText>
                <ThemedText style={styles.noDataText}>
                  Bitte setze zuerst deinen Geburtstermin in der Countdown-Ansicht, um alle Details zu sehen.
                </ThemedText>
                <TouchableOpacity
                  style={[styles.dueDateAction, styles.glassSurface]}
                  onPress={() => router.push('/countdown')}
                >
                  <GlassLayer tint={pastelPalette.lavender} sheenOpacity={0.22} />
                  <IconSymbol name="calendar" size={18} color="#7A6FD1" style={styles.dueDateActionIcon} />
                  <ThemedText style={styles.dueDateActionText}>Zum Countdown</ThemedText>
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title="Schwangerschaft"
          subtitle="Countdown & Status"
          showBackButton
        />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            {dueDate ? (
              <>
                <LiquidGlassCard style={[styles.glassCard, styles.firstGlassCard]}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Fortschritt</ThemedText>
                    <View style={[styles.progressPanel, styles.glassSurface]}>
                      <GlassLayer tint="rgba(255,255,255,0.22)" sheenOpacity={0.2} />
                      <View style={styles.progressWrapper}>
                        <View style={[styles.progressCircleContainer, styles.glassSurface]}>
                          <GlassLayer tint="rgba(255,255,255,0.75)" sheenOpacity={0.2} />
                          <Svg height="120" width="120" viewBox="0 0 100 100">
                            <Circle
                              cx="50"
                              cy="50"
                              r="45"
                              stroke="rgba(255,255,255,0.35)"
                              strokeWidth="6"
                              fill="transparent"
                            />
                            <Path
                              d={getArcPath(stats.progress)}
                              stroke={PRIMARY}
                              strokeWidth="6"
                              fill="transparent"
                              strokeLinecap="round"
                            />
                            <G>
                              <SvgText
                                x="50"
                                y="48"
                                fontSize="22"
                                textAnchor="middle"
                                fill={PRIMARY}
                                fontWeight="bold"
                              >
                                {(stats.progress * 100).toFixed(1).replace('.', ',')}
                              </SvgText>
                              <SvgText
                                x="50"
                                y="64"
                                fontSize="14"
                                textAnchor="middle"
                                fill={PRIMARY}
                              >
                                %
                              </SvgText>
                            </G>
                          </Svg>
                        </View>
                        <View style={styles.progressTextBlock}>
                          <ThemedText style={styles.progressHeadline}>Deine Reise</ThemedText>
                          <ThemedText style={styles.progressSubtext}>Noch {stats.daysLeft} Tage bis EGT</ThemedText>
                          <ThemedText style={styles.progressSubtext}>{stats.daysPregnant} Tage seit Beginn</ThemedText>
                        </View>
                      </View>
                      <View style={styles.heartsContainer}>
                        {Array.from({ length: 10 }).map((_, index) => (
                          <IconSymbol
                            key={index}
                            name={index < Math.round(stats.progress * 10) ? 'heart.fill' : 'heart'}
                            size={18}
                            color={PRIMARY}
                            style={styles.heartIcon}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.glassCard}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Errechneter Geburtstermin</ThemedText>
                    <TouchableOpacity
                      style={styles.dueDateTouch}
                      onPress={showDatepicker}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.dueDateDisplay, styles.glassSurface]}>
                        <GlassLayer tint={PURPLE_GLASS} sheenOpacity={0.26} />
                        <View style={styles.dueDateRow}>
                          <View style={styles.dueDateIconWrap}>
                            <IconSymbol name="calendar" size={20} color={PRIMARY} />
                          </View>
                          <ThemedText style={styles.dueDateValue}>
                            {dueDate.toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            })}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.editHintContainer}>
                        <IconSymbol name="pencil" size={14} color={TEXT_PRIMARY} style={{ marginRight: 6, opacity: 0.7 }} />
                        <ThemedText style={styles.editHint}>Tippen zum Ändern</ThemedText>
                      </View>
                    </TouchableOpacity>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.glassCard}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Schwangerschafts-Details</ThemedText>
                    <View style={styles.statGrid}>
                      {statTiles.map((tile) => (
                        <View key={tile.key} style={[styles.statItem, styles.glassSurface]}>
                          <GlassLayer tint={tile.accent} sheenOpacity={0.18} />
                          <View style={styles.statIcon}>
                            <IconSymbol name={tile.icon} size={16} color={tile.iconColor} />
                          </View>
                          <ThemedText style={styles.statValue}>{tile.value}</ThemedText>
                          <ThemedText
                            style={styles.statLabel}
                            android_hyphenationFrequency="full"
                            textBreakStrategy="balanced"
                          >
                            {tile.label}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.glassCard}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Interessante Fakten</ThemedText>
                    <View style={styles.factGrid}>
                      {factItems.map((fact) => (
                        <View key={fact.key} style={[styles.factTile, styles.glassSurface]}>
                          <GlassLayer tint={fact.accent} sheenOpacity={0.18} />
                          <View style={[styles.factIcon, { backgroundColor: 'rgba(255,255,255,0.85)' }]}> 
                            <IconSymbol name={fact.icon} size={18} color={fact.iconColor} />
                          </View>
                          <ThemedText style={styles.factLabel}>{fact.label}</ThemedText>
                          <ThemedText style={styles.factValue}>{fact.value}</ThemedText>
                          <ThemedText style={styles.factCaption}>{fact.caption}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>

                {Platform.OS === 'android' && showDatePicker && (
                  <DateTimePicker
                    value={dueDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 280)}
                  />
                )}

                {Platform.OS === 'ios' && (
                  <Modal
                    animationType="fade"
                    transparent
                    visible={showDatePicker}
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <View style={styles.pickerHeader}>
                          <ThemedText style={styles.pickerTitle}>Geburtstermin auswählen</ThemedText>
                          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                            <IconSymbol name="xmark.circle.fill" size={28} color={PRIMARY} style={{ opacity: 0.9 }} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.pickerContainer}>
                          <DateTimePicker
                            value={tempDate || dueDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={handleDateChange}
                            minimumDate={new Date()}
                            maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 280)}
                            textColor={TEXT_PRIMARY}
                          />
                        </View>
                        <TouchableOpacity style={styles.confirmButton} onPress={confirmIOSDate}>
                          <ThemedText style={styles.confirmButtonText}>Bestätigen</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}
              </>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  glassLayerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  glassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  firstGlassCard: {
    marginTop: 12,
  },
  glassInner: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  progressPanel: {
    borderRadius: 20,
    padding: 18,
    marginTop: 6,
  },
  progressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  progressCircleContainer: {
    width: 120,
    height: 120,
    borderRadius: 70,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 16,
  },
  progressTextBlock: {
    flex: 1,
    paddingLeft: 16,
    minWidth: 0,
  },
  progressHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  progressSubtext: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    opacity: 0.8,
  },
  heartsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  heartIcon: {
    marginHorizontal: 2,
  },
  dueDateTouch: {
    width: '100%',
    marginTop: 4,
    alignItems: 'center',
  },
  dueDateDisplay: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 20,
    marginBottom: 8,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  dueDateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE_GLASS_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dueDateValue: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 34,
  },
  editHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editHint: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    opacity: 0.7,
  },
  dueDateAction: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueDateActionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  dueDateActionIcon: {
    marginRight: 8,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statItem: {
    width: '48%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
    flexShrink: 1,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  factTile: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  factLabel: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  factValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  factCaption: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    opacity: 0.8,
    marginTop: 2,
  },
  noDataText: {
    fontSize: 15,
    textAlign: 'center',
    color: TEXT_PRIMARY,
    opacity: 0.8,
    marginBottom: 12,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 22,
    borderRadius: 24,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.25)',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142,78,198,0.2)',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  pickerContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 15,
    overflow: 'hidden',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.25)',
  },
  confirmButton: {
    backgroundColor: PRIMARY,
    padding: 14,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.4,
  },
});
