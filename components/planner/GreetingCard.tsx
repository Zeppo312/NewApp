import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { CachedImage } from "@/components/CachedImage";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { LiquidGlassCard } from "@/constants/DesignGuide";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import {
  GLASS_BORDER,
  GLASS_OVERLAY,
  LAYOUT_PAD,
  PRIMARY,
  TEXT_PRIMARY,
} from "@/constants/PlannerDesign";

type Props = {
  title: string;
  subline?: string;
  avatarUrl?: string | null;
};

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const GreetingCard: React.FC<Props> = ({
  title,
  subline = "Schön, dass du da bist.",
  avatarUrl = null,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : TEXT_PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : TEXT_PRIMARY;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const glassOverlay = isDark ? "rgba(0,0,0,0.35)" : GLASS_OVERLAY;
  const glassBorder = isDark ? "rgba(255,255,255,0.24)" : GLASS_BORDER;
  const gradientColors: [string, string, string] = isDark
    ? [toRgba(accentColor, 0.24), "rgba(0,0,0,0)", "rgba(18,14,24,0.42)"]
    : [
        "rgba(94,61,179,0.18)",
        "rgba(255,255,255,0.0)",
        "rgba(255,207,221,0.30)",
      ];

  // Animationen
  const introAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Card fährt weich rein
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Avatar "atmet"
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarScale, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(avatarScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [introAnim, avatarScale]);

  const introStyle = {
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View style={introStyle}>
      <LiquidGlassCard
        style={styles.card}
        overlayColor={glassOverlay}
        borderColor={glassBorder}
        intensity={28}
      >
        {/* weicher Verlauf im Hintergrund */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />

        {/* kleine Deko-Bubbles */}
        <View
          style={[
            styles.bubbleTopLeft,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.14)"
                : "rgba(255,255,255,0.4)",
            },
          ]}
        />
        <View
          style={[
            styles.bubbleBottomRight,
            {
              backgroundColor: isDark
                ? toRgba(accentColor, 0.28)
                : "rgba(94,61,179,0.30)",
            },
          ]}
        />

        <View
          style={styles.content}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Begrüßung. ${title}.`}
        >
          {/* Text */}
          <View style={styles.textColumn}>
            <ThemedText style={[styles.headline, { color: textPrimary }]}>
              {title}{" "}
              <ThemedText style={[styles.highlight, { color: accentColor }]}>
                💜
              </ThemedText>
            </ThemedText>

            {subline ? (
              <ThemedText
                style={[styles.sub, { color: textSecondary }]}
                numberOfLines={2}
              >
                {subline}
              </ThemedText>
            ) : null}
          </View>

          {/* Avatar-Bubble */}
          <Animated.View
            style={[
              styles.avatarWrapper,
              { transform: [{ scale: avatarScale }] },
            ]}
            accessible
            accessibilityLabel={
              avatarUrl ? "Profilbild" : "Profilbild Platzhalter"
            }
          >
            <View
              style={[
                styles.avatarGlow,
                {
                  backgroundColor: isDark
                    ? toRgba(accentColor, 0.26)
                    : "rgba(94,61,179,0.35)",
                },
              ]}
            />
            <View
              style={[
                styles.avatarBubble,
                {
                  backgroundColor: isDark
                    ? "rgba(18,18,22,0.94)"
                    : "rgba(255,255,255,0.98)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.9)",
                },
              ]}
            >
              {avatarUrl ? (
                <CachedImage
                  uri={avatarUrl}
                  style={styles.avatarImage}
                  showLoader={false}
                />
              ) : (
                <IconSymbol name="person.fill" size={30} color={accentColor} />
              )}
            </View>
          </Animated.View>
        </View>
      </LiquidGlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    width: "108%",
    marginHorizontal: -LAYOUT_PAD, // zieht bewusst über den Außen-Padding hinaus
    paddingHorizontal: LAYOUT_PAD + 24,
    paddingVertical: LAYOUT_PAD + 14,
    borderRadius: 36,
    minHeight: 180,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bubbleTopLeft: {
    position: "absolute",
    top: -18,
    left: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.4)",
    opacity: 0.45,
  },
  bubbleBottomRight: {
    position: "absolute",
    bottom: -24,
    right: -18,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(94,61,179,0.30)",
    opacity: 0.7,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  textColumn: {
    flex: 1,
    paddingLeft: 18,
    paddingRight: 12,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "left",
    color: TEXT_PRIMARY,
  },
  highlight: {
    color: PRIMARY,
  },
  sub: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    textAlign: "left",
  },
  avatarWrapper: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(94,61,179,0.35)",
    opacity: 0.55,
  },
  avatarBubble: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1.6,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
});

export default GreetingCard;
