import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

type ActivityType = 'feeding' | 'diaper' | 'other';

interface ActivitySelectorProps {
  visible: boolean;
  onSelect: (type: ActivityType) => void;
}

const ActivitySelector: React.FC<ActivitySelectorProps> = ({ visible, onSelect }) => {
  // Animation values for each button
  const animations = {
    feeding: new Animated.Value(0),
    diaper: new Animated.Value(0),
    other: new Animated.Value(0),
  };

  // Start animations when visible changes
  useEffect(() => {
    if (visible) {
      // Animate buttons in sequence with slight delay - von unten nach oben
      Animated.stagger(70, [
        // Reihenfolge angepasst, um mit der Anzeige übereinzustimmen (Wickeln, Füttern, Sonstiges)
        Animated.timing(animations.other, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.timing(animations.feeding, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.timing(animations.diaper, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
      ]).start();
    } else {
      // Reset animations when hiding
      Object.values(animations).forEach(anim => anim.setValue(0));
    }
  }, [visible]);

  if (!visible) return null;

  // Calculate transforms for each button - vertical arrangement
  const getAnimatedStyle = (animation: Animated.Value, index: number) => {
    // Calculate position in vertical line
    const translateY = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -index * 60], // Reduzierter Abstand zwischen den Buttons
    });

    const scale = animation.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 1.2, 1],
    });

    const opacity = animation.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 0.7, 1],
    });

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  };

  return (
    <View style={styles.container}>
      {/* Reihenfolge der Buttons angepasst, um mit dem Screenshot übereinzustimmen */}
      <Animated.View style={[styles.button, getAnimatedStyle(animations.diaper, 0)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#4CAF50' }]} // Grün für Wickeln
          onPress={() => onSelect('diaper')}
        >
          <IconSymbol name="heart.fill" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.button, getAnimatedStyle(animations.feeding, 1)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#FF9800' }]} // Orange für Füttern
          onPress={() => onSelect('feeding')}
        >
          <IconSymbol name="drop.fill" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.button, getAnimatedStyle(animations.other, 2)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#9C27B0' }]} // Lila für Sonstiges
          onPress={() => onSelect('other')}
        >
          <IconSymbol name="star.fill" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Positioniert näher am FAB
    right: 30, // Gleiche Position wie der FAB
    width: 70,
    height: 250, // Reduzierte Höhe, da ein Button weniger
    alignItems: 'center',
    justifyContent: 'center', // Zentriert die Buttons
    zIndex: 998,
  },
  button: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

export default ActivitySelector;
