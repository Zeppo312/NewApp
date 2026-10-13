import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { ActionColors } from "@/constants/Colors";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { useLocale } from '@/contexts/LocaleContext';

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  bottomInset?: number;
  rightInset?: number;
};

export const FloatingAddButton: React.FC<Props> = ({
  onPress,
  accessibilityLabel,
  bottomInset = 16,
  rightInset = 16,
}) => {
  const { locale } = useLocale();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const colors = ActionColors[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[styles.wrap, { bottom: bottomInset, right: rightInset }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? { de: 'Schnell hinzufügen', en: 'Quick add', es: 'Añadir rápidamente' }[locale]}
        style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
      >
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <IconSymbol name="plus" color={colors.onPrimary} size={26} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 10, alignItems: "flex-end" },
  btn: {
    // Keep the familiar floating plus shape; its colors use the common action pair.
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: '0 4px 10px rgba(0,0,0,0.14)',
  },
});

export default FloatingAddButton;
