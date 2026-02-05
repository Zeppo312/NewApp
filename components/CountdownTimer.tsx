import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, AppState, AppStateStatus, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { pregnancyWeekInfo, pregnancyWeekCircleInfo } from '@/constants/PregnancyWeekInfo';
import { babySizeComparison } from '@/constants/BabySizeComparison';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { router } from 'expo-router';
import Svg, { Circle, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PRIMARY, TEXT_PRIMARY, GLASS_BORDER, FONT_SM, FONT_MD, FONT_LG, RADIUS } from '@/constants/DesignGuide';

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

// Überfälligkeits-Info, die angezeigt wird, wenn das Baby überfällig ist
const overdueInfo = {
  week40: "Geburtszeit! Dein Baby macht sich auf den Weg in die Welt.",
  week41: "Dein Baby wartet auf den richtigen Zeitpunkt.",
  week42: "Besprich mit deinem Arzt eine mögliche Geburtseinleitung.",
  default: "Dein Baby ist bereit für die Geburt."
};

interface CountdownTimerProps {
  dueDate: Date | null;
  // Darstellung: 'standalone' hat eigenen Card-Look, 'embedded' ist für GlassCards
  variant?: 'standalone' | 'embedded';
  // Optional: Babygrößen-Block unterhalb ein-/ausblenden
  showBabySize?: boolean;
  // Optional: eigener Handler beim Tippen auf den Kreis
  onPressRing?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  dueDate,
  variant = 'standalone',
  showBabySize = true,
  onPressRing,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY;
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

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

      // Berechne die Tage der Schwangerschaft
      // Wir verwenden Math.max, um negative Werte zu vermeiden (falls das Datum in der Vergangenheit liegt)
      const daysRemaining = Math.max(0, days);
      const daysPregnant = totalDaysInPregnancy - daysRemaining;

      // Berechne SSW und Tag
      const weeksPregnant = Math.floor(daysPregnant / 7);
      const daysInCurrentWeek = daysPregnant % 7;
      
