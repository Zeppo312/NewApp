// Schwebender Aufnahme-Button (Premium, Opt-in in den App-Einstellungen).
//
// Liegt als kleiner runder Knopf über allen Screens, lässt sich frei ziehen
// und rastet am nächsten seitlichen Rand ein — wie das Tools-Menü in Expo Go.
// Ein Tipp öffnet das Sprach-Logging; nach dem Speichern wird ein Event
// gefeuert, damit z. B. der Home-Screen seine Einträge nachlädt.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import VoiceLogModal from '@/components/VoiceLogModal';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { fetchVoiceLogAccess } from '@/lib/voiceLog/access';
import {
  FLOATING_VOICE_BUTTON_COLORS,
  emitVoiceLogSaved,
  readFloatingVoiceButtonPosition,
  useFloatingVoiceButtonColor,
  useFloatingVoiceButtonEnabled,
  writeFloatingVoiceButtonPosition,
} from '@/lib/voiceLog/floatingButton';

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 10;
/** Tab-Bar/Home-Indicator freihalten. */
const BOTTOM_RESERVE = 96;
const TOP_RESERVE = 56;

/** Routen, auf denen der Button stört (Login, Paywall, Vollbild-Flows). */
const HIDDEN_PATH_PREFIXES = ['/(auth)', '/auth', '/paywall', '/login', '/register', '/onboarding', '/pregnancy-setup', '/invite'];

const FloatingVoiceButton: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const { isBabyBorn, isReadOnlyPreviewMode } = useBabyStatus();
  const { activeBabyId, activeBaby } = useActiveBaby();
  const enabled = useFloatingVoiceButtonEnabled();
  const selectedColor = useFloatingVoiceButtonColor();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const colorOption = FLOATING_VOICE_BUTTON_COLORS.find((option) => option.id === selectedColor)
    ?? FLOATING_VOICE_BUTTON_COLORS[0];

  const [hasAccess, setHasAccess] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [positionReady, setPositionReady] = useState(false);

  const bounds = useMemo(() => {
    const minX = EDGE_MARGIN;
    const maxX = width - BUTTON_SIZE - EDGE_MARGIN;
    const minY = insets.top + TOP_RESERVE;
    const maxY = height - insets.bottom - BOTTOM_RESERVE - BUTTON_SIZE;
    return { minX, maxX, minY, maxY: Math.max(minY, maxY) };
  }, [height, insets.bottom, insets.top, width]);

  const x = useSharedValue(bounds.maxX);
  const y = useSharedValue(bounds.maxY - 120);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pressed = useSharedValue(0);
  const boundsRef = useRef(bounds);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  // Zugriff prüfen — gecacht, daher günstig; bei Nutzerwechsel neu.
  useEffect(() => {
    let active = true;
    if (!userId) {
      setHasAccess(false);
      return;
    }
    fetchVoiceLogAccess().then((allowed) => {
      if (active) setHasAccess(allowed);
    });
    return () => {
      active = false;
    };
  }, [userId, enabled]);

  // Gespeicherte Position laden und in den Grenzen halten.
  useEffect(() => {
    let active = true;
    readFloatingVoiceButtonPosition().then((saved) => {
      if (!active) return;
      const b = boundsRef.current;
      if (saved) {
        x.set(Math.min(b.maxX, Math.max(b.minX, saved.x)));
        y.set(Math.min(b.maxY, Math.max(b.minY, saved.y)));
      }
      setPositionReady(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bei Rotation/Resize wieder einrasten.
  useEffect(() => {
    x.set(withTiming(x.get() > width / 2 - BUTTON_SIZE / 2 ? bounds.maxX : bounds.minX, { duration: 200 }));
    y.set(withTiming(Math.min(bounds.maxY, Math.max(bounds.minY, y.get())), { duration: 200 }));
  }, [bounds, width, x, y]);

  const persist = useCallback((nextX: number, nextY: number) => {
    writeFloatingVoiceButtonPosition({ x: nextX, y: nextY });
  }, []);

  const openModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setModalVisible(true);
  }, []);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
      pressed.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((event) => {
      x.set(Math.min(bounds.maxX, Math.max(bounds.minX, startX.get() + event.translationX)));
      y.set(Math.min(bounds.maxY, Math.max(bounds.minY, startY.get() + event.translationY)));
    })
    .onEnd((event) => {
      pressed.set(withTiming(0, { duration: 160 }));
      // Zum näheren seitlichen Rand einrasten, Wurfgeschwindigkeit mitnehmen.
      const projectedX = x.get() + event.velocityX * 0.12;
      const snapX = projectedX + BUTTON_SIZE / 2 > width / 2 ? bounds.maxX : bounds.minX;
      const projectedY = Math.min(bounds.maxY, Math.max(bounds.minY, y.get() + event.velocityY * 0.08));
      x.set(withSpring(snapX, { duration: 400, dampingRatio: 0.8, overshootClamping: true, velocity: event.velocityX }));
      y.set(withSpring(projectedY, { duration: 400, dampingRatio: 0.8, overshootClamping: true, velocity: event.velocityY }));
      scheduleOnRN(persist, snapX, projectedY);
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: 100 }));
    })
    .onFinalize(() => {
      pressed.set(withTiming(0, { duration: 160 }));
    })
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(openModal);
    });

  const gesture = Gesture.Race(pan, tap);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: 1 - pressed.get() * 0.03 },
    ],
  }));

  const hiddenByRoute = !pathname || HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const shouldShow =
    enabled &&
    hasAccess &&
    Boolean(userId) &&
    !isReadOnlyPreviewMode &&
    !hiddenByRoute &&
    positionReady;

  if (!shouldShow && !modalVisible) return null;

  return (
    <>
      {shouldShow ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[styles.button, containerStyle]}
              accessibilityRole="button"
              accessibilityLabel="Per Sprache eintragen"
              accessibilityHint="Antippen zum Aufnehmen, ziehen zum Verschieben"
            >
              <BlurView
                tint={isDark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
                intensity={78}
                blurMethod={process.env.EXPO_OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
                style={styles.buttonSurface}
              >
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: `${isDark ? colorOption.darkColor : colorOption.color}${isDark ? '22' : '26'}`,
                    },
                  ]}
                />
                <Ionicons
                  name="mic-outline"
                  size={24}
                  color={isDark ? colorOption.darkColor : colorOption.color}
                />
              </BlurView>
            </Animated.View>
          </GestureDetector>
        </View>
      ) : null}
      <VoiceLogModal
        visible={modalVisible}
        userId={userId}
        babyId={activeBabyId}
        babyName={isBabyBorn ? activeBaby?.name ?? null : null}
        mode={isBabyBorn ? 'baby' : 'pregnancy'}
        onClose={() => setModalVisible(false)}
        onSaved={emitVoiceLogSaved}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSurface: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FloatingVoiceButton;
