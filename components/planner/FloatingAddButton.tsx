import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import {
  GLASS_BORDER,
  GLASS_OVERLAY,
  PRIMARY,
} from "@/constants/PlannerDesign";

type Props = {
  onPress: () => void;
  bottomInset?: number;
  rightInset?: number;
};

export const FloatingAddButton: React.FC<Props> = ({
  onPress,
  bottomInset = 16,
  rightInset = 16,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const overlayColor = isDark ? "rgba(0,0,0,0.35)" : GLASS_OVERLAY;
  const borderColor = isDark ? "rgba(255,255,255,0.22)" : GLASS_BORDER;
  const iconColor = isDark ? adaptiveColors.accent : PRIMARY;
  const blurTint = isDark ? "dark" : "light";

  return (
    <View
      style={[styles.wrap, { bottom: bottomInset, right: rightInset }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Schnell hinzufügen"
        style={({ pressed }) => [
          styles.btn,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <BlurView
          intensity={22}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: overlayColor,
              borderRadius: 28,
              borderWidth: 1,
              borderColor,
            },
          ]}
        />
        <IconSymbol name="plus" color={iconColor as any} size={26} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 10, alignItems: "flex-end" },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});

export default FloatingAddButton;
