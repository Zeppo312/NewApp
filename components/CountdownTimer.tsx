import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { babySizeComparison } from '@/constants/BabySizeComparison';
import { useColorScheme } from '@/hooks/useColorScheme';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

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
      const now = new Date();
      const difference = dueDate.getTime() - now.getTime();

      // Berechne die Tage bis zum Geburtstermin
      const days = Math.ceil(difference / (1000 * 60 * 60 * 24));
      setDaysLeft(days);

      // Berechne die aktuelle SSW
      // Schwangerschaft dauert ca. 40 Wochen
      const totalDaysInPregnancy = 280; // 40 Wochen * 7 Tage
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

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(timer);
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

  const size = Dimensions.get('window').width * 0.8;
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
            stroke={theme.accent}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />

          {/* Text in der Mitte */}
          <G>
            <SvgText
              x={size / 2}
              y={size / 2 - 20}
              textAnchor="middle"
              fontSize="40"
              fontWeight="bold"
              fill={colorScheme === 'dark' ? '#fff' : '#333'}
            >
              {daysLeft}
            </SvgText>
            <SvgText
              x={size / 2}
              y={size / 2 + 20}
              textAnchor="middle"
              fontSize="20"
              fill={colorScheme === 'dark' ? '#fff' : '#333'}
            >
              Tage
            </SvgText>
          </G>
        </Svg>
      </View>

      <ThemedText style={styles.countdownText}>
        {daysLeft === 1 ? 'Noch 1 Tag' : `Noch ${daysLeft} Tage`} bis zur Geburt
      </ThemedText>

      <ThemedText style={styles.weekText}>
        SSW {currentWeek}+{currentDay}
      </ThemedText>

      {currentWeek && currentWeek >= 4 && currentWeek <= 42 && (
        <ThemedView style={styles.weekInfoContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <ThemedText style={styles.weekInfoText}>
            {pregnancyWeekInfo[currentWeek] || "Dein Baby entwickelt sich weiter."}
          </ThemedText>
        </ThemedView>
      )}

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
  countdownText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  weekText: {
    fontSize: 18,
    marginTop: 5,
    marginBottom: 15,
    textAlign: 'center',
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