      // In der SSW-Zählung ist man bereits in der nächsten Woche, selbst bei 0 Tagen
      // Das heißt: 36+6 bedeutet 37. SSW
      const currentSSW = weeksPregnant + 1;

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
      <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.noDateText}>
          Bitte setze deinen Geburtstermin in den Einstellungen.
        </ThemedText>
      </ThemedView>
    );
  }

  // Überfälligkeits-Info auswählen basierend auf der SSW
  const getOverdueInfo = () => {
    if (!currentWeek) return overdueInfo.default;
    
    if (currentWeek === 40) return overdueInfo.week40;
    if (currentWeek === 41) return overdueInfo.week41;
    if (currentWeek >= 42) return overdueInfo.week42;
    
    return overdueInfo.default;
  };

  const navigateToStats = () => {
    router.push('/pregnancy-stats');
  };

  const navigateToBabySize = () => {
    router.push('/baby-size');
  };

  // Erhöhe die Größe des Kreises etwas
  const size = Dimensions.get('window').width * 0.75; // Größerer Kreis (Design ähnlich Sleep-Tracker)
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);
  const WARN = '#E57373';
  const bgStroke = isDark ? 'rgba(255,255,255,0.22)' : GLASS_BORDER;
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
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {/* Gradient für den Fortschrittsring (Liquid Glass Stil) */}
            <LinearGradient id="progressGradient" x1="0" y1="0" x2={String(size)} y2={String(size)} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={isDark ? '#C9B3E8' : '#E6D8F7'} stopOpacity={1} />
              <Stop offset="55%" stopColor={isDark ? '#A677D8' : '#B88CE8'} stopOpacity={1} />
              <Stop offset="100%" stopColor={PRIMARY} stopOpacity={1} />
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
              SSW
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2 + 35}
              textAnchor="middle"
              fontSize="22"
              fontWeight="bold"
              fill={isOverdue ? WARN : PRIMARY}
            >
              {isOverdue 
                ? 'Überfällig' 
                : currentWeek && currentWeek <= 13 ? '1. Trimester' :
                  currentWeek && currentWeek <= 27 ? '2. Trimester' :
                  currentWeek && currentWeek >= 28 ? '3. Trimester' : ''}
            </SvgText>
            
            {/* SSW-Info mit Text genau wie im Screenshot */}
            <G>
              {/* Für SSW 40 nutzen wir den festen Text aus dem Screenshot */}
              {currentWeek === 40 ? (
                <>
                  <SvgText
                    x={size / 2}
                    y={size / 2 + 70}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="500"
                    fill={textPrimary}
                  >
                    Geburtszeit! Dein
                  </SvgText>
                  <SvgText
                    x={size / 2}
                    y={size / 2 + 90}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="500"
                    fill={textPrimary}
                  >
                    Baby macht sich auf
                  </SvgText>
                  <SvgText
                    x={size / 2}
                    y={size / 2 + 110}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="500"
                    fill={textPrimary}
                  >
                    den Weg in die Welt.
                  </SvgText>
                </>
              ) : (
                /* Für andere SSW normal berechnen */
                splitTextIntoLines(
                  isOverdue
                    ? getOverdueInfo()
                    : (currentWeek && currentWeek >= 4 && currentWeek <= 42) 
                      ? pregnancyWeekCircleInfo[currentWeek] || ""
                      : "",
                  15 // Kürzere Zeilenlänge für bessere Anpassung (von 16 auf 14 geändert)
                ).slice(0, 3)
                  .map((line, index) => (
                    <SvgText
                      key={index}
                      x={size / 2}
                      y={size / 2 + 70 + (index * 20)}
                      textAnchor="middle"
                      fontSize="15"
                      fontWeight="500"
                      fill={textPrimary}
                    >
                      {line}
                    </SvgText>
                  ))
              )}
            </G>
          </G>
        </Svg>

        <ThemedText style={[styles.tapHint, { color: textPrimary }]}>
          Tippen für Details
        </ThemedText>

        {/* Tage bis zur Geburt oder Tage überfällig */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>Noch:</ThemedText>
            <ThemedText 
              style={[
                styles.detailValue,
                { color: isOverdue ? WARN : PRIMARY }
              ]}
            >
              {daysLeft !== null ? (
                isOverdue
                  ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'Tag' : 'Tage'} überfällig`
                  : `${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`
              ) : ''}
            </ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>Genau:</ThemedText>
            <ThemedText style={[styles.detailValue, { color: textPrimary }]}>
              {currentWeek !== null && currentDay !== null ? 
                `SSW ${currentWeek-1}+${currentDay}` : ''}
            </ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: textPrimary }]}>Geschafft:</ThemedText>
            <ThemedText style={[styles.detailValue, { color: PRIMARY }]}>
              {progress ? `${Math.round(progress * 100)}%` : '0%'}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>

      {/* Container für die Babygröße */}
      {showBabySize && currentWeek && currentWeek >= 4 && (
        <TouchableOpacity
          style={styles.babySizeContainer}
          onPress={navigateToBabySize}
          activeOpacity={0.8}
        >
          <ThemedView style={styles.babySizeInnerContainer} lightColor={'transparent'} darkColor={'transparent'}>
            <ThemedText style={[styles.babySizeLabel, { color: textPrimary }]}>Babygröße:</ThemedText>
            <ThemedText style={[styles.babySizeValue, { color: PRIMARY }]}>
              {babySizeComparison[currentWeek] || "Noch nicht berechenbar"}
            </ThemedText>
            <ThemedText style={styles.babySizeTapHint}>Tippen für mehr Details</ThemedText>
          </ThemedView>
        </TouchableOpacity>
      )}
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
    textAlign: 'center',
    padding: 20,
  },
  tapHint: {
    fontSize: FONT_SM,
    opacity: 0.6,
    marginTop: 10,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: FONT_LG,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: FONT_LG,
    fontWeight: 'bold',
  },
  babySizeContainer: {
    marginTop: 15,
    width: '100%',
  },
  babySizeInnerContainer: {
    padding: 12,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  babySizeLabel: {
    fontSize: FONT_MD,
    fontWeight: '600',
    marginBottom: 8,
  },
  babySizeValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  babySizeTapHint: {
    fontSize: FONT_SM,
    opacity: 0.6,
    fontStyle: 'italic',
  },
});

export default CountdownTimer;
