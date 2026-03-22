import React, { useRef, ReactNode } from 'react';
import { Animated, TouchableOpacity, TouchableOpacityProps, GestureResponderEvent } from 'react-native';

interface AnimatedButtonProps extends TouchableOpacityProps {
  children: ReactNode;
  scaleValue?: number;
  duration?: number;
  onPress?: (event: GestureResponderEvent) => void;
}

export default function AnimatedButton({
  children,
  scaleValue = 0.95,
  duration = 120,
  onPress,
  ...props
}: AnimatedButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: scaleValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1}
      {...props}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

