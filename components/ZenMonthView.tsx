import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getDailyEntriesForDateRange, calculateDailyStats, DailyEntry } from '@/lib/baby';

interface ZenMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const ZenMonthView: React.FC<ZenMonthViewProps> = ({ selectedDate, onDateSelect }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const selectedBgColor = isDark ? Colors.dark.accent : '#7D5A50';
  const containerBgColor = isDark ? Colors.dark.cardLight : 'rgba(255, 255, 255, 0.95)';
  const [isExpanded, setIsExpanded] = useState(true); // Standardmäßig aufgeklappt
  const [monthDays, setMonthDays] = useState<(Date | null)[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Initialisiere den Drawer mit der expandierten Höhe
  const [drawerHeight] = useState(new Animated.Value(Dimensions.get('window').height * 0.7));
  const screenHeight = Dimensions.get('window').height;
  const collapsedHeight = 60;
  const expandedHeight = screenHeight * 0.7;

  // Berechne die Tage des aktuellen Monats
  useEffect(() => {
    const days = getMonthDays(selectedDate);
    setMonthDays(days);

    // Berechne Start- und Enddatum für die Abfrage
    const firstDay = days.find(day => day !== null) as Date;
    const lastDay = [...days].reverse().find(day => day !== null) as Date;

    // Lade Einträge für den Monat
    loadMonthEntries(firstDay, lastDay);
  }, [selectedDate]);

  // Animiere Drawer-Höhe
  useEffect(() => {
    Animated.timing(drawerHeight, {
      toValue: isExpanded ? expandedHeight : collapsedHeight,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, drawerHeight, expandedHeight]);

  // Berechne die Tage des Monats (mit Padding für vollständige Wochen)
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    // Erster Tag des Monats
    const firstDay = new Date(year, month, 1);
    // Letzter Tag des Monats
    const lastDay = new Date(year, month + 1, 0);

    // Wochentag des ersten Tags (0 = Sonntag, 1 = Montag, ...)
    let firstDayOfWeek = firstDay.getDay();
    // Anpassen für Montag als ersten Tag der Woche
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Array für alle Tage des Monats (mit Padding)
    const days: (Date | null)[] = [];

    // Füge Padding für Tage vor dem ersten Tag des Monats hinzu
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(year, month, -firstDayOfWeek + i + 1);
      days.push(prevDate);
    }

    // Füge alle Tage des Monats hinzu
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Berechne, wie viele Tage wir für eine vollständige 6x7 Grid benötigen
    const totalDays = 42; // 6 Wochen x 7 Tage
    const remainingDays = totalDays - days.length;

    // Füge Padding für Tage nach dem letzten Tag des Monats hinzu
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push(nextDate);
    }

    return days;
  };

  // Lade Einträge für den Monat
  const loadMonthEntries = async (startDate: Date, endDate: Date) => {
    try {
      setIsLoading(true);
      const { data, error } = await getDailyEntriesForDateRange(startDate, endDate);

      if (error) {
        console.error('Error loading month entries:', error);
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load month entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Berechne Statistiken für jeden Tag
  const stats = calculateDailyStats(entries);

  // Wechsle zum vorherigen Monat
  const goToPreviousMonth = () => {
    const prevMonth = new Date(selectedDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    onDateSelect(prevMonth);
  };

  // Wechsle zum nächsten Monat
  const goToNextMonth = () => {
    const nextMonth = new Date(selectedDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    onDateSelect(nextMonth);
  };

  // Formatiere Monat und Jahr
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  // Prüfe, ob ein Datum heute ist
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Prüfe, ob ein Datum ausgewählt ist
  const isSelectedDate = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Prüfe, ob ein Datum im aktuellen Monat ist
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === selectedDate.getMonth();
  };

  // Rendere einen Tag im Kalender
  const renderDay = (date: Date | null, index: number) => {
    if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;

    const dateStr = date.toISOString().split('T')[0];
    const dayStats = stats[dateStr] || {
      feeding: 0,
      diaper: 0,
      sleep: 0,
      other: 0,
      sleepDuration: 0
    };

    const hasActivity = dayStats.feeding > 0 || dayStats.diaper > 0 || dayStats.sleep > 0 || dayStats.other > 0;
    const _isToday = isToday(date);
    const _isSelected = isSelectedDate(date);
    const _isCurrentMonth = isCurrentMonth(date);

    return (
      <TouchableOpacity
        key={dateStr}
        style={[
          styles.dayCell,
          !_isCurrentMonth && styles.otherMonthCell,
          _isToday && [styles.todayCell, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.1)' }],
          _isSelected && [styles.selectedCell, { backgroundColor: selectedBgColor }],
        ]}
        onPress={() => onDateSelect(date)}
      >
        <ThemedText
          style={[
            styles.dayText,
            !_isCurrentMonth && styles.otherMonthText,
            _isSelected && styles.selectedText,
          ]}
          lightColor={_isSelected ? '#FFFFFF' : theme.text}
          darkColor={_isSelected ? '#FFFFFF' : theme.text}
        >
          {date.getDate()}
        </ThemedText>

        {hasActivity && (
          <View style={styles.activityIndicators}>
            {dayStats.feeding > 0 && (
              <View style={[styles.activityDot, { backgroundColor: '#FF9800' }]} />
            )}
            {dayStats.diaper > 0 && (
              <View style={[styles.activityDot, { backgroundColor: '#4CAF50' }]} />
            )}
            {dayStats.sleep > 0 && (
              <View style={[styles.activityDot, { backgroundColor: '#5C6BC0' }]} />
            )}
            {dayStats.other > 0 && (
              <View style={[styles.activityDot, { backgroundColor: '#9C27B0' }]} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Wochentage-Header
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <Animated.View style={[styles.container, { height: drawerHeight, backgroundColor: containerBgColor }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <ThemedText style={styles.monthYearText}>
            {formatMonthYear(selectedDate)}
          </ThemedText>

          <IconSymbol
            name={isExpanded ? "chevron.down" : "chevron.up"}
            size={20}
            color={theme.text}
          />
        </View>

        <View style={styles.handleBar} />
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView style={styles.content}>
          <View style={styles.monthNavigation}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={goToPreviousMonth}
            >
              <IconSymbol name="chevron.left" size={20} color={theme.text} />
            </TouchableOpacity>

            <ThemedText style={styles.monthYearTextLarge}>
              {formatMonthYear(selectedDate)}
            </ThemedText>

            <TouchableOpacity
              style={styles.navButton}
              onPress={goToNextMonth}
            >
              <IconSymbol name="chevron.right" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendar}>
            <View style={styles.weekdaysRow}>
              {weekdays.map((day, index) => (
                <View key={index} style={styles.weekdayCell}>
                  <ThemedText style={styles.weekdayText}>{day}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {monthDays.map((date, index) => renderDay(date, index))}
            </View>
          </View>

          <View style={styles.legend}>
            <ThemedText style={styles.legendTitle}>Legende:</ThemedText>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                <ThemedText style={styles.legendText}>Füttern</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <ThemedText style={styles.legendText}>Wickeln</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#5C6BC0' }]} />
                <ThemedText style={styles.legendText}>Schlafen</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
                <ThemedText style={styles.legendText}>Sonstiges</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.summary}>
            <ThemedText style={styles.summaryTitle}>
              Zusammenfassung für {formatMonthYear(selectedDate)}:
            </ThemedText>

            <View style={styles.summaryStats}>
              {Object.values(stats).reduce((total, day) => total + day.feeding, 0) > 0 && (
                <View style={styles.summaryStat}>
                  <IconSymbol name="drop.fill" size={16} color="#FF9800" />
                  <ThemedText style={styles.summaryText}>
                    {Object.values(stats).reduce((total, day) => total + day.feeding, 0)}x Füttern
                  </ThemedText>
                </View>
              )}

              {Object.values(stats).reduce((total, day) => total + day.diaper, 0) > 0 && (
                <View style={styles.summaryStat}>
                  <IconSymbol name="heart.fill" size={16} color="#4CAF50" />
                  <ThemedText style={styles.summaryText}>
                    {Object.values(stats).reduce((total, day) => total + day.diaper, 0)}x Wickeln
                  </ThemedText>
                </View>
              )}

              {Object.values(stats).reduce((total, day) => total + day.sleep, 0) > 0 && (
                <View style={styles.summaryStat}>
                  <IconSymbol name="moon.fill" size={16} color="#5C6BC0" />
                  <ThemedText style={styles.summaryText}>
                    {Object.values(stats).reduce((total, day) => total + day.sleep, 0)}x Schlafen
                  </ThemedText>
                </View>
              )}

              {Object.values(stats).reduce((total, day) => total + day.other, 0) > 0 && (
                <View style={styles.summaryStat}>
                  <IconSymbol name="star.fill" size={16} color="#9C27B0" />
                  <ThemedText style={styles.summaryText}>
                    {Object.values(stats).reduce((total, day) => total + day.other, 0)}x Sonstiges
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    overflow: 'hidden',
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  navButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  monthYearTextLarge: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendar: {
    marginBottom: 20,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  otherMonthCell: {
    opacity: 0.4,
  },
  todayCell: {
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    borderRadius: 5,
  },
  selectedCell: {
    // backgroundColor wird dynamisch gesetzt
    borderRadius: 5,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  otherMonthText: {
    opacity: 0.6,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  activityIndicators: {
    flexDirection: 'row',
    marginTop: 4,
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  legend: {
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
  },
  summary: {
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  summaryText: {
    fontSize: 14,
    marginLeft: 5,
  },
});

export default ZenMonthView;
