import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import Svg, { Circle, Path } from 'react-native-svg';

interface ProgressCircleProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
  textColor?: string;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  progress,
  size = 40,
  strokeWidth = 4,
  backgroundColor = '#F2E6DD',
  progressColor = '#E9C9B6',
  textColor = '#5C4033',
}) => {
  // Ensure progress is between 0 and 100
  const validProgress = Math.min(100, Math.max(0, progress));
  
  // Calculate radius (half of size minus stroke width)
  const radius = (size - strokeWidth) / 2;
  
  // Calculate center point
  const center = size / 2;
  
  // Calculate circumference
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash offset based on progress
  const strokeDashoffset = circumference - (validProgress / 100) * circumference;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>
      
      {/* Percentage Text */}
      <View style={[styles.textContainer, { width: size, height: size }]}>
        <ThemedText style={[styles.progressText, { color: textColor, fontSize: size * 0.3 }]}>
          {Math.round(validProgress)}%
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
