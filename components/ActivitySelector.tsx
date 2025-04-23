import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

type ActivityType = 'feeding' | 'sleep' | 'diaper' | 'other';

interface ActivitySelectorProps {
  visible: boolean;
  onSelect: (type: ActivityType) => void;
}

const ActivitySelector: React.FC<ActivitySelectorProps> = ({ visible, onSelect }) => {
  // Animation values for each button
  const animations = {
    feeding: new Animated.Value(0),
    sleep: new Animated.Value(0),
    diaper: new Animated.Value(0),
    other: new Animated.Value(0),
  };

  // Start animations when visible changes
  useEffect(() => {
    if (visible) {
      // Animate buttons in sequence with slight delay - from bottom to top
      Animated.stagger(70, [
        // Start with the bottom button (other) and move up
        Animated.timing(animations.other, {
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
        Animated.timing(animations.sleep, {
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
      ]).start();
    } else {
      // Reset animations when hiding
      Object.values(animations).forEach(anim => anim.setValue(0));
    }
  }, [visible]);

  if (!visible) return null;

  // Calculate transforms for each button - vertical arrangement directly above the plus button
  const getAnimatedStyle = (animation: Animated.Value, index: number) => {
    // Calculate position in vertical line - starting from the bottom (plus button position)
    const translateY = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -60 - index * 60], // Vertical offset increases with index, starting right above the plus button
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
      <Animated.View style={[styles.button, getAnimatedStyle(animations.feeding, 0)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#FF9800' }]}
          onPress={() => onSelect('feeding')}
        >
          <IconSymbol name="drop.fill" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.button, getAnimatedStyle(animations.sleep, 1)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#5C6BC0' }]}
          onPress={() => onSelect('sleep')}
        >
          <IconSymbol name="moon.fill" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.button, getAnimatedStyle(animations.diaper, 2)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => onSelect('diaper')}
        >
          <IconSymbol name="heart.fill" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.button, getAnimatedStyle(animations.other, 3)]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => onSelect('other')}
        >
          <IconSymbol name="star.fill" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 60,
    height: 300, // Erhöht, um Platz für die Buttons zu schaffen
    alignItems: 'center',
    justifyContent: 'flex-end', // Ausrichtung am unteren Ende
    zIndex: 998,
  },
  button: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    right: 5, // Zentriert über dem Plus-Button
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
