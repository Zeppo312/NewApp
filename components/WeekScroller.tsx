import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getDailyEntriesForDateRange, calculateDailyStats, DailyEntry } from '@/lib/baby';

interface WeekScrollerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const WeekScroller: React.FC<WeekScrollerProps> = ({ selectedDate, onDateSelect }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const todayBorderColor = isDark ? Colors.dark.accent : '#7D5A50';
  const todayBgColor = isDark ? Colors.dark.accent : '#7D5A50';
  const [weeks, setWeeks] = useState<Date[][]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const weekListRef = useRef<FlatList>(null);
  const dayListRef = useRef<FlatList>(null);
  const screenWidth = Dimensions.get('window').width;

  // Generiere Wochen für die letzten 4 Wochen und die nächsten 4 Wochen
  useEffect(() => {
    const today = new Date();
    const weeksArray: Date[][] = [];

    // Generiere 4 Wochen in der Vergangenheit
    for (let i = -4; i <= 4; i++) {
      const weekDays = getWeekDays(addWeeks(today, i));
      weeksArray.push(weekDays);
    }

    setWeeks(weeksArray);

    // Finde den Index der aktuellen Woche
    const currentWeekIndex = weeksArray.findIndex(week =>
      week.some(day => isSameDay(day, today))
    );

    if (currentWeekIndex !== -1) {
      setCurrentWeekIndex(currentWeekIndex);
    }
  }, []);

  // Lade Einträge für die aktuelle Woche
  useEffect(() => {
    if (weeks.length > 0 && currentWeekIndex >= 0 && currentWeekIndex < weeks.length) {
      const currentWeek = weeks[currentWeekIndex];
      loadWeekEntries(currentWeek[0], currentWeek[6]);
    }
  }, [weeks, currentWeekIndex]);

  // Scrolle zur ausgewählten Position
  useEffect(() => {
    if (weeks.length > 0 && dayListRef.current) {
      const currentWeek = weeks[currentWeekIndex];
      const selectedIndex = currentWeek.findIndex(day =>
        isSameDay(day, selectedDate)
      );

      if (selectedIndex !== -1) {
        setTimeout(() => {
          dayListRef.current?.scrollToIndex({
            index: selectedIndex,
            animated: true,
            viewPosition: 0.5
          });
        }, 100);
      }
    }
  }, [weeks, currentWeekIndex, selectedDate]);

  // Hilfsfunktion: Füge Wochen hinzu
  const addWeeks = (date: Date, weeks: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
  };

  // Hilfsfunktion: Prüfe, ob zwei Daten am gleichen Tag sind
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Berechne die Tage der Woche (Montag bis Sonntag)
  const getWeekDays = (date: Date): Date[] => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Anpassung für Montag als ersten Tag

    const monday = new Date(date);
    monday.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push(nextDay);
    }

    return days;
  };

  // Lade Einträge für die Woche
  const loadWeekEntries = async (startDate: Date, endDate: Date) => {
    try {
      setIsLoading(true);
      const { data, error } = await getDailyEntriesForDateRange(startDate, endDate);

      if (error) {
        console.error('Error loading week entries:', error);
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load week entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Berechne Statistiken für jeden Tag
  const stats = calculateDailyStats(entries);

  // Formatiere Monat und Jahr für den Header
  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  // Wechsle zur vorherigen Woche
  const goToPreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
      weekListRef.current?.scrollToIndex({
        index: currentWeekIndex - 1,
        animated: true
      });
    }
  };

  // Wechsle zur nächsten Woche
  const goToNextWeek = () => {
    if (currentWeekIndex < weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
      weekListRef.current?.scrollToIndex({
        index: currentWeekIndex + 1,
        animated: true
      });
    }
  };

  // Rendere einen Tag
  const renderDay = ({ item, index }: { item: Date; index: number }) => {
    const isToday = isSameDay(item, new Date());
    const isSelected = isSameDay(item, selectedDate);
    const dateStr = item.toISOString().split('T')[0];
    const dayStats = stats[dateStr] || {
      feeding: 0,
      diaper: 0,
      sleep: 0,
      other: 0,
      sleepDuration: 0
    };

    // Formatiere Schlafdauer
    const formatSleepDuration = (minutes: number) => {
      if (minutes === 0) return '';
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return (
      <TouchableOpacity
        style={[
          styles.dayItem,
          isSelected && styles.selectedDayItem
        ]}
        onPress={() => onDateSelect(item)}
      >
        <ThemedView
          style={[
            styles.dayCard,
            isToday && [styles.todayCard, { borderColor: todayBorderColor }],
            isSelected && styles.selectedDayCard
          ]}
          lightColor={isSelected ? theme.accent : theme.cardLight}
          darkColor={isSelected ? theme.accent : theme.cardDark}
        >
          <ThemedText
            style={[styles.dayName, isSelected && styles.selectedText]}
            lightColor={isSelected ? '#FFFFFF' : theme.text}
            darkColor={isSelected ? '#FFFFFF' : theme.text}
          >
            {item.toLocaleDateString('de-DE', { weekday: 'short' })}
          </ThemedText>

          <ThemedView
            style={[
              styles.dayNumberContainer,
              isToday && [styles.todayNumberContainer, { backgroundColor: todayBgColor }],
              isSelected && styles.selectedNumberContainer
            ]}
            lightColor={isToday ? theme.accent : 'transparent'}
            darkColor={isToday ? theme.accent : 'transparent'}
          >
            <ThemedText
              style={[
                styles.dayNumber,
                isToday && styles.todayNumber,
                isSelected && styles.selectedText
              ]}
              lightColor={(isToday && !isSelected) ? '#FFFFFF' : (isSelected ? '#FFFFFF' : theme.text)}
              darkColor={(isToday && !isSelected) ? '#FFFFFF' : (isSelected ? '#FFFFFF' : theme.text)}
            >
              {item.getDate()}
            </ThemedText>
          </ThemedView>

          <View style={styles.statsContainer}>
            {dayStats.feeding > 0 && (
              <View style={styles.statItem}>
                <IconSymbol name="drop.fill" size={12} color={isSelected ? '#FFFFFF' : "#FF9800"} />
                <ThemedText
                  style={[styles.statText, isSelected && styles.selectedText]}
                  lightColor={isSelected ? '#FFFFFF' : theme.text}
                  darkColor={isSelected ? '#FFFFFF' : theme.text}
                >
                  {dayStats.feeding}
                </ThemedText>
              </View>
            )}

            {dayStats.diaper > 0 && (
              <View style={styles.statItem}>
                <IconSymbol name="heart.fill" size={12} color={isSelected ? '#FFFFFF' : "#4CAF50"} />
                <ThemedText
                  style={[styles.statText, isSelected && styles.selectedText]}
                  lightColor={isSelected ? '#FFFFFF' : theme.text}
                  darkColor={isSelected ? '#FFFFFF' : theme.text}
                >
                  {dayStats.diaper}
                </ThemedText>
              </View>
            )}

            {dayStats.sleep > 0 && (
              <View style={styles.statItem}>
                <IconSymbol name="moon.fill" size={12} color={isSelected ? '#FFFFFF' : "#5C6BC0"} />
                <ThemedText
                  style={[styles.statText, isSelected && styles.selectedText]}
                  lightColor={isSelected ? '#FFFFFF' : theme.text}
                  darkColor={isSelected ? '#FFFFFF' : theme.text}
                >
                  {formatSleepDuration(dayStats.sleepDuration)}
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  // Handle für Fehler beim Scrollen zum Index
  const handleScrollToIndexFailed = (info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      dayListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0.5
      });
    });
  };

  // Rendere die aktuelle Woche
  const renderCurrentWeek = () => {
    if (weeks.length === 0 || currentWeekIndex < 0 || currentWeekIndex >= weeks.length) {
      return null;
    }

    const currentWeek = weeks[currentWeekIndex];
    const monthYear = formatMonthYear(currentWeek[3]); // Mittlerer Tag der Woche

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={goToPreviousWeek}
          >
            <IconSymbol name="chevron.left" size={20} color={theme.text} />
          </TouchableOpacity>

          <ThemedText style={styles.monthYearText}>
            {monthYear}
          </ThemedText>

          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={goToNextWeek}
          >
            <IconSymbol name="chevron.right" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={dayListRef}
          data={currentWeek}
          renderItem={renderDay}
          keyExtractor={(item) => item.toISOString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysContainer}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          snapToInterval={screenWidth / 5}
          decelerationRate="fast"
          snapToAlignment="center"
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderCurrentWeek()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  weekContainer: {
    marginBottom: 10,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125, 90, 80, 0.1)',
  },
  weekNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  daysContainer: {
    paddingHorizontal: 10,
    paddingBottom: 15,
  },
  dayItem: {
    width: 80,
    marginHorizontal: 5,
  },
  selectedDayItem: {
    transform: [{ scale: 1.05 }],
  },
  dayCard: {
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.1)',
  },
  todayCard: {
    borderWidth: 2,
    // borderColor wird dynamisch gesetzt
  },
  selectedDayCard: {
    borderWidth: 0,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  dayNumberContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayNumberContainer: {
    // backgroundColor wird dynamisch gesetzt
  },
  selectedNumberContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  todayNumber: {
    color: '#FFFFFF',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'center',
  },
  statText: {
    fontSize: 12,
    marginLeft: 4,
  },
});

export default WeekScroller;
