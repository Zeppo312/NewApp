import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface DurationSliderProps {
  initialDuration?: number; // in minutes
  onChange: (duration: number, endTime: Date) => void;
  startTime: Date;
}

const DurationSlider: React.FC<DurationSliderProps> = ({ 
  initialDuration = 30, 
  onChange,
  startTime
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [duration, setDuration] = useState(initialDuration);

  // Calculate end time based on start time and duration
  useEffect(() => {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    onChange(duration, endTime);
  }, [duration, startTime]);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate end time for display
  const endTime = new Date(startTime.getTime() + duration * 60000);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.durationText}>
        {duration} Minuten
      </ThemedText>
      
      <View style={styles.timeDisplay}>
        <ThemedText style={styles.timeText}>
          {formatTime(startTime)} - {formatTime(endTime)}
        </ThemedText>
      </View>
      
      <Slider
        style={styles.slider}
        minimumValue={5}
        maximumValue={120}
        step={5}
        value={duration}
        onValueChange={setDuration}
        minimumTrackTintColor="#7D5A50"
        maximumTrackTintColor={colorScheme === 'dark' ? '#555555' : '#DDDDDD'}
        thumbTintColor="#7D5A50"
      />
      
      <View style={styles.labelContainer}>
        <ThemedText style={styles.labelText}>5 Min</ThemedText>
        <ThemedText style={styles.labelText}>120 Min</ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 15,
  },
  durationText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  timeDisplay: {
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  labelText: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default DurationSlider;
