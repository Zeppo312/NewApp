import React, { type PropsWithChildren, type ReactElement } from 'react';
import { StyleSheet, View, PanResponder, Animated as RNAnimated } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  backButton?: ReactElement;
  onSwipeRight?: () => void;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  backButton,
  onSwipeRight,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const bottom = useBottomTabOverflow();

  // Animation für Swipe-Feedback
  const swipeAnim = React.useRef(new RNAnimated.Value(0)).current;

  // PanResponder für Swipe-Gesten
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Nur horizontale Bewegungen erkennen
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderGrant: () => {
      // Animation zurücksetzen, wenn Geste beginnt
      swipeAnim.setValue(0);
    },
    onPanResponderMove: (evt, gestureState) => {
      // Animation aktualisieren basierend auf der horizontalen Bewegung
      // Maximal 100 Pixel Bewegung erlauben
      const dx = Math.min(100, Math.max(0, gestureState.dx));
      swipeAnim.setValue(dx);
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx > 50 && onSwipeRight) {
        // Animation abschließen und dann zurücknavigieren
        RNAnimated.timing(swipeAnim, {
          toValue: 150, // Weiter nach rechts animieren
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeRight();
        });
      } else {
        // Zurück zur Ausgangsposition animieren
        RNAnimated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  // Animierter Container-Stil
  const animatedContainerStyle = {
    transform: [{ translateX: swipeAnim }]
  };

  // Hintergrund-Stil für Swipe-Indikator
  const swipeIndicatorStyle = {
    opacity: swipeAnim.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 0.7],
      extrapolate: 'clamp',
    })
  };

  return (
    <ThemedView style={styles.container} {...panResponder.panHandlers}>
      {/* Hintergrund-Indikator für Swipe-Geste */}
      <RNAnimated.View style={[styles.swipeIndicator, swipeIndicatorStyle]} />

      <RNAnimated.View style={animatedContainerStyle}>
        <Animated.ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          scrollIndicatorInsets={{ bottom }}
          contentContainerStyle={{ paddingBottom: bottom }}>
        <Animated.View
          style={[
            styles.header,
            { backgroundColor: headerBackgroundColor[colorScheme] },
            headerAnimatedStyle,
          ]}>
          {headerImage}
          {backButton && (
            <View style={styles.backButtonContainer}>
              {backButton}
            </View>
          )}
        </Animated.View>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </Animated.ScrollView>
      </RNAnimated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  swipeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: '#E57373',
    zIndex: 5,
  },
});
