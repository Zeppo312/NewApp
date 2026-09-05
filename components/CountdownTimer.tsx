import React, { useState, useEffect } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, TouchableOpacity, useWindowDimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { router } from 'expo-router';
import Svg, { Circle, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PRIMARY, TEXT_PRIMARY, FONT_SM, FONT_MD, RADIUS } from '@/constants/DesignGuide';
import {
  CountdownLocale,
  DEFAULT_COUNTDOWN_LOCALE,
  getCountdownDayLabel,
  translateCountdownText,
} from '@/lib/countdownTranslations';

// Hilfsfunktion zum Aufteilen von Text in mehrere Zeilen
const splitTextIntoLines = (text: string, maxCharsPerLine: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine += (currentLine.length === 0 ? '' : ' ') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
};

interface CountdownTimerProps {
  dueDate: Date | null;
  // Darstellung: 'standalone' hat eigenen Card-Look, 'embedded' ist für GlassCards
  variant?: 'standalone' | 'embedded';
  // Optional: eigener Handler beim Tippen auf den Kreis
  onPressRing?: () => void;
  locale?: CountdownLocale;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  dueDate,
  variant = 'standalone',
  onPressRing,
  locale = DEFAULT_COUNTDOWN_LOCALE,
}) => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isOverdue, setIsOverdue] = useState<boolean>(false);
  const t = (key: Parameters<typeof translateCountdownText>[1], params?: Record<string, string | number>) =>
    translateCountdownText(locale, key, params);

  useEffect(() => {
    if (!dueDate) return;

    const calculateTimeLeft = () => {
      // Aktuelles Datum ohne Uhrzeit (nur Tag)
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Geburtstermin ohne Uhrzeit (nur Tag)
      const dueDateCopy = new Date(dueDate);
      dueDateCopy.setHours(0, 0, 0, 0);

      // Berechne die Differenz in Millisekunden
      const difference = dueDateCopy.getTime() - now.getTime();

      // Berechne die Tage bis zum Geburtstermin (immer ganze Tage)
      const days = Math.round(difference / (1000 * 60 * 60 * 24));
      setDaysLeft(days);

      // Setze den Überfälligkeitsstatus
      setIsOverdue(days < 0);

      // Berechne die aktuelle SSW
      // Schwangerschaft dauert ca. 40 Wochen
      const totalDaysInPregnancy = 280; // 40 Wochen * 7 Tage

      // Berechne die Tage der Schwangerschaft.
      // Die Werte werden auf den gültigen Bereich einer Schwangerschaft begrenzt,
      // damit bei einem sehr weit entfernten ET keine SSW 0 oder negativ entsteht.
      const daysRemaining = Math.max(0, days);
      const daysPregnant = Math.min(
        totalDaysInPregnancy,
        Math.max(0, totalDaysInPregnancy - daysRemaining)
      );

      // Berechne SSW und Tag
      const weeksPregnant = Math.floor(daysPregnant / 7);
      const daysInCurrentWeek = daysPregnant % 7;

      // In der SSW-Zählung ist man bereits in der nächsten Woche, selbst bei 0 Tagen
      // Das heißt: 36+6 bedeutet 37. SSW
      const currentSSW = Math.max(1, weeksPregnant + 1);

      setCurrentWeek(currentSSW);
      setCurrentDay(daysInCurrentWeek);

      // Berechne den Fortschritt (0-1)
      setProgress(Math.min(1, Math.max(0, daysPregnant / totalDaysInPregnancy)));
    };

    // Initiale Berechnung
    calculateTimeLeft();

    // Stündliches Update
    const hourlyTimer = setInterval(calculateTimeLeft, 1000 * 60 * 60); // Update every hour

    // Tägliches Update um Mitternacht
    const setMidnightTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      return setTimeout(() => {
        calculateTimeLeft(); // Aktualisiere sofort um Mitternacht
        const dailyTimer = setInterval(calculateTimeLeft, 1000 * 60 * 60 * 24); // Dann täglich

        // Speichere den Timer, um ihn später zu löschen
        return () => clearInterval(dailyTimer);
      }, timeUntilMidnight);
    };

    const midnightTimer = setMidnightTimer();

    // AppState-Listener für Aktualisierung, wenn die App in den Vordergrund kommt
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App ist wieder im Vordergrund, Countdown aktualisieren
        calculateTimeLeft();
      }
    };

    // AppState-Listener registrieren
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(hourlyTimer);
      clearTimeout(midnightTimer);
      appStateSubscription.remove(); // AppState-Listener entfernen
    };
  }, [dueDate]);

  if (dueDate === null) {
    return (
      <ThemedView
        style={[styles.container, variant === 'embedded' && styles.embeddedContainer, styles.emptyContainer]}
        lightColor={variant === 'embedded' ? 'transparent' : theme.card}
        darkColor={variant === 'embedded' ? 'transparent' : theme.card}
      >
        <ThemedText style={styles.noDateText}>
          {t('timer.noDate')}
        </ThemedText>
      </ThemedView>
    );
  }

  const getCircleInfo = () => {
    if (isOverdue && currentWeek === 41) return t('timer.waiting');
    if (isOverdue && currentWeek && currentWeek >= 42) return t('timer.induction');
    if (currentWeek === 40) return t('timer.birthTime');
    if (isOverdue) return t('timer.ready');
    return t('hero.description');
  };

  const navigateToStats = () => {
    router.push('/pregnancy-stats');
  };

  // Keep the ring visually present while retaining a calm inset to the card.
  const size = Math.min(304, Math.max(244, width - 96));
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);
  const WARN = '#E57373';
  const bgStrokeGlass = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)';

  return (
    <ThemedView
      style={[
        styles.container,
        variant === 'embedded' && styles.embeddedContainer,
        variant === 'standalone' && isOverdue && { borderWidth: 2, borderColor: colorScheme === 'dark' ? '#E9C9B6' : '#E9C9B6' },
      ]}
      lightColor={variant === 'embedded' ? 'transparent' : theme.card}
      darkColor={variant === 'embedded' ? 'transparent' : theme.card}
    >
      <TouchableOpacity
        style={styles.countdownContainer}
        onPress={onPressRing ? onPressRing : navigateToStats}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('timer.tapHint')}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {/* Gradient für den Fortschrittsring (Liquid Glass Stil) */}
            <LinearGradient id="progressGradient" x1="0" y1="0" x2={String(size)} y2={String(size)} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={isDark ? '#C9B3E8' : '#E6D8F7'} stopOpacity={1} />
              <Stop offset="55%" stopColor={isDark ? '#A677D8' : '#B88CE8'} stopOpacity={1} />
              <Stop offset="100%" stopColor={accentColor} stopOpacity={1} />
            </LinearGradient>
            {/* Gradient für Überfälligkeit (warme Glas-Töne) */}
            <LinearGradient id="overdueGradient" x1="0" y1="0" x2={String(size)} y2={String(size)} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#FFC1B5" stopOpacity={1} />
              <Stop offset="55%" stopColor="#FF9E90" stopOpacity={1} />
              <Stop offset="100%" stopColor={WARN} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {/* Hintergrundkreis (Glass/Border Ton) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgStrokeGlass}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Fortschrittskreis (Accent) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isOverdue ? 'url(#overdueGradient)' : 'url(#progressGradient)'}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />

          {/* Glänzender Highlight-Bogen (subtiler Glas-Reflex) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.45)'}
            strokeWidth={strokeWidth * 0.55}
            strokeDasharray={`${(circumference * 0.22).toFixed(2)} ${(circumference).toFixed(2)}`}
            strokeDashoffset={(circumference * 0.15).toFixed(2)}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />

          {/* Text in der Mitte - SSW, Trimester und Infotext */}
          <G>
            <SvgText
              x={size / 2}
              y={size / 2 - 45}
              textAnchor="middle"
              fontSize="64"
              fontWeight="bold"
              fill={textPrimary}
            >
              {currentWeek}
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2}
              textAnchor="middle"
              fontSize="22"
              fill={textPrimary}
            >
              {t('timer.gestationalWeek')}
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2 + 35}
              textAnchor="middle"
              fontSize="22"
              fontWeight="bold"
              fill={isOverdue ? WARN : accentColor}
            >
              {isOverdue
                ? t('timer.overdue')
                : currentWeek && currentWeek <= 13 ? t('timer.trimesterOne') :
                  currentWeek && currentWeek <= 27 ? t('timer.trimesterTwo') :
                  currentWeek && currentWeek >= 28 ? t('timer.trimesterThree') : ''}
            </SvgText>

            <G>
              {splitTextIntoLines(getCircleInfo(), locale === 'de' ? 19 : 22)
                .slice(0, 3)
                .map((line, index) => (
                  <SvgText
                    key={index}
                    x={size / 2}
                    y={size / 2 + 70 + (index * 20)}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="500"
                    fill={textPrimary}
                  >
                    {line}
                  </SvgText>
                ))}
            </G>
          </G>
        </Svg>

        <ThemedText style={[styles.tapHint, { color: textPrimary }]}>
          {t('timer.tapHint')}
        </ThemedText>

        {/* Tage bis zur Geburt oder Tage überfällig */}
        <View style={styles.detailsContainer}>
          <View style={[styles.detailItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.42)' }]}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>{t('timer.remaining')}</ThemedText>
            <ThemedText
              style={[
                styles.detailValue,
                { color: isOverdue ? WARN : accentColor }
              ]}
            >
              {daysLeft !== null ? (
                isOverdue
                  ? getCountdownDayLabel(locale, daysLeft, true)
                  : getCountdownDayLabel(locale, daysLeft)
              ) : ''}
            </ThemedText>
          </View>

          <View style={[styles.detailItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.42)' }]}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>{t('timer.exact')}</ThemedText>
            <ThemedText style={[styles.detailValue, { color: textPrimary }]}>
              {currentWeek !== null && currentDay !== null
                ? `${t('timer.gestationalWeek')} ${currentWeek - 1}+${currentDay}`
                : ''}
            </ThemedText>
          </View>

          <View style={[styles.detailItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.42)' }]}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>{t('timer.complete')}</ThemedText>
            <ThemedText style={[styles.detailValue, { color: accentColor }]}>
              {progress ? `${Math.round(progress * 100)}%` : '0%'}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>

    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    overflow: 'hidden',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  embeddedContainer: {
    // Für Einbettung in GlassCards: keine eigene Schatten/Margins/Fläche
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  noDateText: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    padding: 20,
  },
  emptyContainer: { minHeight: 180 },
  tapHint: {
    fontSize: FONT_SM,
    opacity: 0.6,
    marginTop: 10,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: FONT_SM,
    fontWeight: '600',
    opacity: 0.65,
    marginBottom: 5,
  },
  detailValue: {
    fontSize: FONT_MD,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

export default CountdownTimer;
