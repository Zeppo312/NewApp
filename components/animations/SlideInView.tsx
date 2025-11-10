import React, { useEffect, useRef, ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

interface SlideInViewProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  easing?: 'ease' | 'spring' | 'bounce';
  visible?: boolean;
}

export default function SlideInView({
  children,
  direction = 'up',
  delay = 0,
  duration = 600,
  easing = 'ease',
  visible = true,
}: SlideInViewProps) {
  const translateValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateValue.setValue(0);
      opacityValue.setValue(0);
      return;
    }

    // Bestimme die Easing-Funktion
    let easingFunction;
    switch (easing) {
      case 'spring':
        // Verwende Spring-Animation
        setTimeout(() => {
          Animated.parallel([
            Animated.spring(translateValue, {
              toValue: 1,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
            Animated.timing(opacityValue, {
              toValue: 1,
              duration: duration * 0.6,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
          ]).start();
        }, delay);
        return;
      
      case 'bounce':
        easingFunction = Easing.bounce;
        break;
      
      case 'ease':
      default:
        easingFunction = Easing.out(Easing.ease);
        break;
    }

    // Standard Timing-Animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateValue, {
          toValue: 1,
          duration,
          useNativeDriver: true,
          easing: easingFunction,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: duration * 0.8,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    }, delay);
  }, [visible, delay, duration, easing]);

  // Bestimme die Transformations-Range basierend auf der Richtung
  const getTransform = () => {
    let translateProperty;
    let range;

    switch (direction) {
      case 'up':
        translateProperty = 'translateY';
        range = [50, 0];
        break;
      case 'down':
        translateProperty = 'translateY';
        range = [-50, 0];
        break;
      case 'left':
        translateProperty = 'translateX';
        range = [50, 0];
        break;
      case 'right':
        translateProperty = 'translateX';
        range = [-50, 0];
        break;
      default:
        translateProperty = 'translateY';
        range = [50, 0];
    }

    const translateOutput = translateValue.interpolate({
      inputRange: [0, 1],
      outputRange: range,
    });

    return {
      transform: [{ [translateProperty]: translateOutput }],
      opacity: opacityValue,
    };
  };

  if (!visible) {
    return null;
  }

  return <Animated.View style={getTransform()}>{children}</Animated.View>;
}

