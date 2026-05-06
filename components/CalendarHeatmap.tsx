import React from 'react';
import { View, Text, Dimensions, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Colors, QualityColors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type SleepQuality = 'good' | 'medium' | 'bad' | null;

interface SleepSession {
  id: string;
  startTime: string;
  endTime: string;
  duration: string;
  durationMinutes: number;
  quality: SleepQuality;
  notes: string;
  rawStartTime: Date;
  rawEndTime: Date;
}

interface Props {
  groupedEntries: Record<string, SleepSession[]>;
}

// Funktion zur Bestimmung der Farbe basierend auf der Schlafqualität
const getQualityColor = (quality: SleepQuality) => {
  switch (quality) {
    case 'good':
      return QualityColors.good;
    case 'medium':
      return QualityColors.medium;
    case 'bad':
      return QualityColors.bad;
    case null:
    default:
      return QualityColors.unknown;
  }
};

// Funktion zur Berechnung der dominierenden Schlafqualität für einen Tag
const calculateDominantQuality = (date: string, groupedEntries: Record<string, SleepSession[]>): SleepQuality => {
  // Überprüfe, ob es Einträge für diesen Tag gibt
  if (!groupedEntries[date] || groupedEntries[date].length === 0) {
    return null;
  }

  // Berechne die Gesamtdauer jeder Qualität
  const durationByQuality: Record<string, number> = {
    'good': 0,
    'medium': 0,
    'bad': 0
  };

  // Summe der Dauer für jede Qualität
  groupedEntries[date].forEach(entry => {
    if (entry.quality !== null) {
      durationByQuality[entry.quality] += entry.durationMinutes;
    }
  });

  // Finde die Qualität mit der längsten Dauer
  let dominantQuality: SleepQuality = 'good';
  let maxDuration = 0;

  (Object.keys(durationByQuality) as Array<'good' | 'medium' | 'bad' | 'null'>).forEach(quality => {
    if (quality !== 'null' && durationByQuality[quality] > maxDuration) {
      maxDuration = durationByQuality[quality];
      dominantQuality = quality as SleepQuality;
    }
  });

  return dominantQuality;
};

export default function CalendarHeatmap({ groupedEntries }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : '#7D5A50';
  const borderColor = isDark ? Colors.dark.border : '#7D5A50';

  // State für den angezeigten Monat
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const monthName = format(currentDate, 'MMMM yyyy', { locale: de });
  
  // Navigation zum vorherigen Monat
  const goToPreviousMonth = () => {
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentDate(prevMonth);
  };
  
  // Navigation zum nächsten Monat
  const goToNextMonth = () => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentDate(nextMonth);
  };
  
  // Erste Tag des Monats und letzter Tag bestimmen
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Berechne Offset für ersten Tag des Monats (0 = Sonntag, 1 = Montag, ...)
  let offset = firstDayOfMonth.getDay() - 1; // -1 weil wir mit Montag beginnen
  if (offset < 0) offset = 6; // Wenn Sonntag (0), dann offset = 6
  
  return (
    <View style={{ 
      marginVertical: 10, 
      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
      padding: 10, 
      borderRadius: 10 
    }}>
      {/* Monatsnavigation mit Pfeiltasten */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 8 
      }}>
        <TouchableOpacity
          onPress={goToPreviousMonth}
          style={{
            padding: 8,
            borderRadius: 15,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(125, 90, 80, 0.1)'
          }}
        >
          <Text style={{ color: textColor, fontWeight: 'bold' }}>◀</Text>
        </TouchableOpacity>

        <Text style={{
          fontWeight: 'bold',
          textAlign: 'center',
          color: textColor,
          fontSize: 16
        }}>
          {monthName}
        </Text>

        <TouchableOpacity
          onPress={goToNextMonth}
          style={{
            padding: 8,
            borderRadius: 15,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(125, 90, 80, 0.1)'
          }}
        >
          <Text style={{ color: textColor, fontWeight: 'bold' }}>▶</Text>
        </TouchableOpacity>
      </View>
      
      {/* Wochentage-Kopfzeile */}
      <View style={{ flexDirection: 'row' }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
          <View key={day} style={{width: '14.28%', alignItems: 'center', padding: 5}}>
            <Text style={{fontWeight: 'bold', color: textColor}}>{day}</Text>
          </View>
        ))}
      </View>
      
      {/* Kalender-Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {/* Leere Zellen für Offset */}
        {Array.from({ length: offset }, (_, i) => (
          <View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />
        ))}
        
        {/* Tage des Monats */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const dateString = format(date, 'yyyy-MM-dd');
          
          // Bestimme Qualität entweder aus echten Daten oder als Demo
          let quality: SleepQuality = null;
          
          if (Object.keys(groupedEntries).length > 0) {
            // Verwende echte Daten, wenn vorhanden
            quality = calculateDominantQuality(dateString, groupedEntries);
          } else {
            // Demo-Daten als Fallback
            quality = day % 3 === 0 ? 'good' : day % 3 === 1 ? 'medium' : 'bad';
          }
          
          const today = new Date();
          const isCurrentDay = day === currentDate.getDate() && 
                             currentDate.getMonth() === today.getMonth() && 
                             currentDate.getFullYear() === today.getFullYear();
          
          return (
            <View
              key={`day-${day}`}
              style={{
                width: '14.28%',
                aspectRatio: 1,
                margin: 0,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: isCurrentDay ? 1 : 0,
                borderColor: borderColor,
                borderRadius: 20
              }}
            >
              <Text style={{
                fontSize: 12,
                color: textColor,
                fontWeight: isCurrentDay ? 'bold' : 'normal'
              }}>
                {day}
              </Text>
              <View style={{
                width: '70%',
                height: 8,
                backgroundColor: getQualityColor(quality),
                marginTop: 4,
                borderRadius: 4
              }} />
            </View>
          );
        })}
      </View>
      
      {/* Legende */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, backgroundColor: getQualityColor('good'), marginRight: 5 }} />
          <Text style={{ color: textColor }}>Gut</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, backgroundColor: getQualityColor('medium'), marginRight: 5 }} />
          <Text style={{ color: textColor }}>Mittel</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, backgroundColor: getQualityColor('bad'), marginRight: 5 }} />
          <Text style={{ color: textColor }}>Schlecht</Text>
        </View>
      </View>
    </View>
  );
}
