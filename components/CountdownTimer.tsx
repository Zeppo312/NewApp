import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, AppState, AppStateStatus } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { babySizeComparison } from '@/constants/BabySizeComparison';
import { useColorScheme } from '@/hooks/useColorScheme';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

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
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ dueDate }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);

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

      setCurrentWeek(weeksPregnant);
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

  // Wenn das Baby bereits geboren sein sollte
  if (daysLeft !== null && daysLeft <= 0) {
    return (
      <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.congratsText}>
          Herzlichen Glückwunsch!
        </ThemedText>
        <ThemedText style={styles.babyText}>
          Dein Baby ist da oder sollte bald kommen!
        </ThemedText>
      </ThemedView>
    );
  }

  const size = Dimensions.get('window').width * 0.9; // Größerer Kreis
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <View style={styles.countdownContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Hintergrundkreis */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorScheme === 'dark' ? '#333' : '#eee'}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Fortschrittskreis */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.light.success}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />

          {/* Text in der Mitte - SSW, Trimester und Infotext */}
          <G>
            <SvgText
              x={size / 2}
              y={size / 2 - 60}
              textAnchor="middle"
              fontSize="50"
              fontWeight="bold"
              fill={colorScheme === 'dark' ? '#fff' : '#333'}
            >
              {currentWeek}
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2 - 20}
              textAnchor="middle"
              fontSize="24"
              fill={colorScheme === 'dark' ? '#fff' : '#333'}
            >
              SSW
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2 + 10}
              textAnchor="middle"
              fontSize="20"
              fontWeight="bold"
              fill={Colors.light.success}
            >
              {currentWeek && currentWeek <= 13 ? '1. Trimester' :
               currentWeek && currentWeek <= 27 ? '2. Trimester' :
               currentWeek && currentWeek >= 28 ? '3. Trimester' : ''}
            </SvgText>
            {currentWeek && currentWeek >= 4 && currentWeek <= 42 && (
              <G>
                {/* Wir teilen den Text in mehrere Zeilen auf */}
                {splitTextIntoLines(pregnancyWeekInfo[currentWeek] || "Dein Baby entwickelt sich weiter.", 20).map((line, index) => (
                  <SvgText
                    key={index}
                    x={size / 2}
                    y={size / 2 + 45 + (index * 20)}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill={colorScheme === 'dark' ? '#fff' : '#333'}
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
            )}
          </G>
        </Svg>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>Noch:</ThemedText>
          <ThemedText style={styles.infoValue}>
            {daysLeft === 1 ? '1 Tag' : `${daysLeft} Tage`}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>Genau:</ThemedText>
          <ThemedText style={styles.infoValue}>
            SSW {currentWeek}+{currentDay}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>Geschafft:</ThemedText>
          <ThemedText style={[styles.infoValue, styles.percentValue]}>
            {Math.round(progress * 100)}%
          </ThemedText>
        </View>
      </View>

      {/* Informationstext wird jetzt im Kreis angezeigt */}

      {currentWeek && currentWeek >= 4 && currentWeek <= 42 && (
        <ThemedView style={styles.babySizeContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <ThemedText style={styles.babySizeTitle}>
            Heute ist dein Baby so groß wie ein:
          </ThemedText>
          <ThemedText style={styles.babySizeText}>
            {babySizeComparison[currentWeek] || "Wächst und gedeiht 🌱"}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.timelineContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <View style={styles.timeline}>
          <View style={[styles.timelineProgress, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
        </View>
        <View style={styles.timelineLabels}>
          <ThemedText style={styles.timelineLabel}>SSW 0</ThemedText>
          <ThemedText style={styles.timelineLabel}>SSW 20</ThemedText>
          <ThemedText style={styles.timelineLabel}>SSW 40</ThemedText>
        </View>
      </ThemedView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  infoContainer: {
    marginTop: 15,
    marginBottom: 15,
    width: '100%',
    paddingHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  percentValue: {
    color: Colors.light.success,
    fontSize: 20,
  },
  noDateText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  congratsText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  babyText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 10,
  },
  weekInfoContainer: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  weekInfoText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  babySizeContainer: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  babySizeTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  babySizeText: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
  },
  timelineContainer: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  timeline: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  timelineProgress: {
    height: '100%',
    borderRadius: 5,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  timelineLabel: {
    fontSize: 12,
  },
});

export default CountdownTimer;
